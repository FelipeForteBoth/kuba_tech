const API_URL = 'http://localhost:3000/api';

// ── ACTIVE NAV ──
function setActiveNav() {
  const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
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
  setActiveNav();
  initMenu();
  initDrawer();
  applyMasks();
});
