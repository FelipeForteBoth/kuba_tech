// Módulo Auth — regras de negócio (autenticação e cadastro de empresas).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const model = require('./auth.model');
const { JWT_SECRET } = require('../../middleware/auth');
const { ROLE_LABELS } = require('../../config/roles');
const { AppError } = require('../../shared/http');
const {
  isValidEmail,
  isValidName,
  isValidPassword,
  isValidCompanyName,
  isValidCNPJ,
  normalizeCNPJ,
  formatCNPJ,
  isValidPhone,
  normalizePhone,
  formatPhone,
} = require('../../shared/validators');

const TOKEN_EXPIRATION = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tenant: user.tenant_id || null },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRATION },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    perfil: user.role,
    perfilLabel: ROLE_LABELS[user.role],
    tenantId: user.tenant_id || null,
    empresa: user.company_name || null,
    plano: user.plan_name || null,
  };
}

// POST /api/auth/register — auto-cadastro da empresa contratante
async function registerCompany(req, res) {
  const companyName = String(req.body.companyName || '').trim();
  const documentInput = String(req.body.document || '').trim();
  const companyEmail = String(req.body.companyEmail || '').trim();
  const phoneInput = String(req.body.phone || '').trim();
  const adminName = String(req.body.adminName || '').trim();
  const adminEmail = String(req.body.adminEmail || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const planCode = String(req.body.planCode || '').trim();

  if (!isValidCompanyName(companyName)) throw new AppError('Informe a razão social da empresa (mínimo 3 caracteres).');
  if (!isValidCNPJ(documentInput)) throw new AppError('CNPJ inválido. Informe os 14 números.');
  if (!isValidEmail(companyEmail)) throw new AppError('E-mail da empresa inválido.');
  if (phoneInput && !isValidPhone(phoneInput)) throw new AppError('Telefone inválido. Use (00) 00000-0000.');
  if (!isValidName(adminName)) throw new AppError('Informe o nome completo do administrador.');
  if (!isValidEmail(adminEmail)) throw new AppError('E-mail do administrador inválido.');
  if (!isValidPassword(password)) throw new AppError('A senha deve ter ao menos 8 caracteres, com letras e números.');

  const document = formatCNPJ(normalizeCNPJ(documentInput));
  const phone = phoneInput ? formatPhone(normalizePhone(phoneInput)) : null;

  if (await model.tenantDocumentExists(document)) throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
  if (await model.findUserByEmail(adminEmail)) throw new AppError('Já existe um usuário com este e-mail.', 409);

  const plan = planCode ? await model.findPlanByCode(planCode) : await model.findDefaultPlan();
  if (!plan) throw new AppError('Nenhum plano disponível para contratação.', 500);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { tenant, user } = await model.createCompanyWithAdmin({
    company: { name: companyName, document, email: companyEmail, phone },
    admin: { name: adminName, email: adminEmail, passwordHash },
    planId: plan.id,
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    usuario: publicUser({ ...user, company_name: tenant.company_name, plan_name: plan.name }),
  });
}

// POST /api/auth/login
async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) throw new AppError('Informe e-mail e senha.');

  await model.expireSuspendedTenants();

  const user = await model.findUserByEmail(email);
  // Mensagem genérica: não revela se o e-mail existe.
  const invalid = new AppError('E-mail ou senha inválidos.', 401);
  if (!user) throw invalid;

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw invalid;
  if (!user.active) throw new AppError('Usuário desativado. Procure o administrador da sua empresa.', 403);
  if (user.tenant_id && user.tenant_status !== 'active') {
    throw new AppError('A assinatura da sua empresa está inativa.', 403);
  }

  await model.registerLogin(user.id);
  res.json({ token: signToken(user), usuario: publicUser(user) });
}

// GET /api/auth/me
async function me(req, res) {
  const user = await model.findUserById(req.user.id);
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  res.json(publicUser(user));
}

// PUT /api/auth/password
async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!isValidPassword(newPassword)) throw new AppError('A nova senha deve ter ao menos 8 caracteres, com letras e números.');

  const record = await model.getPasswordHash(req.user.id);
  const matches = await bcrypt.compare(currentPassword, record.password_hash);
  if (!matches) throw new AppError('Senha atual incorreta.', 401);

  await model.updatePassword(req.user.id, await bcrypt.hash(newPassword, SALT_ROUNDS));
  res.json({ message: 'Senha alterada com sucesso.' });
}

module.exports = { registerCompany, login, me, changePassword, signToken, publicUser, SALT_ROUNDS };
