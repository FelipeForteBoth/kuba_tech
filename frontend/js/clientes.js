// ── STATE ──
let customers = [];
let sortDir   = 1;
let editingCpf = null;

// ── FETCH ──
async function fetchClientes() {
  try {
    const res = await fetch(`${API_URL}/customers?t=${Date.now()}`);
    customers = await res.json();
    render(customers);
    document.getElementById('sub-count').textContent =
      `${customers.length} cliente${customers.length !== 1 ? 's' : ''} cadastrado${customers.length !== 1 ? 's' : ''}`;
  } catch (e) { console.error(e); }
}

// ── RENDER ──
function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty">
        <i class="fas fa-users"></i>
        <p>Nenhum cliente cadastrado ainda.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr onclick="viewCliente('${c.cpf}')">
      <td><strong>${c.name}</strong></td>
      <td class="td2 mono">${c.cpf}</td>
      <td class="td2">${c.phone}</td>
      <td class="td2">${c.email}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

// ── FILTER + SORT ──
function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  let data = customers.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.cpf.includes(q) ||
    c.phone.includes(q) ||
    c.email.toLowerCase().includes(q)
  );
  data.sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
  render(data);
}

// ── VIEW MODE ──
function viewCliente(cpf) {
  const c = customers.find(x => x.cpf === cpf);
  if (!c) return;
  editingCpf = null;

  document.getElementById('drawer-title').textContent = c.name;
  document.getElementById('drawer-mode').textContent  = 'Detalhes do Cliente';

  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user"></i> Informações Pessoais</div>
    <div class="d-field"><div class="d-lbl">Nome Completo</div><div class="d-val">${c.name}</div></div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${c.cpf}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-address-book"></i> Contato</div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${c.phone}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${c.email}</div></div>`;

  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-del btn-sm" onclick="deleteCliente('${c.cpf}')">
      <i class="fas fa-trash"></i> Excluir
    </button>
    <button class="btn btn-ghost btn-sm" onclick="editCliente('${c.cpf}')">
      <i class="fas fa-edit"></i> Editar
    </button>`;

  openDrawer();
}

// ── NEW MODE ──
function newCliente() {
  editingCpf = null;
  document.getElementById('drawer-title').textContent = 'Novo Cliente';
  document.getElementById('drawer-mode').textContent  = 'Cadastro';
  document.getElementById('drawer-body').innerHTML    = formHTML(null);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()">
      <i class="fas fa-save"></i> Salvar
    </button>`;
  openDrawer();
}

// ── EDIT MODE ──
function editCliente(cpf) {
  const c = customers.find(x => x.cpf === cpf);
  if (!c) return;
  editingCpf = cpf;
  document.getElementById('drawer-title').textContent = 'Editar Cliente';
  document.getElementById('drawer-mode').textContent  = 'Edição';
  document.getElementById('drawer-body').innerHTML    = formHTML(c);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewCliente('${cpf}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()">
      <i class="fas fa-save"></i> Salvar
    </button>`;
  openDrawer();
}

// ── FORM HTML ──
function formHTML(c) {
  return `
    <div class="d-section"><i class="fas fa-user"></i> Informações Pessoais</div>
    <div class="fg">
      <label>Nome Completo *</label>
      <input type="text" class="fc" id="f-nome" value="${c ? c.name : ''}" placeholder="Nome Completo">
    </div>
    <div class="fg">
      <label>CPF *</label>
      <input type="text" class="fc" id="f-cpf" data-mask="cpf" maxlength="14"
        value="${c ? c.cpf : ''}" ${c ? 'disabled' : ''} placeholder="000.000.000-00">
    </div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-address-book"></i> Contato</div>
    <div class="fg">
      <label>Telefone *</label>
      <input type="text" class="fc" id="f-tel" data-mask="phone" maxlength="15"
        value="${c ? c.phone : ''}" placeholder="(00) 00000-0000">
    </div>
    <div class="fg">
      <label>E-mail *</label>
      <input type="email" class="fc" id="f-email"
        value="${c ? c.email : ''}" placeholder="email@exemplo.com">
    </div>`;
}

// ── SAVE ──
async function saveCliente() {
  const cpf   = document.getElementById('f-cpf').value.trim();
  const name  = document.getElementById('f-nome').value.trim();
  const phone = document.getElementById('f-tel').value.trim();
  const email = document.getElementById('f-email').value.trim();

  if (!name || (!editingCpf && !cpf) || !phone || !email) {
    toast('Preencha todos os campos.', 'err'); return;
  }

  const method = editingCpf ? 'PUT' : 'POST';
  const url    = editingCpf
    ? `${API_URL}/customers/${editingCpf}`
    : `${API_URL}/customers`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: editingCpf || cpf, name, phone, email })
    });
    if (res.ok) {
      toast('Cliente salvo com sucesso!');
      closeDrawer();
      fetchClientes();
    } else {
      const err = await res.json();
      toast(err.error || 'Erro ao salvar.', 'err');
    }
  } catch { toast('Erro de conexão.', 'err'); }
}

// ── DELETE ──
async function deleteCliente(cpf) {
  if (!confirm('Excluir este cliente? Os dispositivos e O.S. vinculados também serão removidos.')) return;
  try {
    await fetch(`${API_URL}/customers/${cpf}`, { method: 'DELETE' });
    toast('Cliente excluído.');
    closeDrawer();
    fetchClientes();
  } catch { toast('Erro ao excluir.', 'err'); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  fetchClientes();

  document.getElementById('btn-new').addEventListener('click', newCliente);
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
