// Módulo Meu Plano — consulta do plano contratado e solicitações
// comerciais de alteração (tratadas manualmente pela equipe Kuba Tech).
const express = require('express');
const controller = require('./plan.controller');
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
