// Módulo Ordens de Serviço — rotas.
const express = require('express');
const controller = require('./serviceOrder.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { requireModule } = require('../../middleware/modules');
const { asyncHandler } = require('../../shared/http');
const { ROLES, MODULES } = require('../../config/roles');

const router = express.Router();
router.use(authenticate, tenantScope);
router.get('/', asyncHandler(controller.index));
router.get('/summary', asyncHandler(controller.summary));
router.get('/:id', asyncHandler(controller.show));
router.get('/:id/history', asyncHandler(controller.history));
const canManage = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT);
const canOperate = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN);
router.post('/', canManage, asyncHandler(controller.store));
router.put('/:id', canManage, asyncHandler(controller.update));
router.patch('/:id/schedule', canOperate, asyncHandler(controller.schedule));
router.patch('/:id/status', canOperate, asyncHandler(controller.updateStatus));
// A criação/alteração continua limitada ao módulo contratado.
// A leitura histórica permanece disponível em O.S. finalizadas mesmo após downgrade.
router.get('/:id/photos', asyncHandler(controller.listPhotos));
router.post('/:id/photos', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.addPhotos));
router.delete('/:id/photos/:imageId', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.removePhoto));
router.get('/:id/signature', asyncHandler(controller.getSignature));
router.post('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.saveSignature));
router.delete('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.deleteSignature));
router.patch('/:id/sla', requireModule(MODULES.SLA), authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.updateSla));
router.delete('/:id', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.destroy));
module.exports = router;
