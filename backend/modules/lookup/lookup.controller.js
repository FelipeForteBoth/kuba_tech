// Consultas auxiliares: CNPJ (Receita), CEP (ViaCEP) e geocodificação (Mapbox).
const { AppError } = require('../../shared/http');
<<<<<<< HEAD
const { lookupCNPJ, lookupCPF } = require('../../shared/documents');
=======
const { lookupCNPJ, cpfExistenceCheck, onlyDigits } = require('../../shared/documents');
>>>>>>> 2d4a93d61ca1f6dbbb8d08174f869fa5963b3124
const { lookupCEP, geocode, buildAddress } = require('../../shared/geo');

async function cnpj(req, res) {
  const result = await lookupCNPJ(req.params.cnpj);
  if (!result.valid) throw new AppError(result.reason || 'CNPJ inválido.');
  res.json(result);
}

async function cpf(req, res) {
<<<<<<< HEAD
  const result = await lookupCPF(req.params.cpf);
  if (!result.valid) throw new AppError(result.reason || 'CPF inválido.');
  res.json(result);
=======
  const result = cpfExistenceCheck(req.params.cpf);
  if (!result.valid) throw new AppError(result.reason);
  res.json({ valid: true, documento: onlyDigits(req.params.cpf) });
>>>>>>> 2d4a93d61ca1f6dbbb8d08174f869fa5963b3124
}

async function cep(req, res) {
  const result = await lookupCEP(req.params.cep);
  if (!result.valid) throw new AppError(result.reason || 'CEP inválido.');
  res.json(result);
}

async function coordinates(req, res) {
  const coords = await geocode(buildAddress(req.body || {}));
  if (!coords) throw new AppError('Não foi possível localizar o endereço informado.', 404);
  res.json(coords);
}

module.exports = { cnpj, cpf, cep, coordinates };
