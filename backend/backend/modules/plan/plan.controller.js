// Módulo Plano — regras de negócio.
// Visualização do plano contratado e solicitação de alteração.
// Nenhum pagamento é processado pela plataforma: a solicitação é
// encaminhada à equipe Kuba Tech, que negocia fora do sistema.
const model = require('./plan.model');
const mailer = require('../../shared/mailer');
const { AppError } = require('../../shared/http');
const { isValidUUID } = require('../../shared/validators');

const ADMIN_MAILBOX = process.env.PLATFORM_EMAIL || 'contato@kubatech.com.br';

const REQUEST_LABEL = {
  pending: 'Solicitação enviada',
  in_service: 'Em atendimento',
  done: 'Concluída',
  rejected: 'Recusada',
};

// GET /api/plan/subscription
async function subscription(req, res) {
  const data = await model.subscription(req.tenantId);
  if (!data) throw new AppError('Empresa não encontrada.', 404);
  const aberta = await model.openRequest(req.tenantId);
  res.json({
    ...data,
    solicitacao_aberta: aberta
      ? { ...aberta, status_label: REQUEST_LABEL[aberta.status] || aberta.status }
      : null,
  });
}

// GET /api/plan/plans
async function plans(_req, res) {
  res.json(await model.plans());
}

// GET /api/plan/requests
async function requests(req, res) {
  const rows = await model.listRequests(req.tenantId);
  res.json(rows.map((r) => ({ ...r, status_label: REQUEST_LABEL[r.status] || r.status })));
}

// POST /api/plan/change-request — apenas o Administrador da Empresa
async function requestChange(req, res) {
  const atual = await model.subscription(req.tenantId);
  if (!atual) throw new AppError('Empresa não encontrada.', 404);

  if (await model.openRequest(req.tenantId)) {
    throw new AppError('Já existe uma solicitação de alteração em andamento.', 409);
  }

  const desiredPlanId = String(req.body.desiredPlanId || '').trim();
  if (desiredPlanId && !isValidUUID(desiredPlanId)) throw new AppError('Plano desejado inválido.');

  const message = String(req.body.message || '').trim().slice(0, 1000);
  const catalogo = await model.plans();
  const desejado = catalogo.find((p) => p.id === desiredPlanId) || null;

  const solicitacao = await model.createRequest({
    tenantId: req.tenantId,
    userId: req.user.id,
    requesterName: req.user.name,
    requesterEmail: req.user.email,
    currentPlanId: atual.plan_id,
    desiredPlanId: desejado ? desejado.id : null,
    message: message || null,
  });

  const email = await mailer.sendTemplate(
    'solicitacaoPlano',
    ADMIN_MAILBOX,
    {
      companyName: atual.company_name,
      currentPlan: atual.plan_name,
      desiredPlan: desejado ? desejado.name : null,
      requesterName: req.user.name,
      requesterEmail: req.user.email,
      message,
    },
    req.tenantId,
  );

  res.status(201).json({
    message: email.sent
      ? 'Solicitação enviada. A equipe Kuba Tech entrará em contato.'
      : 'Solicitação registrada. A equipe Kuba Tech verá o pedido no painel da plataforma.',
    solicitacao: { ...solicitacao, status_label: REQUEST_LABEL[solicitacao.status] },
  });
}

module.exports = { subscription, plans, requests, requestChange, REQUEST_LABEL };
