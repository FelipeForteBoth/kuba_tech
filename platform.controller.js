// Módulo Plataforma — regras de negócio do Administrador da Plataforma.
const model = require('./platform.model');
const { AppError } = require('../../shared/http');
const { TENANT_STATUS } = require('../../config/roles');
const { isValidUUID } = require('../../shared/validators');

async function tenants(req, res) {
  res.json(await model.listTenants(String(req.query.search || '').trim()));
}

async function tenant(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const found = await model.findTenant(req.params.id);
  if (!found) throw new AppError('Empresa não encontrada.', 404);
  res.json({ ...found, modulos: await model.listTenantModules(found.id) });
}

// Suspensão / reativação da assinatura da empresa.
async function updateStatus(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const status = String(req.body.status || '').trim();
  if (!TENANT_STATUS.includes(status)) throw new AppError('Status de assinatura inválido.');

  const updated = await model.updateTenantStatus(req.params.id, status);
  if (!updated) throw new AppError('Empresa não encontrada.', 404);
  res.json(updated);
}

async function changePlan(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const planId = String(req.body.planId || '').trim();
  if (!isValidUUID(planId)) throw new AppError('Selecione um plano válido.');
  if (!(await model.findPlanById(planId))) throw new AppError('Plano não encontrado.', 404);

  const updated = await model.changeTenantPlan(req.params.id, planId);
  if (!updated) throw new AppError('Empresa não encontrada.', 404);
  res.json(updated);
}

async function plans(_req, res) {
  res.json(await model.listPlans());
}

async function metrics(_req, res) {
  res.json(await model.metrics());
}

module.exports = { tenants, tenant, updateStatus, changePlan, plans, metrics };
