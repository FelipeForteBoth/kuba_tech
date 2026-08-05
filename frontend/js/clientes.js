// Tela de Clientes — CRUD consumindo /api/customers (escopo por empresa).
let customers = [];
let sortDir = 1;
let editingId = null;

async function fetchClientes() {
  try {
    const res = await authFetch(`${API_URL}/customers?t=${Date.now()}`);
    if (!res.ok) return;
    customers = await res.json();
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${customers.length} cliente${customers.length !== 1 ? 's' : ''} cadastrado${customers.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os clientes.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty"><i class="fas fa-users"></i>
      <p>Nenhum cliente cadastrado ainda.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((c) => `
    <tr onclick="viewCliente('${c.id}')">
      <td><strong>${esc(c.name)}</strong></td>
      <td class="td2 mono">${esc(c.cpf)}</td>
      <td class="td2">${esc(c.phone)}</td>
      <td class="td2">${esc(c.email)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const data = customers.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    (c.cpf || '').includes(q) ||
    (c.phone || '').includes(q) ||
    (c.email || '').toLowerCase().includes(q));
  data.sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
  render(data);
}

function viewCliente(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  editingId = null;

  document.getElementById('drawer-title').textContent = c.name;
  document.getElementById('drawer-mode').textContent = 'Detalhes do Cliente';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user"></i> Informações Pessoais</div>
    <div class="d-field"><div class="d-lbl">Nome Completo</div><div class="d-val">${esc(c.name)}</div></div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${esc(c.cpf)}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-address-book"></i> Contato</div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${esc(c.phone)}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${esc(c.email)}</div></div>`;

  const acoes = [];
  if (canDelete()) acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteCliente('${c.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  if (can('customers')) acoes.push(`<button class="btn btn-ghost btn-sm" onclick="editCliente('${c.id}')"><i class="fas fa-edit"></i> Editar</button>`);
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();
}

function newCliente() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Novo Cliente';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = formHTML(null);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editCliente(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = 'Editar Cliente';
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = formHTML(c);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewCliente('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function formHTML(c) {
  return `
    <div class="d-section"><i class="fas fa-user"></i> Informações Pessoais</div>
    <div class="fg"><label>Nome Completo *</label>
      <input type="text" class="fc" id="f-nome" value="${esc(c ? c.name : '')}" placeholder="Nome e sobrenome"></div>
    <div class="fg"><label>CPF *</label>
      <input type="text" class="fc" id="f-cpf" data-mask="cpf" maxlength="14"
        value="${esc(c ? c.cpf : '')}" ${c ? 'disabled' : ''} placeholder="000.000.000-00"></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-address-book"></i> Contato</div>
    <div class="fg"><label>Telefone *</label>
      <input type="text" class="fc" id="f-tel" data-mask="phone" maxlength="15"
        value="${esc(c ? c.phone : '')}" placeholder="(00) 00000-0000"></div>
    <div class="fg"><label>E-mail *</label>
      <input type="email" class="fc" id="f-email" value="${esc(c ? c.email : '')}" placeholder="email@exemplo.com"></div>`;
}

async function saveCliente() {
  const cpfField = document.getElementById('f-cpf');
  const telField = document.getElementById('f-tel');
  if (!cpfField.disabled) cpfField.value = maskCPF(cpfField.value);
  telField.value = maskPhone(telField.value);

  const cpf = cpfField.value.trim();
  const name = document.getElementById('f-nome').value.trim();
  const phone = telField.value.trim();
  const email = document.getElementById('f-email').value.trim();

  if (!isValidName(name)) return toast('Informe o nome completo (nome e sobrenome).', 'err');
  if (!editingId && !isValidCPF(cpf)) return toast('CPF inválido. Confira os números digitados.', 'err');
  if (!isValidPhone(phone)) return toast('Telefone inválido. Use (00) 00000-0000.', 'err');
  if (!isValidEmail(email)) return toast('E-mail inválido.', 'err');

  const url = editingId ? `${API_URL}/customers/${editingId}` : `${API_URL}/customers`;
  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, name, phone, email }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Cliente salvo com sucesso!');
    closeDrawer();
    fetchClientes();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteCliente(id) {
  if (!confirm('Excluir este cliente? Os equipamentos e ordens de serviço vinculados também serão removidos.')) return;
  try {
    const res = await authFetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Cliente excluído.');
    closeDrawer();
    fetchClientes();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
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
