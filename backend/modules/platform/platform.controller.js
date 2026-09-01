// Módulo Plataforma — regras de negócio do Administrador da Plataforma.
const bcrypt = require('bcryptjs');
const model = require('./platform.model');
const authModel = require('../auth/auth.model');
const mailer = require('../../shared/mailer');
const { AppError } = require('../../shared/http');
const { loginUrl } = require('../../shared/appUrl');
const { TENANT_STATUS } = require('../../config/roles');
const {
  isValidUUID,
  isValidCompanyName,
  isValidCNPJ,
  normalizeCNPJ,
  formatCNPJ,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  formatPhone,
  isValidName,
} = require('../../shared/validators');

const SALT_ROUNDS = 10;
// Primeiro acesso: senha temporária padrão, trocada obrigatoriamente no login.
const TEMP_PASSWORD = '123456';

const PLAN_REQUEST_LABEL = {
  pending: 'Aguardando análise',
  in_service: 'Em atendimento',
  done: 'Concluída',
  rejected: 'Recusada',
};

async function tenants(req, res) {
  await model.expireSuspended();
  res.json(await model.listTenants(String(req.query.search || '').trim()));
}

async function tenant(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const found = await model.findTenant(req.params.id);
  if (!found) throw new AppError('Empresa não encontrada.', 404);
  res.json({ ...found, modulos: await model.listTenantModules(found.id) });
}

// POST /tenants — cadastro de empresa pelo Administrador da Plataforma.
async function store(req, res) {
  const companyName = String(req.body.companyName || '').trim();
  const documentInput = String(req.body.document || '').trim();
  const companyEmail = String(req.body.companyEmail || '').trim();
  const phoneInput = String(req.body.phone || '').trim();
  const adminName = String(req.body.adminName || '').trim();
  const adminEmail = String(req.body.adminEmail || '').trim().toLowerCase();
  const planId = String(req.body.planId || '').trim();

  if (!isValidCompanyName(companyName)) throw new AppError('Informe a razão social da empresa (mínimo 3 caracteres).');
  if (!isValidCNPJ(documentInput)) throw new AppError('CNPJ inválido. Informe os 14 números.');
  if (!isValidEmail(companyEmail)) throw new AppError('E-mail da empresa inválido.');
  if (phoneInput && !isValidPhone(phoneInput)) throw new AppError('Telefone inválido. Use (00) 00000-0000.');
  if (!isValidName(adminName)) throw new AppError('Informe o nome completo do administrador da empresa.');
  if (!isValidEmail(adminEmail)) throw new AppError('E-mail do administrador inválido.');
  if (!isValidUUID(planId)) throw new AppError('Selecione um plano válido.');

  const plan = await model.findPlanById(planId);
  if (!plan) throw new AppError('Plano não encontrado.', 404);

  const document = formatCNPJ(normalizeCNPJ(documentInput));
  const phone = phoneInput ? formatPhone(normalizePhone(phoneInput)) : null;

  if (await model.documentExists(document)) throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
  if (await authModel.findUserByEmail(adminEmail)) throw new AppError('Já existe um usuário com este e-mail.', 409);

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, SALT_ROUNDS);
  const endereco = (v, max) => (String(v || '').trim() ? String(v).trim().slice(0, max) : null);
  const { tenant: created } = await authModel.createCompanyWithAdmin({
    company: {
      name: companyName,
      document,
      email: companyEmail,
      phone,
      zipCode: endereco(req.body.zipCode, 10),
      address: endereco(req.body.address, 255),
      neighborhood: endereco(req.body.neighborhood, 100),
      city: endereco(req.body.city, 100),
      state: endereco(req.body.state, 50),
    },
    admin: { name: adminName, email: adminEmail, passwordHash, mustChangePassword: true },
    planId: plan.id,
  });

  // Avisa o novo Administrador da Empresa sobre o acesso provisório.
  const email = await mailer.sendTemplate('primeiroAcesso', adminEmail, {
    name: adminName,
    email: adminEmail,
    tempPassword: TEMP_PASSWORD,
    companyName,
    loginUrl: loginUrl(),
  }, created.id);

  res.status(201).json({
    ...created,
    senhaTemporaria: TEMP_PASSWORD,
    email,
    message: `Empresa cadastrada. O administrador entra com a senha temporária ${TEMP_PASSWORD} e troca no primeiro acesso.`,
  });
}

// DELETE /tenants/:id — permitido apenas com a assinatura cancelada.
async function destroy(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const found = await model.findTenant(req.params.id);
  if (!found) throw new AppError('Empresa não encontrada.', 404);
  if (found.status !== 'canceled') {
    throw new AppError('Só é possível excluir empresas com a assinatura cancelada.', 409);
  }

  await model.deleteTenant(found.id);
  res.json({ message: 'Empresa excluída com sucesso.' });
}

// Suspensão / reativação da assinatura da empresa.
// Ao suspender, a empresa é avisada automaticamente por e-mail.
async function updateStatus(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const status = String(req.body.status || '').trim();
  if (!TENANT_STATUS.includes(status)) throw new AppError('Status de assinatura inválido.');

  const updated = await model.updateTenantStatus(req.params.id, status);
  if (!updated) throw new AppError('Empresa não encontrada.', 404);

  let email = null;
  if (status === 'suspended') {
    const empresa = await model.findTenant(updated.id);
    email = await mailer.sendTemplate('empresaSuspensa', empresa.email, {
      companyName: empresa.company_name,
      planName: empresa.plan_name,
    }, updated.id);
  }

  res.json({ ...updated, email });
}

/** GET /tenants/:id/emails — histórico de e-mails enviados à empresa. */
async function emails(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  res.json(await mailer.listLogs(req.params.id));
}

// ── Solicitações de alteração de plano ──────────────────────────────

/** GET /plan-requests — pedidos enviados pelas empresas contratantes. */
async function planRequests(req, res) {
  const status = String(req.query.status || '').trim();
  const lista = await model.listPlanRequests(status);
  res.json(lista.map((r) => ({ ...r, status_label: PLAN_REQUEST_LABEL[r.status] || r.status })));
}

/** PATCH /plan-requests/:id — registra o andamento e avisa a empresa. */
async function updatePlanRequest(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const status = String(req.body.status || '').trim();
  const answer = String(req.body.answer || '').trim().slice(0, 1000);
  if (status && !PLAN_REQUEST_LABEL[status]) throw new AppError('Situação da solicitação inválida.');

  const atual = await model.findPlanRequest(req.params.id);
  if (!atual) throw new AppError('Solicitação não encontrada.', 404);

  // Concluir o pedido aplica o plano desejado à empresa.
  if (status === 'done' && atual.desired_plan_id) {
    await model.changeTenantPlan(atual.tenant_id, atual.desired_plan_id);
  }

  const atualizada = await model.updatePlanRequest(atual.id, {
    status, answer, decidedBy: req.user.id,
  });

  if (status) {
    await mailer.sendTemplate('solicitacaoPlanoAtualizada', atual.requester_email || atual.company_email, {
      companyName: atual.company_name,
      statusLabel: PLAN_REQUEST_LABEL[status],
      answer,
      planName: atual.desired_plan_name,
    }, atual.tenant_id);
  }

  res.json({
    ...atualizada,
    status_label: PLAN_REQUEST_LABEL[atualizada.status] || atualizada.status,
    message: 'Solicitação atualizada.',
  });
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

async function modules(_req, res) {
  res.json(await model.listModules());
}

async function metrics(_req, res) {
  await model.expireSuspended();
  res.json(await model.metrics());
}

module.exports = {
  tenants, tenant, store, destroy, updateStatus, changePlan, plans, modules, metrics,
  emails, planRequests, updatePlanRequest, PLAN_REQUEST_LABEL,
};
