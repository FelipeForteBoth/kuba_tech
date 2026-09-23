// Painel da empresa — indicadores e busca global.
let allData = { clientes: [], dispositivos: [], os: [] };
let sortDir = 1;

async function loadStats() {
  try {
    const res = await authFetch(`${API_URL}/service-orders/summary?t=${Date.now()}`);
    if (!res.ok) return;
    const s = await res.json();
    document.getElementById('s-clientes').textContent = s.clientes;
    document.getElementById('s-devices').textContent = s.equipamentos;
    const emAndamento = ['Agendado', 'Em deslocamento', 'No local', 'Em execução', 'Aguardando cliente']
      .reduce((total, st) => total + (s.ordens[st] || 0), 0);
    document.getElementById('s-todo').textContent = s.ordens.Aberto || 0;
    document.getElementById('s-prog').textContent = emAndamento;
    document.getElementById('s-done').textContent = (s.ordens.Finalizado || 0) + (s.ordens.Entregue || 0);
  } catch (e) {
    console.error(e);
  }
}

async function loadData() {
  try {
    const oRes = await authFetch(`${API_URL}/service-orders?t=${Date.now()}`);
    allData.os = oRes.ok ? await oRes.json() : [];

    if (currentRole() !== 'technician') {
      const [cRes, dRes] = await Promise.all([
        authFetch(`${API_URL}/customers?t=${Date.now()}`),
        authFetch(`${API_URL}/devices?t=${Date.now()}`),
      ]);
      allData.clientes = cRes.ok ? await cRes.json() : [];
      allData.dispositivos = dRes.ok ? await dRes.json() : [];
    }
    renderResults();
  } catch (e) {
    console.error(e);
  }
}

function badgeStatus(s) {
  return osBadge(s);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

function renderResults() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const cat = document.getElementById('filter-cat').value;
  const thead = document.getElementById('search-thead');
  const tbody = document.getElementById('search-tbody');

  if (cat === 'clientes') {
    thead.innerHTML = '<tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>E-mail</th></tr>';
    const data = allData.clientes
      .filter((c) => [c.name, c.cpf, c.phone, c.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
    tbody.innerHTML = data.length
      ? data.map((c) => `<tr><td><strong>${esc(c.name)}</strong></td><td class="td2 mono">${esc(c.cpf)}</td>
          <td class="td2">${esc(c.phone)}</td><td class="td2">${esc(c.email)}</td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><p>Nenhum resultado.</p></div></td></tr>';
    return;
  }

  if (cat === 'dispositivos') {
    thead.innerHTML = '<tr><th>Série</th><th>Tipo</th><th>Marca/Modelo</th><th>Cliente</th></tr>';
    const data = allData.dispositivos
      .filter((d) => [d.serial_number, d.type, d.brand, d.model, d.customer_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .sort((a, b) => sortDir * a.serial_number.localeCompare(b.serial_number));
    tbody.innerHTML = data.length
      ? data.map((d) => `<tr><td><strong>${esc(d.serial_number)}</strong></td><td class="td2">${esc(d.type)}</td>
          <td class="td2">${esc(d.brand || '—')} ${esc(d.model || '')}</td><td class="td2">${esc(d.customer_name)}</td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><p>Nenhum resultado.</p></div></td></tr>';
    return;
  }

  thead.innerHTML = '<tr><th>O.S.</th><th>Cliente</th><th>Equipamento</th><th>Data</th><th>Status</th></tr>';
  const data = allData.os
    .filter((o) => [o.number, o.customer_name, o.customer_cpf, o.serial_number, o.problem_description]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    .sort((a, b) => -sortDir * (a.number - b.number));
  tbody.innerHTML = data.length
    ? data.map((o) => `<tr><td><strong>#${esc(o.number)}</strong></td><td class="td2">${esc(o.customer_name)}</td>
        <td class="td2">${esc(o.device_type)} — ${esc(o.serial_number)}</td>
        <td class="td2">${fmtDate(o.opening_date)}</td><td>${badgeStatus(o.status)}</td></tr>`).join('')
    : '<tr><td colspan="5"><div class="empty"><p>Nenhum resultado.</p></div></td></tr>';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;

  // O Técnico enxerga apenas as próprias ordens de serviço.
  if (currentRole() === 'technician') {
    const sel = document.getElementById('filter-cat');
    sel.innerHTML = '<option value="os">Minhas Ordens de Serviço</option>';
  }

  loadStats();
  loadData();

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
