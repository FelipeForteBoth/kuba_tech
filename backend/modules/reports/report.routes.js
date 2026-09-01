// Módulo Relatórios — rotas (disponível nos planos com o módulo "reports").
const express = require('express');
const controller = require('./report.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { requireModule } = require('../../middleware/modules');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(
  authenticate,
  tenantScope,
  requireModule('reports'),
  authorize(ROLES.COMPANY_ADMIN, ROLES.MANAGER),
);

router.get('/overview', asyncHandler(controller.overview));
router.get('/export', asyncHandler(controller.exportCsv));

module.exports = router;
