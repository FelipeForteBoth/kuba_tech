// Módulo Empresa — regras de negócio das configurações da empresa.
const model = require('./company.model');
const { AppError } = require('../../shared/http');

const MIN_SLA = 1;
const MAX_SLA = 8760; // 1 ano

function parseSlaHours(value) {
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < MIN_SLA || hours > MAX_SLA) {
    throw new AppError(`Informe o SLA em horas (entre ${MIN_SLA} e ${MAX_SLA}).`);
  }
  return hours;
}

async function settings(req, res) {
  const data = await model.findSettings(req.tenantId);
  if (!data) throw new AppError('Empresa não encontrada.', 404);
  res.json({ ...data, modulos: await model.listModules(req.tenantId) });
}

// PUT /settings/sla — o Administrador da Empresa define o prazo padrão.
async function updateSla(req, res) {
  const slaHours = parseSlaHours(req.body.slaHours);
  const updated = await model.updateSlaHours(req.tenantId, slaHours);
  res.json({ message: 'Prazo padrão (SLA) atualizado.', slaHours: updated.sla_hours });
}

module.exports = { settings, updateSla, parseSlaHours, MIN_SLA, MAX_SLA };
