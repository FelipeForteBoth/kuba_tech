// ──────────────────────────────────────────────────────────
// Validadores compartilhados pelas rotas do backend.
// Garantem que nenhum dado incompleto, mal formatado ou
// inválido chegue ao banco, mesmo que o front-end seja
// contornado (ex.: chamada direta à API via Postman/curl).
//
// IMPORTANTE: os validadores aceitam o CPF e o telefone tanto
// formatados (000.000.000-00 / (00) 00000-0000) quanto apenas
// com os dígitos. Isso evita falsos negativos quando o valor
// chega sem máscara (autofill do navegador, colagem de texto,
// preenchimento programático etc.) — o dado é normalizado e
// SEMPRE re-gravado no formato canônico antes de ir ao banco,
// então a consistência dos dados não é afetada.
// ──────────────────────────────────────────────────────────

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

// ── CPF ──

// Aceita "000.000.000-00" OU apenas os 11 dígitos.
// Retorna os 11 dígitos (string) se o formato for aceitável, ou null.
function normalizeCPF(cpf) {
  if (typeof cpf !== 'string') return null;
  const trimmed = cpf.trim();
  const isMasked = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed);
  const isDigitsOnly = /^\d{11}$/.test(trimmed);
  if (!isMasked && !isDigitsOnly) return null;
  return onlyDigits(trimmed);
}

// Formata 11 dígitos no padrão canônico 000.000.000-00
function formatCPF(digits) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Valida apenas o FORMATO do CPF: 11 dígitos numéricos, com ou
// sem a máscara 000.000.000-00. Não verifica se os dígitos
// verificadores batem com o algoritmo da Receita Federal — ou
// seja, não exige que seja um CPF realmente existente, só que
// tenha a quantidade certa de números no formato certo.
function isValidCPF(cpf) {
  const digits = normalizeCPF(cpf);
  if (!digits) return false;
  // Camada 1: dígitos verificadores oficiais da Receita Federal.
  return require('./documents').isValidCPFDigits(digits);
}

// ── Telefone ──
// Aceita "(00) 0000-0000" / "(00) 00000-0000" OU apenas dígitos
// (10 para fixo, 11 para celular). Retorna os dígitos ou null.
function normalizePhone(phone) {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  const isMasked = /^\(\d{2}\) \d{4,5}-\d{4}$/.test(trimmed);
  const isDigitsOnly = /^\d{10,11}$/.test(trimmed);
  if (!isMasked && !isDigitsOnly) return null;
  const digits = onlyDigits(trimmed);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return digits;
}

function formatPhone(digits) {
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function isValidPhone(phone) {
  return normalizePhone(phone) !== null;
}

// ── E-mail ──
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ── Nome de pessoa ──
// Pelo menos nome + sobrenome, só letras/acentos/espaços/hífen/apóstrofo.
function isValidName(name) {
  if (typeof name !== 'string') return false;
  const v = name.trim();
  if (v.length < 3) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(v)) return false;
  // exige ao menos duas palavras (nome e sobrenome)
  return v.split(/\s+/).filter(Boolean).length >= 2;
}

// ── Texto genérico obrigatório (ex.: técnico, tipo de aparelho) ──
function isNonEmptyText(value, minLength = 2) {
  if (typeof value !== 'string') return false;
  return value.trim().length >= minLength;
}

// ── Serial / IMEI de dispositivo ──
// Letras, números, hífen e barra; tamanho mínimo para evitar "a", "1", etc.
function isValidSerial(serial) {
  if (typeof serial !== 'string') return false;
  const v = serial.trim();
  if (v.length < 4) return false;
  return /^[A-Za-z0-9/-]+$/.test(v);
}

// ── Data ──
// Precisa ser uma data real (YYYY-MM-DD) e não pode ser no futuro.
function isValidPastOrTodayDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

// ── CNPJ (documento da empresa contratante) ──
// Aceita "00.000.000/0000-00" ou apenas os 14 dígitos.
function normalizeCNPJ(cnpj) {
  if (typeof cnpj !== 'string') return null;
  const digits = onlyDigits(cnpj);
  return digits.length === 14 ? digits : null;
}

function formatCNPJ(digits) {
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function isValidCNPJ(cnpj) {
  const digits = normalizeCNPJ(cnpj);
  if (!digits) return false;
  return require('./documents').isValidCNPJDigits(digits);
}

// ── Razão social / nome fantasia ──
function isValidCompanyName(name) {
  if (typeof name !== 'string') return false;
  return name.trim().length >= 3;
}

// ── Senha ──
// Mínimo de 8 caracteres, com ao menos uma letra e um número.
function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 72) return false;
  return /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

// ── UUID (identificadores das entidades) ──
function isValidUUID(value) {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

// ── Data (YYYY-MM-DD) sem restrição de futuro ──
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
  return !Number.isNaN(new Date(dateStr + 'T00:00:00').getTime());
}

module.exports = {
  onlyDigits,
  normalizeCPF,
  formatCPF,
  isValidCPF,
  normalizePhone,
  formatPhone,
  isValidPhone,
  isValidEmail,
  isValidName,
  isNonEmptyText,
  isValidSerial,
  isValidPastOrTodayDate,
  isValidDate,
  normalizeCNPJ,
  formatCNPJ,
  isValidCNPJ,
  isValidCompanyName,
  isValidPassword,
  isValidUUID,
};

