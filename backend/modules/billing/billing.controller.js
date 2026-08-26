// ─────────────────────────────────────────────────────────────
// Módulo Assinatura — regras de negócio de planos e mensalidades.
// O pagamento é MANUAL: a empresa envia uma solicitação (Pix ou
// boleto) e a equipe Kuba Tech responde com as informações.
// Não existe gateway/checkout automático.
// ─────────────────────────────────────────────────────────────
const model = require('./billing.model');
const { AppError } = require('../../shared/http');
const { isValidUUID } = require('../../shared/validators');
const mailer = require('../../shared/mailer');

const METHODS = { pix: 'Pix', boleto: 'Boleto' };

const REQUEST_STATUS_LABEL = {
  sent: 'Solicitação enviada',
  in_service: 'Em atendimento',
  info_sent: 'Informações enviadas',
  awaiting_confirmation: 'Pagamento aguardando confirmação',
  confirmed: 'Pagamento confirmado',
  canceled: 'Cancelada',
};

/** E-mail oficial que recebe as solicitações (configurável por ambiente). */
function billingInbox() {
  return (
    process.env.BILLING_INBOX_EMAIL
    || process.env.PLATFORM_ADMIN_EMAIL
    || process.env.MAIL_FROM
    || null
  );
}

/** GET /billing/subscription — plano atual, valor e situação. */
async function subscription(req, res) {
  const data = await model.findSubscription(req.tenantId);
  if (!data) throw new AppError('Empresa não encontrada.', 404);
  const [pendente, solicitacao] = await Promise.all([
    model.findOpenPayment(req.tenantId),
    model.findOpenRequest(req.tenantId),
  ]);
  res.json({
    ...data,
    pagamento_pendente: pendente || null,
    solicitacao_aberta: solicitacao || null,
    pagamento: 'manual',
  });
}

/** GET /billing/plans — planos disponíveis para upgrade/downgrade. */
async function plans(_req, res) {
  res.json(await model.listPlans());
}

/** GET /billing/payments — histórico de pagamentos da empresa. */
async function payments(req, res) {
  res.json(await model.listPayments(req.tenantId));
}

/** GET /billing/requests — solicitações de renovação da empresa. */
async function requests(req, res) {
  const lista = await model.listRequests(req.tenantId);
  res.json(lista.map((r) => ({ ...r, status_label: REQUEST_STATUS_LABEL[r.status] || r.status })));
}

/** Garante que exista uma cobrança em aberto para a mensalidade. */
async function garantirCobranca(tenantId, method) {
  const assinatura = await model.findSubscription(tenantId);
  if (!assinatura) throw new AppError('Empresa não encontrada.', 404);
  if (!assinatura.plan_id) throw new AppError('A empresa não possui um plano contratado.');

  const aberta = await model.findOpenPayment(tenantId);
  const pagamento = aberta
    ? (method && aberta.method !== method ? await model.setPaymentMethod(aberta.id, method) : aberta)
    : await model.createPayment(tenantId, {
      planId: assinatura.plan_id,
      planName: assinatura.plan_name,
      amount: assinatura.monthly_price,
      dueDate: assinatura.next_due_date,
      method,
    });

  return { assinatura, pagamento };
}

/**
 * POST /billing/renewal-request — a empresa solicita a renovação
 * informando a forma de pagamento (Pix ou boleto).
 */
async function requestRenewal(req, res) {
  const method = String(req.body.method || '').trim().toLowerCase();
  if (!METHODS[method]) throw new AppError('Selecione a forma de pagamento: Pix ou boleto.');

  const emAberto = await model.findOpenRequest(req.tenantId);
  if (emAberto) {
    throw new AppError(
      `Já existe uma solicitação em andamento (${REQUEST_STATUS_LABEL[emAberto.status]}). Nossa equipe entrará em contato.`,
      409,
    );
  }

  const { assinatura, pagamento } = await garantirCobranca(req.tenantId, method);

  const solicitacao = await model.createRequest(req.tenantId, {
    paymentId: pagamento.id,
    userId: req.user.id,
    requesterName: req.user.name || req.user.nome || null,
    requesterEmail: req.user.email || null,
    method,
    planName: assinatura.plan_name,
    amount: assinatura.monthly_price,
  });

  const destino = billingInbox();
  const email = destino
    ? await mailer.sendTemplate(
      'solicitacaoRenovacao',
      destino,
      {
        requestId: solicitacao.id,
        companyName: assinatura.company_name,
        document: assinatura.document,
        contactEmail: assinatura.billing_email || assinatura.email,
        requesterName: solicitacao.requester_name,
        requesterEmail: solicitacao.requester_email,
        method: METHODS[method],
        planName: assinatura.plan_name,
        amount: assinatura.monthly_price,
        dueDate: assinatura.next_due_date,
        createdAt: solicitacao.created_at,
      },
      req.tenantId,
    )
    : { sent: false, reason: 'sem_destinatario' };

  res.status(201).json({
    ...solicitacao,
    status_label: REQUEST_STATUS_LABEL[solicitacao.status],
    email_enviado: Boolean(email.sent),
    message: 'Solicitação enviada com sucesso. Nossa equipe do Kuba Tech entrará em contato com as informações para pagamento.',
  });
}

/** PUT /billing/plan — upgrade ou downgrade do plano contratado. */
async function changePlan(req, res) {
  const planId = String(req.body.planId || '').trim();
  if (!isValidUUID(planId)) throw new AppError('Selecione um plano válido.');

  const plano = await model.findPlan(planId);
  if (!plano) throw new AppError('Plano não encontrado.', 404);

  const atual = await model.findSubscription(req.tenantId);
  if (atual && atual.plan_id === planId) throw new AppError('Esta empresa já utiliza este plano.');

  const tenant = await model.changePlan(req.tenantId, planId);
  if (!tenant) throw new AppError('Empresa não encontrada.', 404);

  const tipo = atual && Number(plano.monthly_price) > Number(atual.monthly_price) ? 'Upgrade' : 'Downgrade';
  res.json({ message: `${tipo} realizado: plano ${plano.name}.`, plano });
}

module.exports = {
  subscription,
  plans,
  payments,
  requests,
  requestRenewal,
  changePlan,
  garantirCobranca,
  REQUEST_STATUS_LABEL,
  METHODS,
  billingInbox,
};
