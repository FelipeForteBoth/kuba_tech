// ── STATE ──
let tenants = [];
let plans   = [];
let sortDir = 1;

// ── HELPERS ──
function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABELS = { active: 'Ativa', suspended: 'Suspensa', canceled: 'Cancelada' };

function badgeTenantStatus(status) {
  if (status === 'active')    return `<span class="badge badge-done">${STATUS_LABELS.active}</span>`;
  if (status === 'suspended') return `<span class="badge badge-prog">${STATUS_LABELS.suspended}</span>`;
  return `<span class="badge badge-todo">${STATUS_LABELS.canceled || status}</span>`;
}

// ── FETCH ──
async function fetchMetrics() {
  try {
    const res = await authFetch(`${API_URL}/platform/metrics?t=${Date.now()}`);
    const m = await res.json();
    document.getElementById('s-empresas').textContent = m.empresas;
    document.getElementById('s-ativas').textContent    = m.empresas_ativas;
    document.getElementById('s-usuarios').textContent  = m.usuarios;
    document.getElementById('s-ordens').textContent    = m.ordens;
    document.getElementById('s-receita').textContent   = formatBRL(m.receita_mensal);
  } catch (e) { console.error(e); }
}

async function fetchPlans() {
  try {
    const res = await authFetch(`${API_URL}/platform/plans?t=${Date.now()}`);
    plans = await res.json();
  } catch (e) { console.error(e); }
}

async function fetchTenants() {
  try {
    const q = document.getElementById('search-input').value.trim();
    const url = q
      ? `${API_URL}/platform/tenants?search=${encodeURIComponent(q)}&t=${Date.now()}`
      : `${API_URL}/platform/tenants?t=${Date.now()}`;
    const res = await authFetch(url);
    tenants = await res.json();
    applyFilter();
  } catch (e) { console.error(e); }
}

// ── RENDER ──
function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty">
        <i class="fas fa-building"></i>
        <p>Nenhuma empresa encontrada.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(t => `
    <tr onclick="viewTenant('${t.id}')">
      <td><strong>${esc(t.company_name)}</strong></td>
      <td class="td2 mono">${esc(t.document)}</td>
      <td class="td2">${esc(t.plan_name || '—')}</td>
      <td>${badgeTenantStatus(t.status)}</td>
      <td class="td2">${t.users_count}</td>
      <td class="td2">${t.orders_count}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

// ── FILTER + SORT ──
function applyFilter() {
  const status = document.getElementById('filter-status').value;
  let data = status ? tenants.filter(t => t.status === status) : tenants.slice();
  data.sort((a, b) => sortDir * a.company_name.localeCompare(b.company_name, 'pt-BR'));
  render(data);
}

// ── DRAWER: VIEW / EDIT ──
async function viewTenant(id) {
  try {
    const res = await authFetch(`${API_URL}/platform/tenants/${id}?t=${Date.now()}`);
    if (!res.ok) { toast('Não foi possível carregar a empresa.', 'err'); return; }
    const t = await res.json();
    renderTenantDrawer(t);
    openDrawer();
  } catch { toast('Erro de conexão.', 'err'); }
}

function renderTenantDrawer(t) {
  document.getElementById('drawer-title').textContent = t.company_name;
  document.getElementById('drawer-mode').textContent   = 'Empresa Contratante';

  const modulosHTML = (t.modulos || []).length
    ? `<ul class="mod-list">${t.modulos.map(m => `<li><i class="fas fa-puzzle-piece"></i> ${esc(m.name)}</li>`).join('')}</ul>`
    : '<div class="d-val td2">Nenhum módulo habilitado.</div>';

  const planOptions = plans.map(p =>
    `<option value="${p.id}" ${p.id === t.plan_id ? 'selected' : ''}>${esc(p.name)} — ${formatBRL(p.monthly_price)}/mês</option>`
  ).join('');

  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-building"></i> Dados da Empresa</div>
    <div class="d-field"><div class="d-lbl">Razão Social</div><div class="d-val">${esc(t.company_name)}</div></div>
    <div class="d-field"><div class="d-lbl">CNPJ</div><div class="d-val mono">${esc(t.document)}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${esc(t.email)}</div></div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${esc(t.phone || '—')}</div></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-toggle-on"></i> Status da Assinatura</div>
    <div class="fg">
      <select class="fc" id="f-status">
        <option value="active"    ${t.status === 'active'    ? 'selected' : ''}>Ativa</option>
        <option value="suspended" ${t.status === 'suspended' ? 'selected' : ''}>Suspensa</option>
        <option value="canceled"  ${t.status === 'canceled'  ? 'selected' : ''}>Cancelada</option>
      </select>
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveStatus('${t.id}')">
      <i class="fas fa-save"></i> Atualizar Status
    </button>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-layer-group"></i> Plano</div>
    <div class="fg">
      <select class="fc" id="f-plan">${planOptions}</select>
    </div>
    <button class="btn btn-primary btn-sm" onclick="savePlan('${t.id}')">
      <i class="fas fa-save"></i> Alterar Plano
    </button>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-puzzle-piece"></i> Módulos Habilitados</div>
    ${modulosHTML}`;

  document.getElementById('drawer-ft').innerHTML = `
    <span class="td3" style="font-size:12px;">
      ${t.users_count ?? '—'} usuário(s) · ${t.orders_count ?? '—'} O.S.
    </span>`;
}

// ── SAVE: STATUS ──
async function saveStatus(id) {
  const status = document.getElementById('f-status').value;
  try {
    const res = await authFetch(`${API_URL}/platform/tenants/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast('Status da empresa atualizado!');
      closeDrawer();
      fetchTenants();
      fetchMetrics();
    } else {
      const err = await res.json();
      toast(err.error || 'Erro ao atualizar status.', 'err');
    }
  } catch { toast('Erro de conexão.', 'err'); }
}

// ── SAVE: PLAN ──
async function savePlan(id) {
  const planId = document.getElementById('f-plan').value;
  try {
    const res = await authFetch(`${API_URL}/platform/tenants/${id}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    if (res.ok) {
      toast('Plano da empresa atualizado!');
      closeDrawer();
      fetchTenants();
      fetchMetrics();
    } else {
      const err = await res.json();
      toast(err.error || 'Erro ao atualizar plano.', 'err');
    }
  } catch { toast('Erro de conexão.', 'err'); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  fetchMetrics();
  await fetchPlans();
  fetchTenants();

  document.getElementById('search-input').addEventListener('input', fetchTenants);
  document.getElementById('filter-status').addEventListener('change', applyFilter);

  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === 1
      ? '<i class="fas fa-sort-alpha-down"></i> A–Z'
      : '<i class="fas fa-sort-alpha-up"></i> Z–A';
    applyFilter();
  });
});
