// Módulo Ordens de Serviço — rotas.
const express = require('express');
const controller = require('./serviceOrder.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate, tenantScope);

// Leitura: Administrador, Atendente, Técnico e Gestor (Técnico vê apenas as suas).
router.get('/', asyncHandler(controller.index));
router.get('/summary', asyncHandler(controller.summary));
router.get('/:id', asyncHandler(controller.show));

// Abertura e edição completa: Administrador e Atendente.
const canManage = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT);
router.post('/', canManage, asyncHandler(controller.store));
router.put('/:id', canManage, asyncHandler(controller.update));

// Andamento: também o Técnico responsável.
router.patch(
  '/:id/status',
  authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN),
  asyncHandler(controller.updateStatus),
);

// Prazo (SLA): apenas o Administrador da Empresa ajusta.
router.patch('/:id/sla', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.updateSla));

router.delete('/:id', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.destroy));

module.exports = router;
