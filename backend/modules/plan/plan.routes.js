// Módulo Meu Plano — consulta do plano contratado e solicitações
// comerciais de alteração. A aplicação não processa pagamentos.
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

// Somente o Administrador da Empresa pode solicitar alteração de plano.
// A alteração efetiva é feita posteriormente pelo Administrador da Plataforma.
router.post('/change-request', onlyAdmin, asyncHandler(controller.requestChange));

module.exports = router;
