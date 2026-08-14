// Rotas de consulta a bases públicas (todas exigem sessão autenticada).
const express = require('express');
const controller = require('./lookup.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/http');

const router = express.Router();
router.use(authenticate);

router.get('/cnpj/:cnpj', asyncHandler(controller.cnpj));
router.get('/cpf/:cpf', asyncHandler(controller.cpf));
router.get('/cep/:cep', asyncHandler(controller.cep));
router.post('/geocode', asyncHandler(controller.coordinates));

module.exports = router;
