// Módulo Portal do Cliente — rota pública de acompanhamento da O.S.
const express = require('express');
const controller = require('./portal.controller');
const { asyncHandler } = require('../../shared/http');

const router = express.Router();

// Pública: a própria consulta exige número da O.S. + CPF do cliente,
// e o modelo só retorna dados de empresas ativas com o módulo contratado.
router.post('/consulta', asyncHandler(controller.lookup));

module.exports = router;
