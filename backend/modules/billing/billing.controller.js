// ─────────────────────────────────────────────────────────────
// Módulo Assinatura — regras de negócio de planos e mensalidades.
// Pagamento pela API oficial do Mercado Pago (Checkout Pro) e
// confirmação automática via webhook.
// ─────────────────────────────────────────────────────────────
const model = require('./billing.model');
const { AppError } = require('../../shared/http');
const { isValidUUID } = require('../../shared/validators');
const mp = require('../../shared/mercadopago');
const mailer = require('../../shared/mailer');

/** GET /billing/subscription — plano atual, valor e situação. */
async function subscription(req, res) {
  const data = await model.findSubscription(req.tenantId);
  if (!data) throw new AppError('Empresa não encontrada.', 404);
  const pendente = await model.findOpenPayment(req.tenantId);
  res.json({ ...data, pagamento_pendente: pendente || null, gateway: mp.isEnabled() ? 'mercadopago' : 'demo' });
}

/** GET /billing/plans — planos disponíveis para upgrade/downgrade. */
async function plans(_req, res) {
  res.json(await model.listPlans());
}

/** GET /billing/payments — histórico de pagamentos da empresa. */
async function payments(req, res) {
  res.json(await model.listPayments(req.tenantId));
}

/** Cria (ou reaproveita) a cobrança em aberto e devolve o link de pagamento. */
async function gerarCobranca(tenantId) {
  const assinatura = await model.findSubscription(tenantId);
  if (!assinatura) throw new AppError('Empresa não encontrada.', 404);
  if (!assinatura.plan_id) throw new AppError('A empresa não possui um plano contratado.');

  const aberta = await model.findOpenPayment(tenantId);
  if (aberta && aberta.checkout_url) return { assinatura, pagamento: aberta };

  const pagamento = aberta || (await model.createPayment(tenantId, {
    planId: assinatura.plan_id,
    planName: assinatura.plan_name,
    amount: assinatura.monthly_price,
    dueDate: assinatura.next_due_date,
  }));

  const checkout = await mp.createPreference({
    paymentId: pagamento.id,
    planName: assinatura.plan_name,
    amount: assinatura.monthly_price,
    payerEmail: assinatura.billing_email || assinatura.email,
    companyName: assinatura.company_name,
  });

  const atualizado = await model.attachCheckout(pagamento.id, {
    preferenceId: checkout.preferenceId,
    checkoutUrl: checkout.checkoutUrl,
    externalId: null,
  });

  return { assinatura, pagamento: atualizado, demo: checkout.demo };
}

/** POST /billing/checkout — gera a cobrança da mensalidade. */
async function checkout(req, res) {
  const { pagamento, demo } = await gerarCobranca(req.tenantId);
  res.status(201).json({
    ...pagamento,
    message: demo
      ? 'Cobrança registrada. Configure MP_ACCESS_TOKEN para gerar o link do Mercado Pago.'
      : 'Cobrança gerada com sucesso.',
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

/**
 * POST /billing/webhook — notificação do Mercado Pago (rota pública).
 * Confirma o pagamento, reativa a assinatura e dispara o e-mail.
 */
async function webhook(req, res) {
  const tipo = req.body.type || req.body.topic || req.query.type;
  const paymentId = (req.body.data && req.body.data.id) || req.query['data.id'] || req.body.id;

  // Responde 200 sempre: o Mercado Pago reenvia notificações com erro.
  res.json({ received: true });
  if (tipo !== 'payment' || !paymentId) return;

  try {
    const dados = await mp.getPayment(paymentId);
    if (!dados) return;

    const referencia = dados.external_reference;
    const registro = referencia && isValidUUID(referencia)
      ? await model.findPayment(referencia)
      : await model.findPaymentByExternal(String(paymentId));
    if (!registro) return;

    if (dados.status !== 'approved') {
      if (registro.status === 'pending') await model.updatePaymentStatus(registro.id, dados.status || 'pending');
      return;
    }

    const confirmado = await model.approvePayment(registro.id, String(paymentId));
    if (!confirmado) return;

    const assinatura = await model.findSubscription(confirmado.tenant.id);
    await mailer.sendTemplate(
      'pagamentoAprovado',
      assinatura.billing_email || assinatura.email,
      {
        companyName: assinatura.company_name,
        planName: assinatura.plan_name,
        amount: confirmado.payment.amount,
        paidAt: confirmado.payment.paid_at,
        nextDueDate: assinatura.next_due_date,
      },
      assinatura.id,
    );
  } catch (error) {
    console.error('Falha ao processar webhook do Mercado Pago:', error.message);
  }
}

module.exports = { subscription, plans, payments, checkout, changePlan, webhook, gerarCobranca };
