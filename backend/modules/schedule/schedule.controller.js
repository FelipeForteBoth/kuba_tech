// Módulo Agenda Técnica — regras de negócio da programação de atendimentos.
const model = require('./schedule.model');
const userModel = require('../users/user.model');
const { AppError } = require('../../shared/http');
const { ROLES, SCHEDULE_MIN_MINUTES, SCHEDULE_MAX_DAYS } = require('../../config/roles');
const { isValidUUID } = require('../../shared/validators');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function technicianFilter(user) {
  return user.role === ROLES.TECHNICIAN ? user.id : null;
}

function parseRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const from = String(query.from || '').trim() || today;
  const to = String(query.to || '').trim() || from;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new AppError('Informe as datas no formato AAAA-MM-DD.');
  if (from > to) throw new AppError('A data inicial não pode ser maior que a data final.');
  return { from, to };
}

// GET /api/schedule?from=&to=
async function index(req, res) {
  await model.startDueOrders(req.tenantId);
  const { from, to } = parseRange(req.query);
  const technicianId = technicianFilter(req.user);

  const [agendados, pendentes, carga] = await Promise.all([
    model.listScheduled(req.tenantId, { from, to, technicianId }),
    model.listUnscheduled(req.tenantId, technicianId),
    technicianId ? Promise.resolve([]) : model.workload(req.tenantId, from, to),
  ]);

  res.json({ periodo: { de: from, ate: to }, agendados, pendentes, carga });
}

// PATCH /api/schedule/:id — programa (ou desmarca) o atendimento.
async function update(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');

  await model.startDueOrders(req.tenantId);
  const order = await model.findById(req.tenantId, req.params.id);
  if (!order) throw new AppError('Ordem de serviço não encontrada.', 404);

  const raw = String(req.body.scheduledAt || '').trim();
  let scheduledAt = null;
  if (raw) {
    if (!DATETIME_RE.test(raw)) throw new AppError('Informe a data e a hora do atendimento.');
    scheduledAt = new Date(raw);
    if (Number.isNaN(scheduledAt.getTime())) throw new AppError('Data do atendimento inválida.');
    const min = new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60000);
    const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
    if (scheduledAt < min) throw new AppError('O agendamento deve ser para, no mínimo, o próximo minuto.');
    if (scheduledAt > max) throw new AppError('O agendamento deve ser para, no máximo, 1 mês à frente.');
  }

  const technicianId = String(req.body.technicianId || '').trim() || null;
  if (technicianId) {
    if (!isValidUUID(technicianId)) throw new AppError('Técnico inválido.');
    const technician = await userModel.findById(req.tenantId, technicianId);
    if (!technician || ![ROLES.TECHNICIAN, ROLES.COMPANY_ADMIN].includes(technician.role)) {
      throw new AppError('Selecione um técnico válido da empresa.');
    }
  }

  await model.schedule(req.tenantId, req.params.id, { scheduledAt, technicianId });
  res.json(await model.findById(req.tenantId, req.params.id));
}

module.exports = { index, update };
