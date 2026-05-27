// ── STATE ──
let devices = [];
let sortDir  = 1;
let editingSerial = null;

// ── FETCH ──
async function fetchDispositivos() {
  try {
    const res = await fetch(`${API_URL}/devices?t=${Date.now()}`);
    devices = await res.json();
    render(devices);
    document.getElementById('sub-count').textContent =
      `${devices.length} dispositivo${devices.length !== 1 ? 's' : ''} cadastrado${devices.length !== 1 ? 's' : ''}`;
  } catch (e) { console.error(e); }
}

// ── RENDER ──
function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty">
        <i class="fas fa-laptop-medical"></i>
        <p>Nenhum dispositivo cadastrado ainda.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(d => `
    <tr onclick="viewDispositivo('${d.serial_number}')">
      <td><strong>${d.serial_number}</strong></td>
      <td class="td2">${d.type}</td>
      <td class="td2 mono">${d.customer_cpf}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

// ── FILTER + SORT ──
function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  let data = devices.filter(d =>
    d.serial_number.toLowerCase().includes(q) ||
    d.type.toLowerCase().includes(q) ||
    d.customer_cpf.includes(q)
  );
  data.sort((a, b) => sortDir * a.serial_number.localeCompare(b.serial_number));
  render(data);
}

// ── VIEW MODE ──
function viewDispositivo(serial) {
  const d = devices.find(x => x.serial_number === serial);
  if (!d) return;
  editingSerial = null;

  document.getElementById('drawer-title').textContent = d.serial_number;
  document.getElementById('drawer-mode').textContent  = 'Detalhes do Dispositivo';

  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Informações do Dispositivo</div>
    <div class="d-field"><div class="d-lbl">Serial / IMEI</div><div class="d-val mono">${d.serial_number}</div></div>
    <div class="d-field"><div class="d-lbl">Tipo de Aparelho</div><div class="d-val">${d.type}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Proprietário</div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${d.customer_cpf}</div></div>`;

  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-del btn-sm" onclick="deleteDispositivo('${d.serial_number}')">
      <i class="fas fa-trash"></i> Excluir
    </button>
    <button class="btn btn-ghost btn-sm" onclick="editDispositivo('${d.serial_number}')">
      <i class="fas fa-edit"></i> Editar
    </button>`;

  openDrawer();
}

// ── NEW MODE ──
function newDispositivo() {
  editingSerial = null;
  document.getElementById('drawer-title').textContent = 'Novo Dispositivo';
  document.getElementById('drawer-mode').textContent  = 'Cadastro';
  document.getElementById('drawer-body').innerHTML    = formHTML(null);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveDispositivo()">
      <i class="fas fa-save"></i> Salvar
    </button>`;
  openDrawer();
}

// ── EDIT MODE ──
function editDispositivo(serial) {
  const d = devices.find(x => x.serial_number === serial);
  if (!d) return;
  editingSerial = serial;
  document.getElementById('drawer-title').textContent = 'Editar Dispositivo';
  document.getElementById('drawer-mode').textContent  = 'Edição';
  document.getElementById('drawer-body').innerHTML    = formHTML(d);
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewDispositivo('${serial}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveDispositivo()">
      <i class="fas fa-save"></i> Salvar
    </button>`;
  openDrawer();
}

// ── FORM HTML ──
function formHTML(d) {
  return `
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Dados do Dispositivo</div>
    <div class="fg">
      <label>Serial / IMEI *</label>
      <input type="text" class="fc" id="f-serial"
        value="${d ? d.serial_number : ''}" ${d ? 'disabled' : ''}
        placeholder="Número de Série ou IMEI">
    </div>
    <div class="fg">
      <label>Tipo de Aparelho *</label>
      <input type="text" class="fc" id="f-tipo"
        value="${d ? d.type : ''}" placeholder="Celular, Notebook, PC...">
    </div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Proprietário</div>
    <div class="fg">
      <label>CPF do Cliente *</label>
      <input type="text" class="fc" id="f-cpf" data-mask="cpf" maxlength="14"
        value="${d ? d.customer_cpf : ''}" placeholder="000.000.000-00">
    </div>`;
}

// ── SAVE ──
async function saveDispositivo() {
  const serial = editingSerial || document.getElementById('f-serial').value.trim();
  const type   = document.getElementById('f-tipo').value.trim();
  const cpf    = document.getElementById('f-cpf').value.trim();

  if (!serial || !type || !cpf) {
    toast('Preencha todos os campos.', 'err'); return;
  }

  const method = editingSerial ? 'PUT' : 'POST';
  const url    = editingSerial
    ? `${API_URL}/devices/${editingSerial}`
    : `${API_URL}/devices`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial_number: serial, customer_cpf: cpf, type })
    });
    if (res.ok) {
      toast('Dispositivo salvo com sucesso!');
      closeDrawer();
      fetchDispositivos();
    } else {
      const err = await res.json();
      toast(err.error || 'Erro ao salvar.', 'err');
    }
  } catch { toast('Erro de conexão.', 'err'); }
}

// ── DELETE ──
async function deleteDispositivo(serial) {
  if (!confirm('Excluir este dispositivo?')) return;
  try {
    await fetch(`${API_URL}/devices/${serial}`, { method: 'DELETE' });
    toast('Dispositivo excluído.');
    closeDrawer();
    fetchDispositivos();
  } catch { toast('Erro ao excluir.', 'err'); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  fetchDispositivos();

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
