// ─────────────────────────────────────────────────────────────
// Kuba Tech — utilidades compartilhadas do front-end.
// Sessão, controle de acesso por perfil (RBAC), tema, máscaras,
// validações espelhadas do back-end e componentes de interface.
// ─────────────────────────────────────────────────────────────
// API_URL vem de config.js (carregado antes deste arquivo).

// ── SESSÃO ──
function getSession() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    return usuario ? { token, usuario } : null;
  } catch {
    return null;
  }
}

function setSession(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function currentUser() {
  const session = getSession();
  return session ? session.usuario : null;
}

function currentRole() {
  const user = currentUser();
  return user ? user.perfil : null;
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return { ...extra, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
}

// Wrapper de fetch que envia o token e trata sessão expirada / acesso negado.
async function authFetch(url, opts = {}) {
  const headers = authHeaders(opts.headers || {});
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/html/login.html';
    throw new Error('Não autenticado');
  }
  if (res.status === 403) {
    let message = 'Acesso negado para o seu perfil de usuário.';
    try {
      message = (await res.clone().json()).error || message;
    } catch {
      /* resposta sem corpo JSON */
    }
    if (typeof toast === 'function') toast(message, 'err');
  }
  return res;
}

function logout() {
  localStorage.clear();
  window.location.href = '/html/login.html';
}

// ── RBAC (espelha as regras aplicadas no back-end) ──
const ROLE_LABELS = {
  platform_admin: 'Administrador da Plataforma',
  company_admin: 'Administrador da Empresa',
  attendant: 'Atendente',
  technician: 'Técnico',
  manager: 'Gestor',
};

// Páginas públicas (sem sessão).
const PUBLIC_PAGES = ['login', 'cadastro', 'portal'];

// Páginas que cada perfil pode abrir.
const PAGE_ACCESS = {
  platform_admin: ['plataforma'],
  company_admin: ['index', 'clientes', 'dispositivos', 'os', 'usuarios', 'relatorios', 'agenda', 'assinatura'],
  attendant: ['index', 'clientes', 'dispositivos', 'os', 'agenda'],
  technician: ['index', 'os', 'agenda'],
  manager: ['index', 'clientes', 'dispositivos', 'os', 'relatorios'],
};

// Páginas que dependem de um módulo contratado no plano da empresa.
const PAGE_MODULES = {
  clientes: 'customers',
  dispositivos: 'devices',
  os: 'orders',
  usuarios: 'users',
  relatorios: 'reports',
  agenda: 'schedule',
};

// Perfis autorizados a criar/editar em cada módulo.
const WRITE_ACCESS = {
  customers: ['company_admin', 'attendant'],
  devices: ['company_admin', 'attendant'],
  orders: ['company_admin', 'attendant'],
  orderStatus: ['company_admin', 'attendant', 'technician'],
  users: ['company_admin'],
  companySettings: ['company_admin'],
  billing: ['company_admin'],
  schedule: ['company_admin', 'attendant'],
  photos: ['company_admin', 'attendant', 'technician'],
  signature: ['company_admin', 'attendant', 'technician'],
  reports: ['company_admin', 'manager'],
  tenants: ['platform_admin'],
};

const DELETE_ACCESS = ['company_admin'];

function can(action) {
  const role = currentRole();
  return Boolean(role && (WRITE_ACCESS[action] || []).includes(role));
}

function canDelete() {
  return DELETE_ACCESS.includes(currentRole());
}

// Módulos contratados pela empresa (vêm do login / GET /auth/me).
function currentModules() {
  const user = currentUser();
  return Array.isArray(user && user.modulos) ? user.modulos : [];
}

function hasModule(code) {
  if (!code) return true;
  const user = currentUser();
  if (!user) return false;
  if (user.perfil === 'platform_admin') return true;
  return currentModules().includes(code);
}

function homePageFor(role) {
  if (role === 'platform_admin') return '/html/plataforma.html';
  if (role === 'technician') return '/html/os.html';
  return '/html/index.html';
}

function currentPage() {
  return window.location.pathname.split('/').pop().replace('.html', '') || 'index';
}

/** Marca a interface como liberada (remove o bloqueio antiflash do CSS). */
function liberarInterface() {
  document.documentElement.setAttribute('data-access', 'ready');
}

/**
 * Controle de acesso executado na entrada de cada página.
 * Roda ANTES da primeira pintura (o CSS mantém a interface oculta até aqui):
 * módulos não contratados são removidos do DOM, nunca apenas escondidos,
 * eliminando o "flash" de itens que a empresa não possui.
 */
function enforceAccess() {
  const page = currentPage();
  if (PUBLIC_PAGES.includes(page)) {
    liberarInterface();
    return;
  }

  const session = getSession();
  if (!session) {
    window.location.href = '/html/login.html';
    return;
  }

  const role = session.usuario.perfil;
  const allowed = PAGE_ACCESS[role] || [];
  if (!allowed.includes(page) || !hasModule(PAGE_MODULES[page])) {
    window.location.href = homePageFor(role);
    return;
  }

  // Remove do menu tudo que o perfil não pode acessar ou que não está no plano.
  document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
    const visible = allowed.includes(el.dataset.page) && hasModule(PAGE_MODULES[el.dataset.page]);
    if (!visible) el.remove();
  });

  // Remove elementos que dependem de um módulo do plano.
  document.querySelectorAll('[data-module]').forEach((el) => {
    if (!hasModule(el.dataset.module)) el.remove();
  });

  // Remove ações de escrita para perfis somente leitura (ex.: Gestor).
  document.querySelectorAll('[data-requires]').forEach((el) => {
    if (!can(el.dataset.requires)) el.remove();
  });

  liberarInterface();
}

/**
 * Revalida no back-end os módulos contratados (o plano pode ter mudado
 * em outra sessão). Se a lista mudar, reaplica o controle de acesso.
 */
async function revalidarModulos() {
  const session = getSession();
  if (!session || session.usuario.perfil === 'platform_admin') return;
  try {
    const res = await authFetch(`${API_URL}/auth/me`);
    if (!res.ok) return;
    const dados = await res.json();
    const atual = JSON.stringify(currentModules());
    const novo = JSON.stringify(dados.modulos || []);
    if (atual === novo) return;
    setSession(session.token, { ...session.usuario, ...dados });
    enforceAccess();
  } catch {
    /* sem conexão: mantém o que já foi validado no login */
  }
}



// ── TEMA (claro / escuro) ──
const THEME_CSS = `
:root[data-theme="dark"] {
  --bg: #0b1220;
  --card: #111a2e;
  --text: #e2e8f0;
  --text-2: #94a3b8;
  --text-3: #64748b;
  --border: #1f2a44;
  --accent-light: #1e293b;
  --sh-sm: 0 1px 3px rgba(0,0,0,.4);
  --sh-md: 0 4px 12px rgba(0,0,0,.45);
  --sh-lg: 0 8px 30px rgba(0,0,0,.55);
}
:root[data-theme="dark"] body { background: var(--bg); color: var(--text); }
:root[data-theme="dark"] .btn-ghost { background: var(--card); color: var(--text-2); }
:root[data-theme="dark"] table, :root[data-theme="dark"] .card, :root[data-theme="dark"] .drawer,
:root[data-theme="dark"] .modal, :root[data-theme="dark"] input, :root[data-theme="dark"] select,
:root[data-theme="dark"] textarea { background: var(--card); color: var(--text); border-color: var(--border); }

/* Cabeçalho da tabela no dark: usa tom mais escuro e NÃO muda no hover */
:root[data-theme="dark"] thead tr,
:root[data-theme="dark"] thead tr:hover { background: #0f1830 !important; }
:root[data-theme="dark"] thead th { color: var(--text-2) !important; border-color: var(--border) !important; }

/* Hover só nas linhas do corpo */
:root[data-theme="dark"] tbody tr:hover { background: rgba(255,255,255,.04) !important; }

/* Rodapé / cabeçalho do drawer e botão de fechar */
:root[data-theme="dark"] .drawer-ft { background: #0f1830 !important; border-top-color: var(--border) !important; }
:root[data-theme="dark"] .drawer-hd { border-bottom-color: var(--border) !important; }
:root[data-theme="dark"] .drawer-x { background: #1e293b !important; color: var(--text-2) !important; }
:root[data-theme="dark"] .drawer-x:hover { background: #273449 !important; color: var(--text) !important; }

/* Caixas auxiliares que tinham fundo claro fixo */
:root[data-theme="dark"] .pre-box { background: #0f1830 !important; border-color: var(--border) !important; color: var(--text) !important; }
`;

function ensureThemeStyle() {
  if (document.getElementById('theme-style')) return;
  const s = document.createElement('style');
  s.id = 'theme-style';
  s.textContent = THEME_CSS;
  document.head.appendChild(s);
}

function applyTheme(theme) {
  ensureThemeStyle();
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('btn-theme');
  if (btn) {
    const isDark = theme === 'dark';
    btn.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
    btn.title = isDark ? 'Modo claro' : 'Modo escuro';
  }
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'light');
}

// ── BARRA SUPERIOR: identificação do usuário, tema e sair ──
function injectLogoutButton() {
  const navbar = document.querySelector('.navbar');
  if (!navbar || document.getElementById('btn-logout')) return;

  const user = currentUser();
  if (!user && PUBLIC_PAGES.includes(currentPage())) return; // páginas públicas: sem barra de sessão

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-left:auto;display:flex;gap:10px;align-items:center;';

  if (user) {
    const info = document.createElement('div');
    info.id = 'user-info';
    info.style.cssText = 'text-align:right;line-height:1.2;color:#fff;font-size:13px;';
    info.innerHTML = `<div style="font-weight:700;">${user.nome}</div>
      <div style="opacity:.8;font-size:11px;">${ROLE_LABELS[user.perfil] || ''}${user.empresa ? ' · ' + user.empresa : ''}</div>`;
    wrap.appendChild(info);
  }

  const themeBtn = document.createElement('button');
  themeBtn.id = 'btn-theme';
  themeBtn.style.cssText = 'background:#374151;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;';
  themeBtn.onclick = toggleTheme;

  const btn = document.createElement('button');
  btn.id = 'btn-logout';
  btn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600;';
  btn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Sair`;
  btn.onclick = logout;

  wrap.appendChild(themeBtn);
  wrap.appendChild(btn);
  navbar.appendChild(wrap);

  initTheme();
}

// ── ACTIVE NAV ──
function setActiveNav() {
  const page = currentPage();
  document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ── MENU TOGGLE ──
function initMenu() {
  const btn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mob-open');
    } else {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('full');
    }
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('mob-open') &&
        !sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('mob-open');
    }
  });
}

// ── DRAWER ──
function openDrawer() {
  document.getElementById('drawer').classList.add('on');
  document.getElementById('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('overlay').classList.remove('on');
  document.body.style.overflow = '';
}

function initDrawer() {
  const overlay = document.getElementById('overlay');
  const closeBtn = document.getElementById('drawer-x');
  if (overlay) overlay.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
}

// ── MÁSCARAS ──
function maskCPF(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return v;
}

function maskCNPJ(v) {
  v = v.replace(/\D/g, '').slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  return v;
}

function maskPhone(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  return v;
}

function applyMasks() {
  document.addEventListener('input', (e) => {
    if (e.target.dataset.mask === 'cpf') e.target.value = maskCPF(e.target.value);
    if (e.target.dataset.mask === 'cnpj') e.target.value = maskCNPJ(e.target.value);
    if (e.target.dataset.mask === 'phone') e.target.value = maskPhone(e.target.value);
  });
}

// ── VALIDAÇÕES ──
// Mesmas regras aplicadas no back-end, usadas aqui para dar feedback
// imediato ao usuário antes de enviar a requisição.

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeCPF(cpf) {
  if (typeof cpf !== 'string') return null;
  const trimmed = cpf.trim();
  const isMasked = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed);
  const isDigitsOnly = /^\d{11}$/.test(trimmed);
  if (!isMasked && !isDigitsOnly) return null;
  return onlyDigits(trimmed);
}

// Algoritmo oficial dos dígitos verificadores do CPF (Receita Federal).
function isValidCPF(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

// Algoritmo oficial dos dígitos verificadores do CNPJ.
function isValidCNPJ(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const w = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * w[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

// Valida CPF ou CNPJ conforme o tipo do documento selecionado.
function isValidDocument(value, type) {
  return String(type).toUpperCase() === 'CNPJ' ? isValidCNPJ(value) : isValidCPF(value);
}

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

function isValidPhone(phone) {
  return normalizePhone(phone) !== null;
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function isValidName(name) {
  if (typeof name !== 'string') return false;
  const v = name.trim();
  if (v.length < 3) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(v)) return false;
  return v.split(/\s+/).filter(Boolean).length >= 2;
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 72) return false;
  return /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

function isNonEmptyText(value, minLength = 2) {
  if (typeof value !== 'string') return false;
  return value.trim().length >= minLength;
}

function isValidSerial(serial) {
  if (typeof serial !== 'string') return false;
  const v = serial.trim();
  if (v.length < 4) return false;
  return /^[A-Za-z0-9/-]+$/.test(v);
}

function isValidPastOrTodayDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

// Evita injeção de HTML ao renderizar dados vindos do banco.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}



// ── ESTEIRA DA ORDEM DE SERVIÇO (v2) ──
const OS_STATUS = ['Aberto', 'Agendado', 'Em deslocamento', 'No local', 'Em execução',
  'Aguardando cliente', 'Finalizado', 'Entregue', 'Cancelado'];

const OS_STATUS_CLASS = {
  Aberto: 'badge-todo',
  Agendado: 'badge-prog',
  'Em deslocamento': 'badge-prog',
  'No local': 'badge-prog',
  'Em execução': 'badge-prog',
  'Aguardando cliente': 'badge-todo',
  Finalizado: 'badge-done',
  Entregue: 'badge-done',
  Cancelado: 'badge-del',
};

const OS_CLOSED = ['Finalizado', 'Entregue', 'Cancelado'];

function osBadge(status) {
  return `<span class="badge ${OS_STATUS_CLASS[status] || 'badge-todo'}">${esc(status)}</span>`;
}

// ── CONSULTAS A BASES PÚBLICAS (CNPJ / CEP) ──
async function consultarCNPJ(cnpj) {
  const res = await authFetch(`${API_URL}/lookup/cnpj/${onlyDigits(cnpj)}`);
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.error || 'CNPJ inválido.');
  return dados;
}

/** Consulta pública do CPF (validação + dados disponíveis). */
async function consultarCPF(cpf) {
  const res = await authFetch(`${API_URL}/lookup/cpf/${onlyDigits(cpf)}`);
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.error || 'CPF inválido.');
  return dados;
}

/** Consultas abertas (tela pública de cadastro de empresa). */
async function consultarCNPJPublico(cnpj) {
  const res = await fetch(`${API_URL}/lookup/public/cnpj/${onlyDigits(cnpj)}`);
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.error || 'CNPJ inválido.');
  return dados;
}

async function consultarCEPPublico(cep) {
  const res = await fetch(`${API_URL}/lookup/public/cep/${onlyDigits(cep)}`);
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.error || 'CEP inválido.');
  return dados;
}

async function consultarCEP(cep) {
  const res = await authFetch(`${API_URL}/lookup/cep/${onlyDigits(cep)}`);
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.error || 'CEP inválido.');
  return dados;
}

function maskCEP(v) {
  v = onlyDigits(v).slice(0, 8);
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
}



// ─────────────────────────────────────────────────────────────
// UX PADRONIZADA — mensagens de estado, botões ocupados e dicas
// ─────────────────────────────────────────────────────────────

/** Mensagem padrão de carregando / vazio / erro dentro de um container. */
function stateMsg(tipo = 'loading', texto = '') {
  const icones = { loading: 'spinner fa-spin', empty: 'inbox', error: 'triangle-exclamation' };
  const padrao = { loading: 'Carregando...', empty: 'Nenhum registro encontrado.', error: 'Não foi possível carregar agora.' };
  return `<div class="state-msg"><i class="fas fa-${icones[tipo] || 'inbox'}"></i>${esc(texto || padrao[tipo] || '')}</div>`;
}

/**
 * Evita cliques repetidos: desabilita o botão e mostra "processando"
 * enquanto a ação assíncrona não termina.
 */
async function runAction(btn, fn, textoOcupado = 'Aguarde...') {
  if (!btn) return fn();
  if (btn.dataset.busy === '1') return undefined;
  const original = btn.innerHTML;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.classList.add('is-busy');
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${esc(textoOcupado)}`;
  try {
    return await fn();
  } finally {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.innerHTML = original;
  }
}

/** Escreve uma dica logo abaixo do campo (loading / ok / erro). */
function fieldHint(input, texto, tipo = '') {
  if (!input) return;
  let hint = input.parentElement.querySelector('.hint-lookup');
  if (!hint) {
    hint = document.createElement('small');
    hint.className = 'hint-lookup';
    input.parentElement.appendChild(hint);
  }
  hint.className = `hint-lookup ${tipo}`;
  hint.innerHTML = texto ? (tipo === 'loading' ? '<i class="fas fa-spinner fa-spin"></i> ' : '') + esc(texto) : '';
}

function preencherCampo(el, valor) {
  if (!el || !valor) return;
  el.value = valor;
  el.classList.add('autofilled');
}

/**
 * Liga a busca automática de endereço pelo CEP (ViaCEP) a um campo.
 * @param {string} cepId  id do input de CEP
 * @param {object} campos { logradouro, bairro, cidade, estado } → ids dos inputs
 * @param {boolean} publico usa o endpoint aberto (tela de cadastro)
 */
function bindCEP(cepId, campos = {}, publico = false) {
  const input = document.getElementById(cepId);
  if (!input || input.dataset.cepBound === '1') return;
  input.dataset.cepBound = '1';

  let ultimo = '';
  const buscar = async () => {
    const cep = onlyDigits(input.value);
    if (cep.length !== 8) {
      if (cep.length) fieldHint(input, 'Informe os 8 números do CEP.', 'err');
      else fieldHint(input, '');
      return;
    }
    if (cep === ultimo) return;
    ultimo = cep;

    fieldHint(input, 'Buscando endereço...', 'loading');
    try {
      const r = publico ? await consultarCEPPublico(cep) : await consultarCEP(cep);
      if (r.unavailable) { fieldHint(input, r.reason || 'Consulta indisponível. Preencha manualmente.', 'err'); return; }
      const d = r.data || {};
      preencherCampo(document.getElementById(campos.logradouro), d.logradouro);
      preencherCampo(document.getElementById(campos.bairro), d.bairro);
      preencherCampo(document.getElementById(campos.cidade), d.cidade);
      preencherCampo(document.getElementById(campos.estado), d.estado);
      fieldHint(input, 'Endereço preenchido automaticamente. Confira antes de salvar.', 'ok');
    } catch (e) {
      ultimo = '';
      fieldHint(input, e.message || 'Não foi possível consultar o CEP.', 'err');
    }
  };

  input.addEventListener('input', () => { input.value = maskCEP(input.value); if (onlyDigits(input.value).length === 8) buscar(); });
  input.addEventListener('blur', buscar);
}

// ── DATAS LOCAIS (evita o deslocamento do fuso UTC) ──
function hojeLocal(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function paraInputDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${hojeLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Reduz a imagem antes do upload (economiza banda no celular do técnico).
function comprimirImagem(file, maxLado = 1280, qualidade = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── TOAST ──
function toast(msg, type = 'ok') {
  const old = document.getElementById('toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.style.background = type === 'ok' ? '#22c55e' : '#ef4444';
  t.innerHTML = `<i class="fas fa-${type === 'ok' ? 'check-circle' : 'times-circle'}"></i> ${esc(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── INIT ──
// O controle de acesso roda imediatamente (o script fica no fim do <body>),
// antes da primeira pintura, para que módulos fora do plano nunca apareçam.
enforceAccess();

document.addEventListener('DOMContentLoaded', () => {
  enforceAccess();
  revalidarModulos();
  setActiveNav();
  initMenu();
  initDrawer();
  applyMasks();
  injectLogoutButton();
});
