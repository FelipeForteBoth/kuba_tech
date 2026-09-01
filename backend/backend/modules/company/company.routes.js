// Módulo Empresa — rotas de configuração da empresa contratante.
const express = require('express');
const controller = require('./company.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { requireModule } = require('../../middleware/modules');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate, tenantScope);

router.get('/settings', asyncHandler(controller.settings));

// Prazo padrão (SLA): exige o módulo "sla" no plano contratado.
router.put(
  '/settings/sla',
  requireModule('sla'),
  authorize(ROLES.COMPANY_ADMIN),
  asyncHandler(controller.updateSla),
);

module.exports = router;
