// Módulo Ordens de Serviço — regras de negócio e ciclo de vida da O.S.
const model = require('./serviceOrder.model');
const customerModel = require('../customers/customer.model');
const deviceModel = require('../devices/device.model');
const userModel = require('../users/user.model');
const { AppError } = require('../../shared/http');
const { ROLES, OS_STATUS } = require('../../config/roles');
const { isNonEmptyText, isValidUUID, isValidPastOrTodayDate } = require('../../shared/validators');

// O Técnico enxerga e atualiza apenas as O.S. atribuídas a ele.
function technicianFilter(user) {
  return user.role === ROLES.TECHNICIAN ? user.id : null;
}

async function index(req, res) {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  if (status && !OS_STATUS.includes(status)) throw new AppError('Status inválido.');

  res.json(
    await model.list(req.tenantId, {
      search,
      status: status || null,
      technicianId: technicianFilter(req.user),
    }),
  );
}

async function summary(req, res) {
  const rows = await model.statusSummary(req.tenantId, technicianFilter(req.user));
  const totals = { 'A Realizar': 0, 'Em Andamento': 0, Finalizada: 0, Cancelada: 0 };
  rows.forEach((row) => {
    totals[row.status] = row.total;
  });

  res.json({
    ordens: totals,
    clientes: (await customerModel.count(req.tenantId)).total,
    equipamentos: (await deviceModel.count(req.tenantId)).total,
  });
}

async function loadOrder(req) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const order = await model.findById(req.tenantId, req.params.id);
  if (!order) throw new AppError('Ordem de serviço não encontrada.', 404);
  if (req.user.role === ROLES.TECHNICIAN && order.technician_id !== req.user.id) {
    throw new AppError('Esta ordem de serviço não está atribuída a você.', 403);
  }
  return order;
}

async function show(req, res) {
  res.json(await loadOrder(req));
}

async function validatePayload(req) {
  const customerId = String(req.body.customerId || '').trim();
  const deviceId = String(req.body.deviceId || '').trim();
  const technicianId = String(req.body.technicianId || '').trim() || null;
  const openingDate = String(req.body.openingDate || '').trim();
  const problemDescription = String(req.body.problemDescription || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  const status = String(req.body.status || 'A Realizar').trim();

  if (!isValidUUID(customerId)) throw new AppError('Selecione o cliente da ordem de serviço.');
  if (!isValidUUID(deviceId)) throw new AppError('Selecione o equipamento da ordem de serviço.');
  if (technicianId && !isValidUUID(technicianId)) throw new AppError('Técnico inválido.');
  if (!isValidPastOrTodayDate(openingDate)) throw new AppError('Data de abertura inválida. Não pode ser futura.');
  if (!isNonEmptyText(problemDescription, 10)) throw new AppError('Descreva o problema com pelo menos 10 caracteres.');
  if (!OS_STATUS.includes(status)) throw new AppError('Status inválido.');

  const customer = await customerModel.findById(req.tenantId, customerId);
  if (!customer) throw new AppError('Cliente não encontrado nesta empresa.', 404);

  const device = await deviceModel.findById(req.tenantId, deviceId);
  if (!device) throw new AppError('Equipamento não encontrado nesta empresa.', 404);
  if (device.customer_id !== customerId) throw new AppError('O equipamento selecionado não pertence a este cliente.');

  if (technicianId) {
    const technician = await userModel.findById(req.tenantId, technicianId);
    if (!technician || ![ROLES.TECHNICIAN, ROLES.COMPANY_ADMIN].includes(technician.role)) {
      throw new AppError('Selecione um técnico válido da empresa.');
    }
  }

  return { customerId, deviceId, technicianId, openingDate, problemDescription, solution, status };
}

async function store(req, res) {
  const data = await validatePayload(req);
  const created = await model.create(req.tenantId, { ...data, createdBy: req.user.id });
  res.status(201).json(await model.findById(req.tenantId, created.id));
}

async function update(req, res) {
  await loadOrder(req);
  const data = await validatePayload(req);
  await model.update(req.tenantId, req.params.id, data);
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/status — acompanhamento do ciclo de vida (Técnico, Atendente e Admin)
async function updateStatus(req, res) {
  await loadOrder(req);

  const status = String(req.body.status || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  if (!OS_STATUS.includes(status)) throw new AppError('Status inválido.');
  if (status === 'Finalizada' && !isNonEmptyText(solution, 5)) {
    throw new AppError('Descreva o serviço executado para finalizar a ordem de serviço.');
  }

  await model.updateProgress(req.tenantId, req.params.id, { status, solution });
  res.json(await model.findById(req.tenantId, req.params.id));
}

async function destroy(req, res) {
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Ordem de serviço não encontrada.', 404);
  res.json({ message: 'Ordem de serviço excluída com sucesso.' });
}

module.exports = { index, summary, show, store, update, updateStatus, destroy };
