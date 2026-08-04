// Módulo Usuários — regras de negócio (gestão da equipe pelo Administrador da Empresa).
const bcrypt = require('bcryptjs');
const model = require('./user.model');
const { AppError } = require('../../shared/http');
const { ROLES, ROLE_LABELS, TENANT_ROLES } = require('../../config/roles');
const { isValidName, isValidEmail, isValidPassword, isValidUUID } = require('../../shared/validators');

const SALT_ROUNDS = 10;

async function index(req, res) {
  const role = String(req.query.role || '').trim();
  if (role) {
    if (!TENANT_ROLES.includes(role)) throw new AppError('Perfil inválido.');
    return res.json(await model.listByRole(req.tenantId, [role]));
  }
  res.json(await model.list(req.tenantId));
}

// Lista usada na abertura de O.S. para escolher o responsável técnico.
async function technicians(req, res) {
  res.json(await model.listByRole(req.tenantId, [ROLES.TECHNICIAN, ROLES.COMPANY_ADMIN]));
}

function roles(_req, res) {
  res.json(TENANT_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })));
}

async function show(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const user = await model.findById(req.tenantId, req.params.id);
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  res.json(user);
}

async function store(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || '').trim();

  if (!isValidName(name)) throw new AppError('Informe o nome completo do usuário.');
  if (!isValidEmail(email)) throw new AppError('E-mail inválido.');
  if (!isValidPassword(password)) throw new AppError('A senha deve ter ao menos 8 caracteres, com letras e números.');
  if (!TENANT_ROLES.includes(role)) throw new AppError('Selecione um perfil de acesso válido.');
  if (await model.findByEmail(email)) throw new AppError('Já existe um usuário com este e-mail.', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  res.status(201).json(await model.create(req.tenantId, { name, email, passwordHash, role }));
}

async function update(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const current = await model.findById(req.tenantId, req.params.id);
  if (!current) throw new AppError('Usuário não encontrado.', 404);

  const name = String(req.body.name || '').trim();
  const role = String(req.body.role || '').trim();
  const active = req.body.active === undefined ? current.active : Boolean(req.body.active);

  if (!isValidName(name)) throw new AppError('Informe o nome completo do usuário.');
  if (!TENANT_ROLES.includes(role)) throw new AppError('Selecione um perfil de acesso válido.');

  // Impede a empresa de ficar sem nenhum administrador ativo.
  const losingAdmin = current.role === ROLES.COMPANY_ADMIN && (role !== ROLES.COMPANY_ADMIN || !active);
  if (losingAdmin && (await model.countActiveAdmins(req.tenantId)).total <= 1) {
    throw new AppError('A empresa precisa manter ao menos um administrador ativo.', 409);
  }
  if (current.id === req.user.id && !active) throw new AppError('Você não pode desativar o seu próprio usuário.');

  res.json(await model.update(req.tenantId, req.params.id, { name, role, active }));
}

async function resetPassword(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const password = String(req.body.password || '');
  if (!isValidPassword(password)) throw new AppError('A senha deve ter ao menos 8 caracteres, com letras e números.');

  const user = await model.resetPassword(req.tenantId, req.params.id, await bcrypt.hash(password, SALT_ROUNDS));
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  res.json({ message: 'Senha redefinida com sucesso.' });
}

async function destroy(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  if (req.params.id === req.user.id) throw new AppError('Você não pode excluir o seu próprio usuário.');

  const current = await model.findById(req.tenantId, req.params.id);
  if (!current) throw new AppError('Usuário não encontrado.', 404);
  if (current.role === ROLES.COMPANY_ADMIN && (await model.countActiveAdmins(req.tenantId)).total <= 1) {
    throw new AppError('A empresa precisa manter ao menos um administrador ativo.', 409);
  }

  await model.remove(req.tenantId, req.params.id);
  res.json({ message: 'Usuário excluído com sucesso.' });
}

module.exports = { index, technicians, roles, show, store, update, resetPassword, destroy };
