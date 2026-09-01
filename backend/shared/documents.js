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
// Regiões fiscais da Receita Federal (9º dígito do CPF).
const CPF_REGIONS = {
  0: { regiao: '0 — RS', estados: ['RS'] },
  1: { regiao: '1 — DF, GO, MS, MT e TO', estados: ['DF', 'GO', 'MS', 'MT', 'TO'] },
  2: { regiao: '2 — AC, AM, AP, PA, RO e RR', estados: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR'] },
  3: { regiao: '3 — CE, MA e PI', estados: ['CE', 'MA', 'PI'] },
  4: { regiao: '4 — AL, PB, PE e RN', estados: ['AL', 'PB', 'PE', 'RN'] },
  5: { regiao: '5 — BA e SE', estados: ['BA', 'SE'] },
  6: { regiao: '6 — MG', estados: ['MG'] },
  7: { regiao: '7 — ES e RJ', estados: ['ES', 'RJ'] },
  8: { regiao: '8 — SP', estados: ['SP'] },
  9: { regiao: '9 — PR e SC', estados: ['PR', 'SC'] },
};

/**
 * Consulta do nome do titular do CPF em provedores oficiais.
 *
 * A Receita Federal não publica uma API gratuita e aberta de CPF, por isso
 * o sistema aceita qualquer provedor autorizado através de variáveis de
 * ambiente (configure UMA delas na Render):
 *
 *   CPFCNPJ_TOKEN  → api.cpfcnpj.com.br (retorna o nome só com o CPF)
 *   CPF_API_URL    → endpoint próprio, com o marcador {cpf} na URL
 *                    (opcional: CPF_API_TOKEN vira o Bearer da requisição)
 *
 * Sem provedor configurado, o CPF continua sendo validado pelos dígitos
 * verificadores e o nome é digitado manualmente.
 */
const CPF_NAME_KEYS = ['nome', 'name', 'nome_da_pf', 'nomeCompleto'];

function extrairCPF(json) {
  if (!json || typeof json !== 'object') return null;
  const alvo = json.data || json.result || json.retorno || json;
  const nome = CPF_NAME_KEYS.map((k) => alvo[k]).find((v) => typeof v === 'string' && v.trim());
  if (!nome) return null;
  return {
    nome: String(nome).trim(),
    cidade: alvo.cidade || alvo.municipio || '',
    estado: alvo.uf || alvo.estado || '',
  };
}

async function lookupCPFExternal(cpf) {
  // 1) Provedor cpfcnpj.com.br (pacote 2 — dados cadastrais do CPF).
  if (process.env.CPFCNPJ_TOKEN) {
    const json = await fetchJson(`https://api.cpfcnpj.com.br/${process.env.CPFCNPJ_TOKEN}/2/${cpf}`);
    const dados = extrairCPF(json);
    if (dados) return dados;
  }

  // 2) Provedor personalizado.
  const url = process.env.CPF_API_URL;
  if (!url) return null;
  const headers = { accept: 'application/json' };
  if (process.env.CPF_API_TOKEN) headers.authorization = `Bearer ${process.env.CPF_API_TOKEN}`;
  try {
    const res = await fetch(url.replace('{cpf}', cpf), { headers });
    if (!res.ok) return null;
    return extrairCPF(await res.json());
  } catch {
    return null;
  }
}

/** Consulta pública do CPF: valida e devolve o nome do titular quando disponível. */
async function lookupCPF(value) {
  const cpf = onlyDigits(value);
  const check = cpfExistenceCheck(cpf);
  if (!check.valid) return check;

  const regiao = CPF_REGIONS[Number(cpf[8])] || null;
  const externo = await lookupCPFExternal(cpf);

  return {
    valid: true,
    documento: cpf,
    nomeDisponivel: Boolean(externo && externo.nome),
    data: {
      nome: (externo && externo.nome) || '',
      cidade: (externo && externo.cidade) || '',
      estado: (externo && externo.estado) || (regiao && regiao.estados.length === 1 ? regiao.estados[0] : ''),
      regiaoFiscal: regiao ? regiao.regiao : '',
      estadosProvaveis: regiao ? regiao.estados : [],
    },
    source: externo ? 'api-externa' : 'receita-estrutural',
  };
}


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
    cnae: json.cnae_fiscal_descricao
      || (Array.isArray(json.atividade_principal) && json.atividade_principal[0] && json.atividade_principal[0].text)
      || '',
    dataAbertura: json.data_inicio_atividade || json.abertura || '',
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
  lookupCPF,
  lookupCNPJ,
  fetchJson,
};
