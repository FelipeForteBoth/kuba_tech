// ── STATE ──
let allData = { clientes: [], dispositivos: [], os: [] };
let sortDir = 1;

// ── LOAD STATS ──
async function loadStats() {
  try {
    const [cRes, dRes, oRes] = await Promise.all([
      fetch(`${API_URL}/customers?t=${Date.now()}`),
      fetch(`${API_URL}/devices?t=${Date.now()}`),
      fetch(`${API_URL}/service-orders?t=${Date.now()}`)
    ]);
    const [customers, devices, orders] = await Promise.all([cRes.json(), dRes.json(), oRes.json()]);

    allData.clientes = customers;
    allData.dispositivos = devices;
    allData.os = orders;

    document.getElementById('s-clientes').textContent = customers.length;
    document.getElementById('s-devices').textContent = devices.length;
    document.getElementById('s-todo').textContent  = orders.filter(o => o.status === 'A Realizar').length;
    document.getElementById('s-prog').textContent  = orders.filter(o => o.status === 'Em Andamento').length;
    document.getElementById('s-done').textContent  = orders.filter(o => o.status === 'Finalizada').length;
  } catch (e) { console.error(e); }
}

// ── RENDER ──
function renderResults() {
  const q    = document.getElementById('search-input').value.toLowerCase().trim();
  const cat  = document.getElementById('filter-cat').value;
  const thead = document.getElementById('search-thead');
  const tbody = document.getElementById('search-tbody');

  if (!q) {
    thead.innerHTML = '<tr><th colspan="5">Use a busca acima para pesquisar</th></tr>';
    tbody.innerHTML = '';
    return;
  }

  if (cat === 'clientes') {
    let data = allData.clientes.filter(c =>
      c.cpf.includes(q) || c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) || c.email.toLowerCase().includes(q)
    );
    data.sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
    thead.innerHTML = '<tr><th>CPF</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th></th></tr>';
    tbody.innerHTML = data.length
      ? data.map(c => `
          <tr onclick="viewCliente('${c.cpf}')">
            <td class="td2 mono">${c.cpf}</td>
            <td><strong>${c.name}</strong></td>
            <td class="td2">${c.phone}</td>
            <td class="td2">${c.email}</td>
            <td><i class="fas fa-chevron-right rarrow"></i></td>
          </tr>`).join('')
      : `<tr><td colspan="5"><div class="empty"><i class="fas fa-users"></i><p>Nenhum cliente encontrado.</p></div></td></tr>`;

  } else if (cat === 'dispositivos') {
    let data = allData.dispositivos.filter(d =>
      d.serial_number.toLowerCase().includes(q) ||
      d.customer_cpf.includes(q) ||
      d.type.toLowerCase().includes(q)
    );
    data.sort((a, b) => sortDir * a.serial_number.localeCompare(b.serial_number));
    thead.innerHTML = '<tr><th>Serial / IMEI</th><th>CPF do Dono</th><th>Tipo</th><th></th></tr>';
    tbody.innerHTML = data.length
      ? data.map(d => `
          <tr onclick="viewDispositivo('${d.serial_number}')">
            <td><strong>${d.serial_number}</strong></td>
            <td class="td2">${d.customer_cpf}</td>
            <td class="td2">${d.type}</td>
            <td><i class="fas fa-chevron-right rarrow"></i></td>
          </tr>`).join('')
      : `<tr><td colspan="4"><div class="empty"><i class="fas fa-laptop"></i><p>Nenhum dispositivo encontrado.</p></div></td></tr>`;

  } else {
    let data = allData.os.filter(o =>
      String(o.id).includes(q) ||
      o.customer_cpf.includes(q) ||
      o.device_serial.toLowerCase().includes(q) ||
      o.technician.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      o.problem_description.toLowerCase().includes(q)
    );
    data.sort((a, b) => sortDir * (a.id - b.id));
    thead.innerHTML = '<tr><th>ID</th><th>CPF</th><th>Serial</th><th>Técnico</th><th>Status</th><th></th></tr>';
    tbody.innerHTML = data.length
      ? data.map(o => `
          <tr onclick="viewOS(${o.id})">
            <td><strong>#${o.id}</strong></td>
            <td class="td2">${o.customer_cpf}</td>
            <td class="td2">${o.device_serial}</td>
            <td class="td2">${o.technician}</td>
            <td>${badgeStatus(o.status)}</td>
            <td><i class="fas fa-chevron-right rarrow"></i></td>
          </tr>`).join('')
      : `<tr><td colspan="6"><div class="empty"><i class="fas fa-file-invoice"></i><p>Nenhuma O.S. encontrada.</p></div></td></tr>`;
  }
}

function badgeStatus(s) {
  if (s === 'A Realizar')  return `<span class="badge badge-todo">${s}</span>`;
  if (s === 'Em Andamento') return `<span class="badge badge-prog">${s}</span>`;
  return `<span class="badge badge-done">${s}</span>`;
}

// ── VIEW DRAWER ──
function viewCliente(cpf) {
  const c = allData.clientes.find(x => x.cpf === cpf);
  if (!c) return;
  document.getElementById('drawer-title').textContent = c.name;
  document.getElementById('drawer-mode').textContent = 'Cliente';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user"></i> Informações do Cliente</div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${c.cpf}</div></div>
    <div class="d-field"><div class="d-lbl">Nome</div><div class="d-val">${c.name}</div></div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${c.phone}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${c.email}</div></div>`;
  document.getElementById('drawer-ft').innerHTML =
    `<a href="clientes.html" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> Ir para Clientes</a>`;
  openDrawer();
}

function viewDispositivo(serial) {
  const d = allData.dispositivos.find(x => x.serial_number === serial);
  if (!d) return;
  document.getElementById('drawer-title').textContent = d.serial_number;
  document.getElementById('drawer-mode').textContent = 'Dispositivo';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-laptop"></i> Informações do Dispositivo</div>
    <div class="d-field"><div class="d-lbl">Serial / IMEI</div><div class="d-val mono">${d.serial_number}</div></div>
    <div class="d-field"><div class="d-lbl">Tipo</div><div class="d-val">${d.type}</div></div>
    <div class="d-field"><div class="d-lbl">CPF do Proprietário</div><div class="d-val mono">${d.customer_cpf}</div></div>`;
  document.getElementById('drawer-ft').innerHTML =
    `<a href="dispositivos.html" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> Ir para Dispositivos</a>`;
  openDrawer();
}

function viewOS(id) {
  const o = allData.os.find(x => x.id === id);
  if (!o) return;
  const data = new Date(o.opening_date).toLocaleDateString('pt-BR');
  document.getElementById('drawer-title').textContent = `O.S. #${o.id}`;
  document.getElementById('drawer-mode').textContent = o.status;
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-file-invoice"></i> Ordem de Serviço</div>
    <div class="d-field"><div class="d-lbl">Status</div><div class="d-val">${badgeStatus(o.status)}</div></div>
    <div class="d-field"><div class="d-lbl">CPF do Cliente</div><div class="d-val mono">${o.customer_cpf}</div></div>
    <div class="d-field"><div class="d-lbl">Serial do Aparelho</div><div class="d-val mono">${o.device_serial}</div></div>
    <div class="d-field"><div class="d-lbl">Técnico</div><div class="d-val">${o.technician}</div></div>
    <div class="d-field"><div class="d-lbl">Data de Abertura</div><div class="d-val">${data}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-history"></i> Histórico / Defeito</div>
    <div class="pre-box">${o.problem_description}</div>`;
  document.getElementById('drawer-ft').innerHTML =
    `<a href="os.html" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> Ir para O.S.</a>`;
  openDrawer();
}

// ── EVENTS ──
document.addEventListener('DOMContentLoaded', () => {
  loadStats();

  document.getElementById('search-input').addEventListener('input', renderResults);
  document.getElementById('filter-cat').addEventListener('change', renderResults);

  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === 1
      ? '<i class="fas fa-sort-alpha-down"></i> A–Z'
      : '<i class="fas fa-sort-alpha-up"></i> Z–A';
    renderResults();
  });
});
