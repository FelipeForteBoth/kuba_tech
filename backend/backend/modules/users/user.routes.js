// Módulo Usuários — rotas (restritas ao Administrador da Empresa, exceto leituras auxiliares).
const express = require('express');
const controller = require('./user.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { asyncHandler } = require('../../shared/http');
const { ROLES } = require('../../config/roles');

const router = express.Router();
const adminOnly = authorize(ROLES.COMPANY_ADMIN);

router.use(authenticate, tenantScope);

// Auxiliar para a tela de abertura de O.S.
router.get('/roles', controller.roles);
router.get('/technicians', asyncHandler(controller.technicians));

router.get('/', adminOnly, asyncHandler(controller.index));
router.get('/:id', adminOnly, asyncHandler(controller.show));
router.post('/', adminOnly, asyncHandler(controller.store));
router.put('/:id', adminOnly, asyncHandler(controller.update));
router.put('/:id/password', adminOnly, asyncHandler(controller.resetPassword));
router.delete('/:id', adminOnly, asyncHandler(controller.destroy));

module.exports = router;
