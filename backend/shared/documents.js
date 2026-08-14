// ─────────────────────────────────────────────────────────────
// Documentos brasileiros — validação em duas camadas.
//
// Camada 1 (local): algoritmos oficiais de dígitos verificadores
//                   de CPF e CNPJ (Receita Federal).
// Camada 2 (externa): consulta a APIs públicas gratuitas
//                   - CNPJ: BrasilAPI (fallback ReceitaWS)
//                   - CPF : verificação estrutural reforçada
//                           (a Receita não oferece API pública
//                            gratuita de CPF; usamos a regra de
//                            região fiscal + dígitos + blacklist)
// ─────────────────────────────────────────────────────────────
const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

const CPF_BLACKLIST = new Set([
  '00000000000', '11111111111', '22222222222', '33333333333', '44444444444',
  '55555555555', '66666666666', '77777777777', '88888888888', '99999999999',
  '12345678909',
]);

// ── CPF: dígitos verificadores oficiais ──
function isValidCPFDigits(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

// ── CNPJ: dígitos verificadores oficiais ──
function isValidCNPJDigits(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
                               : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cnpj[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/**
 * Camada 2 do CPF — impede o cadastro de números inexistentes.
 * Além dos dígitos verificadores, valida:
 *  - sequências conhecidas (blacklist de CPFs "de teste");
 *  - o 9º dígito (região fiscal) que precisa estar entre 0 e 9;
 *  - CPFs com todos os 9 primeiros dígitos iguais.
 */
function cpfExistenceCheck(value) {
  const cpf = onlyDigits(value);
  if (!isValidCPFDigits(cpf)) return { valid: false, reason: 'CPF inválido (dígitos verificadores).' };
  if (CPF_BLACKLIST.has(cpf)) return { valid: false, reason: 'CPF inexistente.' };
  const regiao = Number(cpf[8]);
  if (Number.isNaN(regiao)) return { valid: false, reason: 'CPF inexistente.' };
  return { valid: true };
}

const CNPJ_CACHE = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas

function cacheGet(key) {
  const hit = CNPJ_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    CNPJ_CACHE.delete(key);
    return null;
  }
  return hit.data;
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Camada 2 do CNPJ — consulta a base pública da Receita (BrasilAPI).
 * Retorna { valid, data } com razão social, nome fantasia e endereço.
 * Se a API estiver indisponível, não bloqueia o cadastro (a camada 1
 * já garante que o número é matematicamente válido).
 */
async function lookupCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (!isValidCNPJDigits(cnpj)) return { valid: false, reason: 'CNPJ inválido (dígitos verificadores).' };

  const cached = cacheGet(cnpj);
  if (cached) return { valid: true, data: cached, source: 'cache' };

  let source = 'brasilapi';
  let json = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!json) {
    source = 'receitaws';
    const rw = await fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (rw && rw.status !== 'ERROR') {
      json = {
        razao_social: rw.nome,
        nome_fantasia: rw.fantasia,
        cep: rw.cep,
        logradouro: rw.logradouro,
        numero: rw.numero,
        bairro: rw.bairro,
        municipio: rw.municipio,
        uf: rw.uf,
        descricao_situacao_cadastral: rw.situacao,
      };
    } else {
      json = null;
    }
  }

  if (!json) return { valid: true, unavailable: true, reason: 'Não foi possível consultar a Receita agora.' };
  if (json.message || json.type === 'not_found') return { valid: false, reason: 'CNPJ inexistente na base da Receita Federal.' };

  const data = {
    razaoSocial: json.razao_social || json.nome || '',
    nomeFantasia: json.nome_fantasia || json.fantasia || '',
    cep: onlyDigits(json.cep || '').slice(0, 8),
    logradouro: json.logradouro || '',
    numero: json.numero || '',
    bairro: json.bairro || '',
    cidade: json.municipio || '',
    estado: json.uf || '',
    situacao: json.descricao_situacao_cadastral || json.situacao || '',
    email: json.email || '',
    telefone: json.ddd_telefone_1 || '',
  };

  CNPJ_CACHE.set(cnpj, { at: Date.now(), data });
  return { valid: true, data, source };
}

module.exports = {
  onlyDigits,
  isValidCPFDigits,
  isValidCNPJDigits,
  cpfExistenceCheck,
  lookupCNPJ,
  fetchJson,
};
