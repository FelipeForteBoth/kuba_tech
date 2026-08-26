// Módulo Plataforma — regras de negócio do Administrador da Plataforma.
const bcrypt = require('bcryptjs');
const model = require('./platform.model');
const authModel = require('../auth/auth.model');
const billing = require('../billing/billing.controller');
const billingModel = require('../billing/billing.model');
const mailer = require('../../shared/mailer');
const { AppError } = require('../../shared/http');
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
  isValidPassword,
} = require('../../shared/validators');

const SALT_ROUNDS = 10;

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
  const password = String(req.body.password || '');
  const planId = String(req.body.planId || '').trim();

  if (!isValidCompanyName(companyName)) throw new AppError('Informe a razão social da empresa (mínimo 3 caracteres).');
  if (!isValidCNPJ(documentInput)) throw new AppError('CNPJ inválido. Informe os 14 números.');
  if (!isValidEmail(companyEmail)) throw new AppError('E-mail da empresa inválido.');
  if (phoneInput && !isValidPhone(phoneInput)) throw new AppError('Telefone inválido. Use (00) 00000-0000.');
  if (!isValidName(adminName)) throw new AppError('Informe o nome completo do administrador da empresa.');
  if (!isValidEmail(adminEmail)) throw new AppError('E-mail do administrador inválido.');
  if (!isValidPassword(password)) throw new AppError('A senha deve ter ao menos 8 caracteres, com letras e números.');
  if (!isValidUUID(planId)) throw new AppError('Selecione um plano válido.');

  const plan = await model.findPlanById(planId);
  if (!plan) throw new AppError('Plano não encontrado.', 404);

  const document = formatCNPJ(normalizeCNPJ(documentInput));
  const phone = phoneInput ? formatPhone(normalizePhone(phoneInput)) : null;

  if (await model.documentExists(document)) throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
  if (await authModel.findUserByEmail(adminEmail)) throw new AppError('Já existe um usuário com este e-mail.', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
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
    admin: { name: adminName, email: adminEmail, passwordHash },
    planId: plan.id,
  });


  res.status(201).json(created);
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
    const assinatura = await billingModel.findSubscription(updated.id);
    email = await mailer.sendTemplate(
      'empresaSuspensa',
      assinatura.billing_email || assinatura.email,
      {
        companyName: assinatura.company_name,
        planName: assinatura.plan_name,
        amount: assinatura.monthly_price,
        dueDate: assinatura.next_due_date,
      },
      updated.id,
    );
  }

  res.json({ ...updated, email });
}

/**
 * POST /tenants/:id/charge — o Administrador da Plataforma avisa a
 * empresa, por e-mail, que a mensalidade está em aberto.
 */
async function charge(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const { assinatura, pagamento } = await billing.garantirCobranca(req.params.id);

  const email = await mailer.sendTemplate(
    'cobranca',
    assinatura.billing_email || assinatura.email,
    {
      companyName: assinatura.company_name,
      planName: assinatura.plan_name,
      amount: assinatura.monthly_price,
      dueDate: assinatura.next_due_date,
    },
    assinatura.id,
  );

  if (!email.sent && email.reason === 'sem_provedor') {
    return res.json({
      message: 'Cobrança registrada. Configure BREVO_API_KEY (ou RESEND_API_KEY) para enviar o e-mail.',
      pagamento,
    });
  }
  if (!email.sent) throw new AppError('Não foi possível enviar o e-mail de cobrança agora.', 502);

  res.json({ message: `Cobrança enviada para ${assinatura.billing_email || assinatura.email}.`, pagamento });
}

/** GET /tenants/:id/emails — histórico de e-mails enviados à empresa. */
async function emails(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  res.json(await mailer.listLogs(req.params.id));
}

// ── Solicitações manuais de pagamento (Pix / boleto) ────────────────

/** GET /payment-requests — todas as solicitações das empresas. */
async function paymentRequests(req, res) {
  const status = String(req.query.status || '').trim() || null;
  const lista = await billingModel.listAllRequests(status);
  res.json(lista.map((r) => ({
    ...r,
    method_label: billing.METHODS[r.method] || r.method,
    status_label: billing.REQUEST_STATUS_LABEL[r.status] || r.status,
  })));
}

/**
 * PATCH /payment-requests/:id — atualiza o andamento da solicitação.
 * Ao confirmar o pagamento, a assinatura é renovada por mais 30 dias.
 */
async function updatePaymentRequest(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const status = String(req.body.status || '').trim();
  const notes = req.body.notes === undefined ? undefined : String(req.body.notes).trim();

  if (status && !billing.REQUEST_STATUS_LABEL[status]) throw new AppError('Situação da solicitação inválida.');

  const atual = await billingModel.findRequest(req.params.id);
  if (!atual) throw new AppError('Solicitação não encontrada.', 404);

  const atualizada = await billingModel.updateRequest(atual.id, { status, notes });

  // Confirmação do pagamento: dá baixa na cobrança e renova a assinatura.
  if (status === 'confirmed') {
    const pagamento = atual.payment_id
      ? await billingModel.approvePayment(atual.payment_id, null)
      : null;
    if (pagamento) {
      const assinatura = await billingModel.findSubscription(atual.tenant_id);
      await mailer.sendTemplate(
        'pagamentoAprovado',
        assinatura.billing_email || assinatura.email,
        {
          companyName: assinatura.company_name,
          planName: assinatura.plan_name,
          amount: pagamento.payment.amount,
          paidAt: pagamento.payment.paid_at,
          nextDueDate: assinatura.next_due_date,
        },
        atual.tenant_id,
      );
    }
  } else if (status) {
    await mailer.sendTemplate(
      'solicitacaoAtualizada',
      atual.billing_email || atual.company_email,
      {
        companyName: atual.company_name,
        method: billing.METHODS[atual.method] || atual.method,
        statusLabel: billing.REQUEST_STATUS_LABEL[status],
        notes: atualizada.notes,
      },
      atual.tenant_id,
    );
  }

  res.json({
    ...atualizada,
    status_label: billing.REQUEST_STATUS_LABEL[atualizada.status] || atualizada.status,
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
  charge, emails, paymentRequests, updatePaymentRequest,
};
