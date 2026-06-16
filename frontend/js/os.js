// ── STATE ──
let orders = [];
let sortDir = -1; // mais recentes primeiro
let editingId = null;

const isCliente = () => localStorage.getItem('tipoUsuario') === 'cliente';

// ── HELPERS ──
function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

function badgeStatus(s) {
  if (s === 'A Realizar')   return `<span class="badge badge-todo">${s}</span>`;
  if (s === 'Em Andamento') return `<span class="badge badge-prog">${s}</span>`;
  return `<span class="badge badge-done">${s}</span>`;
}

// ── FETCH ──
async function fetchOS() {
  try {
    const res = await authFetch(`${API_URL}/service-orders?t=${Date.now()}`);
    orders = await res.json();
    render(orders);
    const tot = orders.length;
    document.getElementById('sub-count').textContent =
      `${tot} ordem${tot !== 1 ? 's' : ''} de serviço`;
  } catch (e) { console.error(e); }
}

// ── RENDER ──
function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty">
        <i class="fas fa-file-invoice"></i>
        <p>Nenhuma ordem de serviço encontrada.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(o => `
    <tr onclick="viewOS(${o.id})">
      <td><strong>#${o.id}</strong></td>
      <td class="td2 mono">${o.customer_cpf}</td>
      <td class="td2">${o.device_serial}</td>
      <td class="td2">${o.technician}</td>
      <td class="td3">${fmtDate(o.opening_date)}</td>
      <td>${badgeStatus(o.status)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

// ── FILTER + SORT ──
function applyFilter() {
  const q  = document.getElementById('search-input').value.toLowerCase();
  const st = document.getElementById('filter-status').value;

  let data = orders.filter(o => {
    const matchQ = !q ||
      String(o.id).includes(q) ||
      o.customer_cpf.includes(q) ||
      o.device_serial.toLowerCase().includes(q) ||
      o.technician.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      o.problem_description.toLowerCase().includes(q);
    const matchSt = !st || o.status === st;
    return matchQ && matchSt;
  });

  data.sort((a, b) => sortDir * (a.id - b.id));
  render(data);
}

// ── VIEW ──
function viewOS(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  editingId = null;

  document.getElementById('drawer-title').textContent = `Ordem de Serviço #${o.id}`;
  document.getElementById('drawer-mode').textContent  = o.status;

  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-info-circle"></i> Informações Gerais</div>
    <div class="d-field"><div class="d-lbl">Status</div><div class="d-val">${badgeStatus(o.status)}</div></div>
    <div class="d-field"><div class="d-lbl">Data de Abertura</div><div class="d-val">${fmtDate(o.opening_date)}</div></div>
    <div class="d-field"><div class="d-lbl">Técnico Responsável</div><div class="d-val">${o.technician}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Cliente & Aparelho</div>
    <div class="d-field"><div class="d-lbl">CPF do Cliente</div><div class="d-val mono">${o.customer_cpf}</div></div>
    <div class="d-field"><div class="d-lbl">Serial do Aparelho</div><div class="d-val mono">${o.device_serial}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-history"></i> Histórico / Defeito</div>
    <div class="pre-box">${o.problem_description}</div>`;

  // Cliente não vê os botões de editar / excluir
  if (isCliente()) {
    document.getElementById('drawer-ft').innerHTML = '';
  } else {
    document.getElementById('drawer-ft').innerHTML = `
      <button class="btn btn-del btn-sm" onclick="deleteOS(${o.id})">
        <i class="fas fa-trash"></i> Excluir
      </button>
      <button class="btn btn-ghost btn-sm" onclick="editOS(${o.id})">
        <i class="fas fa-edit"></i> Editar / Atualizar
      </button>`;
  }

  openDrawer();
}

// ── NEW (admin) ──
function newOS() {
  if (isCliente()) return;
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Nova Ordem de Serviço';
  document.getElementById('drawer-mode').textContent  = 'Cadastro';
  document.getElementById('drawer-body').innerHTML    = formHTML(null);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()">
      <i class="fas fa-save"></i> Salvar O.S.
    </button>`;
  openDrawer();
}

// ── EDIT (admin) ──
function editOS(id) {
  if (isCliente()) return;
  const o = orders.find(x => x.id === id);
  if (!o) return;
  editingId = id;

  document.getElementById('drawer-title').textContent = `Editar O.S. #${id}`;
  document.getElementById('drawer-mode').textContent  = 'Atualização';
  document.getElementById('drawer-body').innerHTML    = formHTML(o);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewOS(${id})">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()">
      <i class="fas fa-save"></i> Salvar Atualização
    </button>`;
  openDrawer();
}

// ── FORM HTML ──
function formHTML(o) {
  const histHTML = o ? `
    <div class="fg">
      <label><i class="fas fa-history" style="color:var(--accent)"></i> Histórico Anterior</label>
      <div class="pre-box" style="margin-bottom:0">${o.problem_description}</div>
    </div>
    <div class="fg">
      <label>Nova Atualização / Relato *</label>
      <textarea class="fc" id="f-problema" rows="4"
        placeholder="Descreva a atualização ou novo diagnóstico..."></textarea>
    </div>` : `
    <div class="fg">
      <label>Defeito / Descrição do Problema *</label>
      <textarea class="fc" id="f-problema" rows="4"
        placeholder="Descreva o defeito ou o problema relatado pelo cliente..."></textarea>
    </div>`;

  return `
    <div class="d-section"><i class="fas fa-info-circle"></i> Dados da O.S.</div>
    <div class="frow">
      <div class="fg">
        <label>CPF do Cliente *</label>
        <input type="text" class="fc" id="f-cpf" data-mask="cpf" maxlength="14"
          value="${o ? o.customer_cpf : ''}" ${o ? 'disabled' : ''}
          placeholder="000.000.000-00">
      </div>
      <div class="fg">
        <label>Serial do Aparelho *</label>
        <input type="text" class="fc" id="f-serial"
          value="${o ? o.device_serial : ''}" ${o ? 'disabled' : ''}
          placeholder="Número de Série">
      </div>
    </div>
    <div class="frow">
      <div class="fg">
        <label>Técnico Responsável *</label>
        <input type="text" class="fc" id="f-tecnico"
          value="${o ? o.technician : ''}" placeholder="Nome do Técnico">
      </div>
      <div class="fg">
        <label>Data de Abertura *</label>
        <input type="date" class="fc" id="f-data"
          value="${o ? o.opening_date.split('T')[0] : new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div class="fg">
      <label>Status</label>
      <select class="fc" id="f-status">
        <option value="A Realizar"   ${o && o.status === 'A Realizar'   ? 'selected' : ''}>A Realizar</option>
        <option value="Em Andamento" ${o && o.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
        <option value="Finalizada"   ${o && o.status === 'Finalizada'   ? 'selected' : ''}>Finalizada</option>
      </select>
    </div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-wrench"></i> Descrição do Problema</div>
    ${histHTML}`;
}

// ── SAVE ──
async function saveOS() {
  const cpf      = editingId
    ? orders.find(x => x.id === editingId).customer_cpf
    : document.getElementById('f-cpf').value.trim();
  const serial   = editingId
    ? orders.find(x => x.id === editingId).device_serial
    : document.getElementById('f-serial').value.trim();
  const tecnico  = document.getElementById('f-tecnico').value.trim();
  const data     = document.getElementById('f-data').value;
  const status   = document.getElementById('f-status').value;
  const novoRelato = document.getElementById('f-problema').value.trim();

  if (!cpf || !serial || !tecnico || !data || !novoRelato) {
    toast('Preencha todos os campos obrigatórios.', 'err'); return;
  }

  let descricao = novoRelato;
  if (editingId) {
    const velho = orders.find(x => x.id === editingId).problem_description;
    descricao = `${velho}\n--- Atualizado em ${new Date().toLocaleDateString('pt-BR')} ---\n${novoRelato}`;
  }

  const payload = {
    customer_cpf: cpf, device_serial: serial,
    technician: tecnico, opening_date: data,
    problem_description: descricao, status
  };

  const method = editingId ? 'PUT' : 'POST';
  const url    = editingId
    ? `${API_URL}/service-orders/${editingId}`
    : `${API_URL}/service-orders`;

  try {
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      toast('Ordem de Serviço salva!');
      closeDrawer();
      fetchOS();
    } else {
      const err = await res.json();
      toast(err.error || 'Erro ao salvar.', 'err');
    }
  } catch { toast('Erro de conexão.', 'err'); }
}

// ── DELETE ──
async function deleteOS(id) {
  if (isCliente()) return;
  if (!confirm('Excluir esta Ordem de Serviço?')) return;
  try {
    await authFetch(`${API_URL}/service-orders/${id}`, { method: 'DELETE' });
    toast('O.S. excluída.');
    closeDrawer();
    fetchOS();
  } catch { toast('Erro ao excluir.', 'err'); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Esconde o botão "Nova O.S." se o usuário for cliente
  const btnNew = document.getElementById('btn-new');
  if (isCliente() && btnNew) btnNew.style.display = 'none';

  fetchOS();

  if (btnNew) btnNew.addEventListener('click', newOS);
  document.getElementById('search-input').addEventListener('input', applyFilter);
  document.getElementById('filter-status').addEventListener('change', applyFilter);

  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === -1
      ? '<i class="fas fa-sort-numeric-down"></i> Mais recentes'
      : '<i class="fas fa-sort-numeric-up"></i> Mais antigos';
    applyFilter();
  });
});
