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
router.get('/modules', asyncHandler(controller.modules));
router.get('/tenants', asyncHandler(controller.tenants));
router.post('/tenants', asyncHandler(controller.store));
router.get('/tenants/:id', asyncHandler(controller.tenant));
router.patch('/tenants/:id/status', asyncHandler(controller.updateStatus));
router.patch('/tenants/:id/plan', asyncHandler(controller.changePlan));
router.post('/tenants/:id/charge', asyncHandler(controller.charge));
router.get('/tenants/:id/emails', asyncHandler(controller.emails));
router.delete('/tenants/:id', asyncHandler(controller.destroy));

module.exports = router;
