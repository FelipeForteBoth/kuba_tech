// Módulo Equipamentos — rotas.
const express = require('express');
const controller = require('./device.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();
const canWrite = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT);

router.use(authenticate, tenantScope);

router.get('/', asyncHandler(controller.index));
router.get('/:id', asyncHandler(controller.show));
router.post('/', canWrite, asyncHandler(controller.store));
router.put('/:id', canWrite, asyncHandler(controller.update));
router.delete('/:id', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.destroy));

module.exports = router;
