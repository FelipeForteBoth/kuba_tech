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

// Leitura: Administrador, Atendente, Técnico e Gestor (Técnico vê apenas as suas).
router.get('/', asyncHandler(controller.index));
router.get('/summary', asyncHandler(controller.summary));
router.get('/:id', asyncHandler(controller.show));
router.get('/:id/history', asyncHandler(controller.history));

// Abertura e edição completa: Administrador e Atendente.
const canManage = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT);
const canOperate = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN);

router.post('/', canManage, asyncHandler(controller.store));
router.put('/:id', canManage, asyncHandler(controller.update));

// Programação do atendimento (núcleo do fluxo — disponível em todos os planos).
router.patch('/:id/schedule', canOperate, asyncHandler(controller.schedule));

// Andamento: também o Técnico responsável.
router.patch('/:id/status', canOperate, asyncHandler(controller.updateStatus));

// Evidências fotográficas (módulo contratado).
router.get('/:id/photos', requireModule(MODULES.PHOTOS), asyncHandler(controller.listPhotos));
router.post('/:id/photos', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.addPhotos));
router.delete('/:id/photos/:imageId', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.removePhoto));

// Assinatura digital (módulo contratado).
router.get('/:id/signature', requireModule(MODULES.SIGNATURE), asyncHandler(controller.getSignature));
router.post('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.saveSignature));
router.delete('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.deleteSignature));

// Prazo (SLA): apenas o Administrador da Empresa ajusta.
router.patch(
  '/:id/sla',
  requireModule(MODULES.SLA),
  authorize(ROLES.COMPANY_ADMIN),
  asyncHandler(controller.updateSla),
);

router.delete('/:id', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.destroy));

module.exports = router;
