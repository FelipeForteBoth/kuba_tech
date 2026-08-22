// Consultas auxiliares: CNPJ (Receita), CEP (ViaCEP) e geocodificação (Mapbox).
const { AppError } = require('../../shared/http');
const { lookupCNPJ, lookupCPF } = require('../../shared/documents');
const { lookupCEP, geocode, buildAddress } = require('../../shared/geo');

async function cnpj(req, res) {
  const result = await lookupCNPJ(req.params.cnpj);
  if (!result.valid) throw new AppError(result.reason || 'CNPJ inválido.');
  res.json(result);
}

async function cpf(req, res) {
  const result = await lookupCPF(req.params.cpf);
  if (!result.valid) throw new AppError(result.reason || 'CPF inválido.');
  res.json(result);
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
