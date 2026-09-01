// Módulo Agenda Técnica — rotas (plano com o módulo "schedule").
const express = require('express');
const controller = require('./schedule.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { requireModule } = require('../../middleware/modules');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate, tenantScope, requireModule('schedule'));

router.get('/', asyncHandler(controller.index));
router.patch(
  '/:id',
  authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT),
  asyncHandler(controller.update),
);

module.exports = router;
