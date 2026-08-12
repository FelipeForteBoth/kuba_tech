// Módulo Ordens de Serviço — regras de negócio e ciclo de vida da O.S.
const model = require('./serviceOrder.model');
const customerModel = require('../customers/customer.model');
const deviceModel = require('../devices/device.model');
const userModel = require('../users/user.model');
const companyModel = require('../company/company.model');
const { parseSlaHours } = require('../company/company.controller');
const { AppError } = require('../../shared/http');
const {
  ROLES,
  OS_STATUS,
  OS_INITIAL_STATUS,
  SCHEDULE_MIN_MINUTES,
  SCHEDULE_MAX_DAYS,
} = require('../../config/roles');
const { isNonEmptyText, isValidUUID, isValidPastOrTodayDate } = require('../../shared/validators');

// O Técnico enxerga e atualiza apenas as O.S. atribuídas a ele.
function technicianFilter(user) {
  return user.role === ROLES.TECHNICIAN ? user.id : null;
}

async function index(req, res) {
  await model.startDueOrders(req.tenantId);
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
  await model.startDueOrders(req.tenantId);
  const rows = await model.statusSummary(req.tenantId, technicianFilter(req.user));
  const totals = OS_STATUS.reduce((acc, st) => ({ ...acc, [st]: 0 }), {});
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
  await model.startDueOrders(req.tenantId);
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

async function validatePayload(req, current = null) {
  const customerId = String(req.body.customerId || '').trim();
  const deviceId = String(req.body.deviceId || '').trim();
  const technicianId = String(req.body.technicianId || '').trim() || null;
  const openingDate = String(req.body.openingDate || '').trim();
  const problemDescription = String(req.body.problemDescription || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  // Toda O.S. nasce aguardando agendamento; na edição o status atual é preservado.
  const status = current ? String(req.body.status || current.status).trim() : OS_INITIAL_STATUS;

  // SLA: usa o prazo padrão da empresa (48h de fábrica) quando não informado.
  let slaHours;
  if (req.body.slaHours === undefined || req.body.slaHours === null || req.body.slaHours === '') {
    const settings = await companyModel.findSettings(req.tenantId);
    slaHours = (current && Number(current.sla_hours)) || Number(settings && settings.sla_hours) || 48;
  } else {
    slaHours = parseSlaHours(req.body.slaHours);
  }

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

  return { customerId, deviceId, technicianId, openingDate, problemDescription, solution, status, slaHours };
}

async function store(req, res) {
  const data = await validatePayload(req);
  const created = await model.create(req.tenantId, { ...data, createdBy: req.user.id });
  res.status(201).json(await model.findById(req.tenantId, created.id));
}

async function update(req, res) {
  const current = await loadOrder(req);
  const data = await validatePayload(req, current);
  await model.update(req.tenantId, req.params.id, data);
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/schedule — programa o atendimento (mínimo: próximo minuto; máximo: 1 mês).
function parseScheduledAt(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new AppError('Informe a data e a hora do atendimento.');
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw new AppError('Data do atendimento inválida.');

  const min = new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60000);
  const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
  if (when < min) throw new AppError('O agendamento deve ser para, no mínimo, o próximo minuto.');
  if (when > max) throw new AppError('O agendamento deve ser para, no máximo, 1 mês à frente.');
  return when;
}

async function schedule(req, res) {
  const order = await loadOrder(req);
  if (['Finalizada', 'Cancelada'].includes(order.status)) {
    throw new AppError('Esta ordem de serviço já foi encerrada.');
  }

  // Desmarcar devolve a O.S. para a fila de agendamento.
  if (req.body.scheduledAt === null || String(req.body.scheduledAt || '').trim() === '') {
    if (req.body.clear !== true) throw new AppError('Informe a data e a hora do atendimento.');
    await model.unscheduleOrder(req.tenantId, req.params.id);
    return res.json(await model.findById(req.tenantId, req.params.id));
  }

  const scheduledAt = parseScheduledAt(req.body.scheduledAt);

  const technicianId = String(req.body.technicianId || '').trim() || null;
  if (technicianId) {
    if (!isValidUUID(technicianId)) throw new AppError('Técnico inválido.');
    const technician = await userModel.findById(req.tenantId, technicianId);
    if (!technician || ![ROLES.TECHNICIAN, ROLES.COMPANY_ADMIN].includes(technician.role)) {
      throw new AppError('Selecione um técnico válido da empresa.');
    }
  }

  await model.scheduleOrder(req.tenantId, req.params.id, { scheduledAt, technicianId });
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/status — acompanhamento do ciclo de vida (Técnico, Atendente e Admin)
async function updateStatus(req, res) {
  const order = await loadOrder(req);

  const status = String(req.body.status || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  if (!OS_STATUS.includes(status)) throw new AppError('Status inválido.');
  if (status === 'Agendada') {
    throw new AppError('Use a programação do atendimento para agendar a ordem de serviço.');
  }
  if (
    order.status === OS_INITIAL_STATUS &&
    !['Cancelada', OS_INITIAL_STATUS].includes(status)
  ) {
    throw new AppError('Agende o atendimento antes de dar andamento na ordem de serviço.');
  }
  if (status === 'Finalizada' && !isNonEmptyText(solution, 5)) {
    throw new AppError('Descreva o serviço executado para finalizar a ordem de serviço.');
  }

  await model.updateProgress(req.tenantId, req.params.id, { status, solution });
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/sla — ajuste do prazo pelo Administrador da Empresa.
async function updateSla(req, res) {
  await loadOrder(req);
  const slaHours = parseSlaHours(req.body.slaHours);
  await model.updateSla(req.tenantId, req.params.id, slaHours);
  res.json(await model.findById(req.tenantId, req.params.id));
}

async function destroy(req, res) {
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Ordem de serviço não encontrada.', 404);
  res.json({ message: 'Ordem de serviço excluída com sucesso.' });
}

module.exports = { index, summary, show, store, update, schedule, updateStatus, updateSla, destroy };
