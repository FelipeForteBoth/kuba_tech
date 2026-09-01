// Rotas de consulta a bases públicas (Receita/BrasilAPI e ViaCEP).
// As consultas usadas no cadastro de empresa (tela pública) ficam sob
// /public com limite de requisições; as demais exigem sessão.
const express = require('express');
const controller = require('./lookup.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/http');

const router = express.Router();

// Limite simples por IP para as consultas abertas (evita abuso).
const HITS = new Map();
function rateLimit(req, res, next) {
  const chave = req.ip || 'anon';
  const agora = Date.now();
  const registro = HITS.get(chave);
  if (!registro || agora > registro.reset) {
    HITS.set(chave, { count: 1, reset: agora + 60000 });
    return next();
  }
  registro.count += 1;
  if (registro.count > 30) {
    return res.status(429).json({ error: 'Muitas consultas seguidas. Aguarde um minuto.' });
  }
  next();
}

// Consultas abertas usadas no cadastro de empresa (sem sessão).
router.get('/public/cnpj/:cnpj', rateLimit, asyncHandler(controller.cnpj));
router.get('/public/cep/:cep', rateLimit, asyncHandler(controller.cep));

router.use(authenticate);

router.get('/cnpj/:cnpj', asyncHandler(controller.cnpj));
router.get('/cpf/:cpf', asyncHandler(controller.cpf));
router.get('/cep/:cep', asyncHandler(controller.cep));
router.post('/geocode', asyncHandler(controller.coordinates));

module.exports = router;
