// Módulo Auth — rotas.
const express = require('express');
const controller = require('./auth.controller');
const reset = require('./passwordReset.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/http');

const router = express.Router();

// Públicas
router.post('/register', asyncHandler(controller.registerCompany));
router.post('/login', asyncHandler(controller.login));

// Recuperação de senha (aprovação hierárquica)
router.post('/forgot-password', asyncHandler(reset.forgot));
router.get('/reset-password/:token', asyncHandler(reset.checkToken));
router.post('/reset-password', asyncHandler(reset.reset));

// Autenticadas
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/refresh', authenticate, asyncHandler(controller.refresh));
router.put('/password', authenticate, asyncHandler(controller.changePassword));

// Fila de aprovação de recuperação de senha (Adm. da Empresa / Plataforma)
router.get('/password-requests', authenticate, asyncHandler(reset.list));
router.post('/password-requests/:id/approve', authenticate, asyncHandler(reset.approve));
router.post('/password-requests/:id/reject', authenticate, asyncHandler(reset.reject));

module.exports = router;
