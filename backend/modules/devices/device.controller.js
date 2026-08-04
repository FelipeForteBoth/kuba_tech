// Módulo Equipamentos — regras de negócio.
const model = require('./device.model');
const customerModel = require('../customers/customer.model');
const { AppError } = require('../../shared/http');
const { isValidSerial, isNonEmptyText, isValidUUID } = require('../../shared/validators');

async function index(req, res) {
  const search = String(req.query.search || '').trim();
  const customerId = String(req.query.customerId || '').trim();
  if (customerId && !isValidUUID(customerId)) throw new AppError('Cliente inválido.');
  res.json(await model.list(req.tenantId, { search, customerId: customerId || null }));
}

async function show(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const device = await model.findById(req.tenantId, req.params.id);
  if (!device) throw new AppError('Equipamento não encontrado.', 404);
  res.json(device);
}

async function validatePayload(tenantId, body, { requireSerial }) {
  const customerId = String(body.customerId || '').trim();
  const type = String(body.type || '').trim();
  const brand = String(body.brand || '').trim() || null;
  const modelName = String(body.model || '').trim() || null;
  const serialNumber = String(body.serialNumber || '').trim();

  if (!isValidUUID(customerId)) throw new AppError('Selecione o cliente proprietário do equipamento.');
  if (!isNonEmptyText(type)) throw new AppError('Informe o tipo de equipamento (ao menos 2 caracteres).');
  if (requireSerial && !isValidSerial(serialNumber)) {
    throw new AppError('Número de série inválido. Use ao menos 4 caracteres (letras, números, "-" ou "/").');
  }

  const customer = await customerModel.findById(tenantId, customerId);
  if (!customer) throw new AppError('Cliente não encontrado nesta empresa.', 404);

  return { customerId, type, brand, model: modelName, serialNumber };
}

async function store(req, res) {
  const data = await validatePayload(req.tenantId, req.body, { requireSerial: true });

  if (await model.findBySerial(req.tenantId, data.serialNumber)) {
    throw new AppError('Já existe um equipamento com este número de série nesta empresa.', 409);
  }

  res.status(201).json(await model.create(req.tenantId, data));
}

async function update(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const data = await validatePayload(req.tenantId, req.body, { requireSerial: false });

  const device = await model.update(req.tenantId, req.params.id, data);
  if (!device) throw new AppError('Equipamento não encontrado.', 404);
  res.json(device);
}

async function destroy(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Equipamento não encontrado.', 404);
  res.json({ message: 'Equipamento excluído com sucesso.' });
}

module.exports = { index, show, store, update, destroy };
