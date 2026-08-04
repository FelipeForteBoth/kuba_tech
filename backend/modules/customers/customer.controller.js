// Módulo Clientes — regras de negócio.
const model = require('./customer.model');
const { AppError } = require('../../shared/http');
const {
  isValidCPF,
  isValidPhone,
  isValidEmail,
  isValidName,
  isValidUUID,
  normalizeCPF,
  formatCPF,
  normalizePhone,
  formatPhone,
} = require('../../shared/validators');

async function index(req, res) {
  const search = String(req.query.search || '').trim();
  res.json(await model.list(req.tenantId, search));
}

async function show(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const customer = await model.findById(req.tenantId, req.params.id);
  if (!customer) throw new AppError('Cliente não encontrado.', 404);
  res.json(customer);
}

function validatePayload(body, { requireCpf }) {
  const name = String(body.name || '').trim();
  const phoneInput = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const cpfInput = String(body.cpf || '').trim();

  if (!isValidName(name)) throw new AppError('Informe o nome completo (nome e sobrenome), apenas letras.');
  if (!isValidPhone(phoneInput)) throw new AppError('Telefone inválido. Use o formato (00) 00000-0000.');
  if (!isValidEmail(email)) throw new AppError('E-mail inválido.');
  if (requireCpf && !isValidCPF(cpfInput)) throw new AppError('CPF inválido. Informe os 11 números no formato 000.000.000-00.');

  return {
    name,
    email,
    phone: formatPhone(normalizePhone(phoneInput)),
    cpf: requireCpf ? formatCPF(normalizeCPF(cpfInput)) : null,
  };
}

async function store(req, res) {
  const data = validatePayload(req.body, { requireCpf: true });

  if (await model.findByCpf(req.tenantId, data.cpf)) {
    throw new AppError('Já existe um cliente com este CPF nesta empresa.', 409);
  }

  res.status(201).json(await model.create(req.tenantId, data));
}

async function update(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const data = validatePayload(req.body, { requireCpf: false });

  const customer = await model.update(req.tenantId, req.params.id, data);
  if (!customer) throw new AppError('Cliente não encontrado.', 404);
  res.json(customer);
}

async function destroy(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Cliente não encontrado.', 404);
  res.json({ message: 'Cliente excluído com sucesso.' });
}

module.exports = { index, show, store, update, destroy };
