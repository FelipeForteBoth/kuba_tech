// Módulo Clientes — regras de negócio.
// Pessoa Física (CPF) e Pessoa Jurídica (CNPJ) com validação em duas camadas.
const model = require('./customer.model');
const { AppError } = require('../../shared/http');
const {
  isValidPhone, isValidEmail, isValidName, isValidUUID,
  formatCPF, formatCNPJ, normalizePhone, formatPhone,
} = require('../../shared/validators');
const { onlyDigits, isValidCPFDigits, isValidCNPJDigits, cpfExistenceCheck, lookupCNPJ } = require('../../shared/documents');

async function index(req, res) {
  const search = String(req.query.search || '').trim();
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json(await model.list(req.tenantId, search, { limit, offset }));
}

async function show(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const customer = await model.findById(req.tenantId, req.params.id);
  if (!customer) throw new AppError('Cliente não encontrado.', 404);
  res.json(customer);
}

function optionalText(value, max = 255) {
  const v = String(value || '').trim();
  return v ? v.slice(0, max) : null;
}

async function validateDocument(body) {
  const documentType = String(body.documentType || 'CPF').trim().toUpperCase();
  if (!['CPF', 'CNPJ'].includes(documentType)) throw new AppError('Selecione o tipo de documento (CPF ou CNPJ).');
  const digits = onlyDigits(body.documentNumber || body.cpf || body.cnpj);

  if (documentType === 'CPF') {
    if (digits.length !== 11) throw new AppError('CPF inválido. Informe os 11 números.');
    if (!isValidCPFDigits(digits)) throw new AppError('CPF inválido: os dígitos verificadores não conferem.');
    const check = cpfExistenceCheck(digits);
    if (!check.valid) throw new AppError(check.reason);
    return { documentType, documentNumber: formatCPF(digits), companyName: null };
  }

  if (digits.length !== 14) throw new AppError('CNPJ inválido. Informe os 14 números.');
  if (!isValidCNPJDigits(digits)) throw new AppError('CNPJ inválido: os dígitos verificadores não conferem.');
  const consulta = await lookupCNPJ(digits);
  if (!consulta.valid) throw new AppError(consulta.reason || 'CNPJ inexistente.');
  const companyName = optionalText(body.companyName) || (consulta.data && consulta.data.razaoSocial) || null;
  if (!companyName) throw new AppError('Informe a razão social da empresa.');
  return { documentType, documentNumber: formatCNPJ(digits), companyName, receita: consulta.data || null };
}

function validateContact(body, documentType) {
  const name = String(body.name || '').trim();
  const phoneInput = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  if (documentType === 'CPF') {
    if (!isValidName(name)) throw new AppError('Informe o nome completo (nome e sobrenome), apenas letras.');
  } else if (name.length < 3) {
    throw new AppError('Informe o nome do contato ou nome fantasia (mínimo de 3 caracteres).');
  }
  if (!isValidPhone(phoneInput)) throw new AppError('Telefone inválido. Use o formato (00) 00000-0000.');
  if (!isValidEmail(email)) throw new AppError('E-mail inválido.');
  return { name, email, phone: formatPhone(normalizePhone(phoneInput)) };
}

// Dados cadastrais mantidos apenas para compatibilidade histórica.
// Data de abertura e CNAE não fazem mais parte do cadastro de CNPJ.
function publicFields(body) {
  return {
    tradeName: optionalText(body.tradeName, 150),
    cnae: null,
    openingDate: null,
  };
}

function addressFields(body) {
  const address = optionalText(body.address, 255);
  const number = optionalText(body.addressNumber, 20);
  const complement = optionalText(body.addressComplement, 255);
  if (address && !number) throw new AppError('Informe o número do endereço. Se não existir, informe SN.');
  return {
    zipCode: optionalText(body.zipCode, 10),
    address,
    addressNumber: number,
    addressComplement: complement,
    neighborhood: optionalText(body.neighborhood, 100),
    city: optionalText(body.city, 100),
    state: optionalText(body.state, 50),
  };
}

async function store(req, res) {
  const doc = await validateDocument(req.body);
  const contact = validateContact(req.body, doc.documentType);
  const address = addressFields(req.body);
  const publicos = publicFields(req.body);
  if (await model.findByDocument(req.tenantId, doc.documentNumber)) {
    throw new AppError(`Já existe um cliente com este ${doc.documentType} nesta empresa.`, 409);
  }
  const created = await model.create(req.tenantId, {
    documentType: doc.documentType, documentNumber: doc.documentNumber, companyName: doc.companyName,
    ...contact, ...address, ...publicos,
  });
  res.status(201).json(created);
}

async function update(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const current = await model.findById(req.tenantId, req.params.id);
  if (!current) throw new AppError('Cliente não encontrado.', 404);
  const contact = validateContact(req.body, current.document_type || 'CPF');
  const address = addressFields(req.body);
  const companyName = current.document_type === 'CNPJ'
    ? (optionalText(req.body.companyName) || current.company_name)
    : null;
  const publicos = publicFields(req.body);
  const customer = await model.update(req.tenantId, req.params.id, { ...contact, ...address, ...publicos, companyName });
  res.json(customer);
}

async function destroy(req, res) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Cliente não encontrado.', 404);
  res.json({ message: 'Cliente excluído com sucesso.' });
}

module.exports = { index, show, store, update, destroy };
