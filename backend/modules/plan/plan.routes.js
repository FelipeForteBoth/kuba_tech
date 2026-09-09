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
router.get('/requests', asyncHandler(controller.requests));

// Solicitação comercial de alteração de plano (tratada pela Kuba Tech).
router.post('/change-request', onlyAdmin, asyncHandler(controller.requestChange));

module.exports = router;
