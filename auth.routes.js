// Módulo Auth — rotas.
const express = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/http');

const router = express.Router();

// Públicas
router.post('/register', asyncHandler(controller.registerCompany));
router.post('/login', asyncHandler(controller.login));

// Autenticadas
router.get('/me', authenticate, asyncHandler(controller.me));
router.put('/password', authenticate, asyncHandler(controller.changePassword));

module.exports = router;
