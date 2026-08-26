// Módulo Assinatura — rotas de plano, mensalidade e solicitações
// manuais de pagamento (Pix / boleto). Não há webhook de gateway.
const express = require('express');
const controller = require('./billing.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();
const onlyAdmin = authorize(ROLES.COMPANY_ADMIN);

router.use(authenticate, tenantScope);

router.get('/subscription', asyncHandler(controller.subscription));
router.get('/plans', asyncHandler(controller.plans));
router.get('/payments', asyncHandler(controller.payments));
router.get('/requests', asyncHandler(controller.requests));
router.post('/renewal-request', onlyAdmin, asyncHandler(controller.requestRenewal));
router.put('/plan', onlyAdmin, asyncHandler(controller.changePlan));

module.exports = router;
