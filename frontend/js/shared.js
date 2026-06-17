const API_URL = '/api';

// ── AUTH HELPERS ──
function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return { ...extra, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
}

// Wrapper de fetch que envia o token e redireciona ao login se expirar
async function authFetch(url, opts = {}) {
  const headers = authHeaders(opts.headers || {});
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/html/login.html';
    throw new Error('Não autenticado');
  }
  return res;
}

function logout() {
  localStorage.clear();
  window.location.href = '/html/login.html';
}

// Páginas permitidas para cada tipo de usuário.
// 'login' é pública. As demais exigem login.
const ADMIN_ONLY_PAGES = ['index', 'clientes', 'dispositivos'];

function currentPage() {
  return window.location.pathname.split('/').pop().replace('.html', '') || 'index';
}

// Faz o controle de acesso na entrada de cada página
function enforceAccess() {
  const page  = currentPage();
  if (page === 'login') return;

  const token = localStorage.getItem('token');
  const tipo  = localStorage.getItem('tipoUsuario');

  if (!token) {
    window.location.href = '/html/login.html';
    return;
  }

  // Cliente não pode acessar páginas administrativas
  if (tipo === 'cliente' && ADMIN_ONLY_PAGES.includes(page)) {
    window.location.href = '/html/os.html';
    return;
  }

  // Esconde os itens de menu que o cliente não pode acessar
  if (tipo === 'cliente') {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      if (ADMIN_ONLY_PAGES.includes(el.dataset.page)) el.style.display = 'none';
    });
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




// Adiciona botões de "Tema" e "Sair" na navbar
function injectLogoutButton() {
  const navbar = document.querySelector('.navbar');
  if (!navbar || document.getElementById('btn-logout')) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-left:auto;display:flex;gap:8px;align-items:center;';

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
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
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

  document.addEventListener('click', e => {
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}

// ── MASKS ──
function maskCPF(v) {
  v = v.replace(/\D/g, '');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return v;
}

function maskPhone(v) {
  v = v.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  return v;
}

function applyMasks() {
  document.addEventListener('input', e => {
    if (e.target.dataset.mask === 'cpf')   e.target.value = maskCPF(e.target.value);
    if (e.target.dataset.mask === 'phone') e.target.value = maskPhone(e.target.value);
  });
}

// ── TOAST ──
function toast(msg, type = 'ok') {
  const old = document.getElementById('toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.style.background = type === 'ok' ? '#22c55e' : '#ef4444';
  t.innerHTML = `<i class="fas fa-${type === 'ok' ? 'check-circle' : 'times-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  enforceAccess();
  setActiveNav();
  initMenu();
  initDrawer();
  applyMasks();
  injectLogoutButton();
});
