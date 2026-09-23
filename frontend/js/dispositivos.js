// Tela de Equipamentos — CRUD consumindo /api/devices.
let devices = [];
let customersRef = [];
let sortDir = 1;
let editingId = null;

async function fetchDados() {
  try {
    const [dRes, cRes] = await Promise.all([
      authFetch(`${API_URL}/devices?t=${Date.now()}`),
      authFetch(`${API_URL}/customers?t=${Date.now()}`),
    ]);
    if (!dRes.ok || !cRes.ok) return;
    devices = await dRes.json();
    customersRef = await cRes.json();
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${devices.length} equipamento${devices.length !== 1 ? 's' : ''} cadastrado${devices.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os equipamentos.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty"><i class="fas fa-laptop-medical"></i>
      <p>Nenhum equipamento cadastrado ainda.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((d) => `
    <tr onclick="viewDispositivo('${d.id}')">
      <td><strong>${esc(d.serial_number)}</strong></td>
      <td class="td2">${esc(d.type)}</td>
      <td class="td2">${esc(d.brand || '—')} ${esc(d.model || '')}</td>
      <td class="td2">${esc(d.customer_name)}</td>
      <td class="td2 mono">${esc(d.customer_cpf)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const data = devices.filter((d) =>
    [d.serial_number, d.type, d.brand, d.model, d.customer_name, d.customer_cpf]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  data.sort((a, b) => sortDir * a.serial_number.localeCompare(b.serial_number));
  render(data);
}

function viewDispositivo(id) {
  const d = devices.find((x) => x.id === id);
  if (!d) return;
  editingId = null;

  document.getElementById('drawer-title').textContent = d.serial_number;
  document.getElementById('drawer-mode').textContent = 'Detalhes do Equipamento';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Equipamento</div>
    <div class="d-field"><div class="d-lbl">Número de Série / IMEI</div><div class="d-val mono">${esc(d.serial_number)}</div></div>
    <div class="d-field"><div class="d-lbl">Tipo</div><div class="d-val">${esc(d.type)}</div></div>
    <div class="d-field"><div class="d-lbl">Marca</div><div class="d-val">${esc(d.brand || '—')}</div></div>
    <div class="d-field"><div class="d-lbl">Modelo</div><div class="d-val">${esc(d.model || '—')}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Proprietário</div>
    <div class="d-field"><div class="d-lbl">Cliente</div><div class="d-val">${esc(d.customer_name)}</div></div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${esc(d.customer_cpf)}</div></div>`;

  const acoes = [];
  if (canDelete()) acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteDispositivo('${d.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  if (can('devices')) acoes.push(`<button class="btn btn-ghost btn-sm" onclick="editDispositivo('${d.id}')"><i class="fas fa-edit"></i> Editar</button>`);
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();
}

function newDispositivo() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Novo Equipamento';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = formHTML(null);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveDispositivo()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editDispositivo(id) {
  const d = devices.find((x) => x.id === id);
  if (!d) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = 'Editar Equipamento';
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = formHTML(d);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewDispositivo('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveDispositivo()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function customerOptions(selected) {
  if (!customersRef.length) return '<option value="">Cadastre um cliente primeiro</option>';
  return ['<option value="">Selecione o cliente</option>']
    .concat(customersRef.map((c) =>
      `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)} — ${esc(c.cpf)}</option>`))
    .join('');
}

function formHTML(d) {
  return `
    <div class="d-section"><i class="fas fa-user"></i> Proprietário</div>
    <div class="fg"><label>Cliente *</label>
      <select class="fc" id="f-cliente">${customerOptions(d ? d.customer_id : '')}</select></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Equipamento</div>
    <div class="fg"><label>Número de Série / IMEI *</label>
      <input type="text" class="fc" id="f-serial" value="${esc(d ? d.serial_number : '')}" ${d ? 'disabled' : ''} placeholder="Ex.: SN-123456"></div>
    <div class="fg"><label>Tipo *</label>
      <input type="text" class="fc" id="f-tipo" value="${esc(d ? d.type : '')}" placeholder="Notebook, Celular, Impressora..."></div>
    <div class="fg"><label>Marca</label>
      <input type="text" class="fc" id="f-marca" value="${esc(d && d.brand ? d.brand : '')}" placeholder="Dell, Samsung..."></div>
    <div class="fg"><label>Modelo</label>
      <input type="text" class="fc" id="f-modelo" value="${esc(d && d.model ? d.model : '')}" placeholder="Inspiron 15, Galaxy S22..."></div>`;
}

async function saveDispositivo() {
  const customerId = document.getElementById('f-cliente').value;
  const serialNumber = document.getElementById('f-serial').value.trim();
  const type = document.getElementById('f-tipo').value.trim();
  const brand = document.getElementById('f-marca').value.trim();
  const model = document.getElementById('f-modelo').value.trim();

  if (!customerId) return toast('Selecione o cliente proprietário.', 'err');
  if (!editingId && !isValidSerial(serialNumber)) {
    return toast('Número de série inválido (mínimo 4 caracteres: letras, números, "-" ou "/").', 'err');
  }
  if (!isNonEmptyText(type)) return toast('Informe o tipo de equipamento.', 'err');

  const url = editingId ? `${API_URL}/devices/${editingId}` : `${API_URL}/devices`;
  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, serialNumber, type, brand, model }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Equipamento salvo com sucesso!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteDispositivo(id) {
  if (!confirm('Excluir este equipamento? As ordens de serviço vinculadas também serão removidas.')) return;
  try {
    const res = await authFetch(`${API_URL}/devices/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Equipamento excluído.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  fetchDados();
  document.getElementById('btn-new').addEventListener('click', newDispositivo);
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
