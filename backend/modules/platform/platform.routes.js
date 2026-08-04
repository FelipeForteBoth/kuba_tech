// Módulo Plataforma — rotas (exclusivas do Administrador da Plataforma).
const express = require('express');
const controller = require('./platform.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate, authorize(ROLES.PLATFORM_ADMIN));

router.get('/metrics', asyncHandler(controller.metrics));
router.get('/plans', asyncHandler(controller.plans));
router.get('/tenants', asyncHandler(controller.tenants));
router.get('/tenants/:id', asyncHandler(controller.tenant));
router.patch('/tenants/:id/status', asyncHandler(controller.updateStatus));
router.patch('/tenants/:id/plan', asyncHandler(controller.changePlan));

module.exports = router;
