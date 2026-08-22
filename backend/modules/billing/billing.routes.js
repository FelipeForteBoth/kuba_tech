// Módulo Assinatura — rotas de plano, mensalidade e pagamentos.
// O webhook do Mercado Pago é público (chamado pelo gateway).
const express = require('express');
const controller = require('./billing.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();
const onlyAdmin = authorize(ROLES.COMPANY_ADMIN);

// Rota pública: confirmação automática de pagamento.
router.post('/webhook', asyncHandler(controller.webhook));

router.use(authenticate, tenantScope);

router.get('/subscription', asyncHandler(controller.subscription));
router.get('/plans', asyncHandler(controller.plans));
router.get('/payments', asyncHandler(controller.payments));
router.post('/checkout', onlyAdmin, asyncHandler(controller.checkout));
router.put('/plan', onlyAdmin, asyncHandler(controller.changePlan));

module.exports = router;
