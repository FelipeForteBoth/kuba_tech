// Painel da Plataforma — visão do Administrador da Plataforma (SaaS).
let tenants = [];
let plans = [];
let sortDir = 1;

const STATUS_LABEL = { active: 'Ativa', suspended: 'Suspensa', canceled: 'Cancelada' };
const STATUS_BADGE = { active: 'badge-done', suspended: 'badge-prog', canceled: 'badge-del' };

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function loadTudo() {
  try {
    const [mRes, tRes, pRes] = await Promise.all([
      authFetch(`${API_URL}/platform/metrics?t=${Date.now()}`),
      authFetch(`${API_URL}/platform/tenants?t=${Date.now()}`),
      authFetch(`${API_URL}/platform/plans?t=${Date.now()}`),
    ]);
    if (!mRes.ok || !tRes.ok) return;

    const m = await mRes.json();
    tenants = await tRes.json();
    plans = pRes.ok ? await pRes.json() : [];

    document.getElementById('s-empresas').textContent = m.empresas;
    document.getElementById('s-ativas').textContent = m.empresas_ativas;
    document.getElementById('s-usuarios').textContent = m.usuarios;
    document.getElementById('s-ordens').textContent = m.ordens;
    document.getElementById('s-receita').textContent = money(m.receita_mensal);

    document.getElementById('sub-count').textContent =
      `${tenants.length} empresa${tenants.length !== 1 ? 's' : ''} contratante${tenants.length !== 1 ? 's' : ''}`;
    renderPlanos();
    applyFilter();
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os dados da plataforma.', 'err');
  }
}

function renderPlanos() {
  const box = document.getElementById('planos');
  if (!box) return;
  box.innerHTML = plans.map((p) => `
    <div class="stat-card">
      <div class="stat-icon ico-purple"><i class="fas fa-box"></i></div>
      <div>
        <div class="stat-val">${esc(p.name)}</div>
        <div class="stat-lbl">${money(p.monthly_price)} / mês · ${(p.modules || []).map(esc).join(', ') || 'sem módulos'}</div>
      </div>
    </div>`).join('');
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty"><i class="fas fa-building"></i>
      <p>Nenhuma empresa cadastrada ainda.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((t) => `
    <tr onclick="viewEmpresa('${t.id}')">
      <td><strong>${esc(t.company_name)}</strong></td>
      <td class="td2 mono">${esc(t.document)}</td>
      <td class="td2">${esc(t.plan_name || '—')}</td>
      <td class="td2">${t.users_count}</td>
      <td class="td2">${t.orders_count}</td>
      <td><span class="badge ${STATUS_BADGE[t.status]}">${STATUS_LABEL[t.status]}</span></td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const data = tenants.filter((t) =>
    [t.company_name, t.document, t.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  data.sort((a, b) => sortDir * a.company_name.localeCompare(b.company_name, 'pt-BR'));
  render(data);
}

function viewEmpresa(id) {
  const t = tenants.find((x) => x.id === id);
  if (!t) return;

  document.getElementById('drawer-title').textContent = t.company_name;
  document.getElementById('drawer-mode').textContent = 'Assinatura da Empresa';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-building"></i> Dados da Empresa</div>
    <div class="d-field"><div class="d-lbl">Razão Social</div><div class="d-val">${esc(t.company_name)}</div></div>
    <div class="d-field"><div class="d-lbl">CNPJ</div><div class="d-val mono">${esc(t.document)}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${esc(t.email)}</div></div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${esc(t.phone || '—')}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-box"></i> Contrato</div>
    <div class="fg"><label>Plano</label>
      <select class="fc" id="f-plano">
        ${plans.map((p) => `<option value="${p.id}" ${p.id === t.plan_id ? 'selected' : ''}>${esc(p.name)} — ${money(p.monthly_price)}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Situação da assinatura</label>
      <select class="fc" id="f-status">
        ${Object.keys(STATUS_LABEL).map((s) => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
      </select></div>
    <div class="d-field"><div class="d-lbl">Usuários</div><div class="d-val">${t.users_count}</div></div>
    <div class="d-field"><div class="d-lbl">Ordens de serviço</div><div class="d-val">${t.orders_count}</div></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Fechar</button>
    <button class="btn btn-primary btn-sm" onclick="saveEmpresa('${t.id}')"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function saveEmpresa(id) {
  const t = tenants.find((x) => x.id === id);
  const planId = document.getElementById('f-plano').value;
  const status = document.getElementById('f-status').value;

  try {
    if (planId && planId !== t.plan_id) {
      const res = await authFetch(`${API_URL}/platform/tenants/${id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) return toast((await res.json()).error || 'Erro ao trocar o plano.', 'err');
    }
    if (status !== t.status) {
      const res = await authFetch(`${API_URL}/platform/tenants/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return toast((await res.json()).error || 'Erro ao atualizar a assinatura.', 'err');
    }
    toast('Assinatura atualizada.');
    closeDrawer();
    loadTudo();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  loadTudo();
  document.getElementById('search-input').addEventListener('input', applyFilter);
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
