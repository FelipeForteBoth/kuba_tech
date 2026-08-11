// Tela de Ordens de Serviço — ciclo de vida completo da O.S.
let orders = [];
let customersRef = [];
let devicesRef = [];
let techniciansRef = [];
let sortDir = -1;
let editingId = null;

const STATUS = ['A Realizar', 'Em Andamento', 'Finalizada', 'Cancelada'];

// SLA padrão da empresa (horas) — configurável pelo Administrador da Empresa.
let slaPadrao = 48;

const SLA_ENCERRADAS = ['Finalizada', 'Cancelada'];

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Situação do prazo: dentro do SLA, próximo do vencimento ou atrasada. */
function slaInfo(o) {
  const horas = Number(o.sla_hours) || slaPadrao;
  if (!o.sla_due_at) return { horas, texto: `${horas}h`, cls: 'badge-todo' };
  const restante = (new Date(o.sla_due_at) - new Date()) / 3600000;
  if (SLA_ENCERRADAS.includes(o.status)) return { horas, texto: `${horas}h`, cls: 'badge-done' };
  if (restante < 0) return { horas, texto: `Atrasada ${Math.abs(Math.round(restante))}h`, cls: 'badge-del' };
  if (restante <= 8) return { horas, texto: `Vence em ${Math.round(restante)}h`, cls: 'badge-prog' };
  return { horas, texto: `${Math.round(restante)}h restantes`, cls: 'badge-todo' };
}

function fmtDate(d) {
  if (!d) return '—';
  const iso = String(d).slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function badgeStatus(s) {
  const cls = { 'A Realizar': 'badge-todo', 'Em Andamento': 'badge-prog', Finalizada: 'badge-done', Cancelada: 'badge-del' }[s] || 'badge-todo';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

async function fetchDados() {
  try {
    const requests = [
      authFetch(`${API_URL}/service-orders?t=${Date.now()}`),
      authFetch(`${API_URL}/company/settings?t=${Date.now()}`),
    ];
    if (can('orders')) {
      requests.push(
        authFetch(`${API_URL}/customers?t=${Date.now()}`),
        authFetch(`${API_URL}/devices?t=${Date.now()}`),
        authFetch(`${API_URL}/users/technicians?t=${Date.now()}`),
      );
    }
    const responses = await Promise.all(requests);
    if (!responses[0].ok) return;
    orders = await responses[0].json();
    if (responses[1] && responses[1].ok) {
      const cfg = await responses[1].json();
      slaPadrao = Number(cfg.sla_hours) || 48;
    }
    if (responses.length > 2) {
      customersRef = responses[2].ok ? await responses[2].json() : [];
      devicesRef = responses[3].ok ? await responses[3].json() : [];
      techniciansRef = responses[4].ok ? await responses[4].json() : [];
    }
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${orders.length} ordem${orders.length !== 1 ? 'ns' : ''} de serviço`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar as ordens de serviço.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty"><i class="fas fa-file-invoice"></i>
      <p>Nenhuma ordem de serviço encontrada.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((o) => `
    <tr onclick="viewOS('${o.id}')">
      <td><strong>#${esc(o.number)}</strong></td>
      <td class="td2">${esc(o.customer_name)}<br><span class="mono">${esc(o.customer_cpf)}</span></td>
      <td class="td2">${esc(o.device_type)} — ${esc(o.serial_number)}</td>
      <td class="td2">${esc(o.technician_name || 'Não atribuído')}</td>
      <td class="td2">${fmtDate(o.opening_date)}</td>
      <td class="td2"><span class="badge ${slaInfo(o).cls}">${esc(slaInfo(o).texto)}</span><br>
        <span class="stat-lbl">${fmtDateTime(o.sla_due_at)}</span></td>
      <td>${badgeStatus(o.status)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const data = orders.filter((o) => {
    const texto = [o.number, o.customer_name, o.customer_cpf, o.serial_number, o.device_type, o.technician_name, o.problem_description]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    return texto && (!status || o.status === status);
  });
  data.sort((a, b) => sortDir * (a.number - b.number));
  render(data);
}

function viewOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  editingId = null;

  document.getElementById('drawer-title').textContent = `O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Detalhes da Ordem de Serviço';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-info-circle"></i> Situação</div>
    <div class="d-field"><div class="d-lbl">Status</div><div class="d-val">${badgeStatus(o.status)}</div></div>
    <div class="d-field"><div class="d-lbl">Abertura</div><div class="d-val">${fmtDate(o.opening_date)}</div></div>
    <div class="d-field"><div class="d-lbl">SLA</div><div class="d-val">${Number(o.sla_hours) || slaPadrao} horas</div></div>
    <div class="d-field"><div class="d-lbl">Prazo de atendimento</div>
      <div class="d-val">${fmtDateTime(o.sla_due_at)} — <span class="badge ${slaInfo(o).cls}">${esc(slaInfo(o).texto)}</span></div></div>
    <div class="d-field"><div class="d-lbl">Técnico Responsável</div><div class="d-val">${esc(o.technician_name || 'Não atribuído')}</div></div>
    <div class="d-field"><div class="d-lbl">Aberta por</div><div class="d-val">${esc(o.created_by_name || '—')}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Cliente</div>
    <div class="d-field"><div class="d-lbl">Nome</div><div class="d-val">${esc(o.customer_name)}</div></div>
    <div class="d-field"><div class="d-lbl">CPF</div><div class="d-val mono">${esc(o.customer_cpf)}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Equipamento</div>
    <div class="d-field"><div class="d-lbl">Tipo</div><div class="d-val">${esc(o.device_type)}</div></div>
    <div class="d-field"><div class="d-lbl">Marca / Modelo</div><div class="d-val">${esc(o.device_brand || '—')} ${esc(o.device_model || '')}</div></div>
    <div class="d-field"><div class="d-lbl">Série</div><div class="d-val mono">${esc(o.serial_number)}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-clipboard-list"></i> Serviço</div>
    <div class="d-field"><div class="d-lbl">Defeito relatado</div><div class="d-val pre-box">${esc(o.problem_description)}</div></div>
    <div class="d-field"><div class="d-lbl">Solução aplicada</div><div class="d-val pre-box">${esc(o.solution || 'Ainda não informada.')}</div></div>`;

  const acoes = [];
  if (canDelete()) acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteOS('${o.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  if (can('orderStatus')) acoes.push(`<button class="btn btn-ghost btn-sm" onclick="statusOS('${o.id}')"><i class="fas fa-sync"></i> Andamento</button>`);
  if (can('orders')) acoes.push(`<button class="btn btn-primary btn-sm" onclick="editOS('${o.id}')"><i class="fas fa-edit"></i> Editar</button>`);
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();
}

// ── Andamento (Técnico, Atendente e Administrador) ──
function statusOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  document.getElementById('drawer-title').textContent = `O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Atualizar andamento';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-sync"></i> Andamento do Serviço</div>
    <div class="fg"><label>Status *</label>
      <select class="fc" id="f-status">
        ${STATUS.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Solução aplicada (obrigatória ao finalizar)</label>
      <textarea class="fc" id="f-solucao" rows="5" placeholder="Descreva o serviço executado...">${esc(o.solution || '')}</textarea></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewOS('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveStatus('${id}')"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function saveStatus(id) {
  const status = document.getElementById('f-status').value;
  const solution = document.getElementById('f-solucao').value.trim();
  if (status === 'Finalizada' && solution.length < 5) {
    return toast('Descreva o serviço executado para finalizar a O.S.', 'err');
  }
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, solution }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao atualizar.', 'err');
    toast('Andamento atualizado!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── Cadastro / edição completa ──
function newOS() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Nova Ordem de Serviço';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = formHTML(null);
  bindClienteChange();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = `Editar O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = formHTML(o);
  bindClienteChange();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewOS('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function deviceOptions(customerId, selected) {
  const list = devicesRef.filter((d) => !customerId || d.customer_id === customerId);
  if (!list.length) return '<option value="">Nenhum equipamento para este cliente</option>';
  return ['<option value="">Selecione o equipamento</option>']
    .concat(list.map((d) =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(d.type)} — ${esc(d.serial_number)}</option>`))
    .join('');
}

function bindClienteChange() {
  const cli = document.getElementById('f-cliente');
  if (!cli) return;
  cli.addEventListener('change', () => {
    document.getElementById('f-device').innerHTML = deviceOptions(cli.value, '');
  });
}

function formHTML(o) {
  const hoje = new Date().toISOString().slice(0, 10);
  return `
    <div class="d-section"><i class="fas fa-user"></i> Cliente e Equipamento</div>
    <div class="fg"><label>Cliente *</label>
      <select class="fc" id="f-cliente">
        <option value="">Selecione o cliente</option>
        ${customersRef.map((c) => `<option value="${c.id}" ${o && o.customer_id === c.id ? 'selected' : ''}>${esc(c.name)} — ${esc(c.cpf)}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Equipamento *</label>
      <select class="fc" id="f-device">${deviceOptions(o ? o.customer_id : '', o ? o.device_id : '')}</select></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-clipboard-list"></i> Atendimento</div>
    <div class="fg"><label>Data de abertura *</label>
      <input type="date" class="fc" id="f-data" max="${hoje}" value="${o ? String(o.opening_date).slice(0, 10) : hoje}"></div>
    <div class="fg"><label>Técnico responsável</label>
      <select class="fc" id="f-tecnico">
        <option value="">Atribuir depois</option>
        ${techniciansRef.map((t) => `<option value="${t.id}" ${o && o.technician_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Status *</label>
      <select class="fc" id="f-status">
        ${STATUS.map((s) => `<option value="${s}" ${o && o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Prazo de atendimento — SLA (horas)</label>
      <input type="number" class="fc" id="f-sla" min="1" max="8760"
        value="${o && o.sla_hours ? o.sla_hours : slaPadrao}"
        ${can('companySettings') ? '' : 'disabled'}>
      ${can('companySettings') ? '' : '<span class="stat-lbl">Somente o Administrador da Empresa altera o prazo.</span>'}</div>
    <div class="fg"><label>Defeito relatado * (mínimo 10 caracteres)</label>
      <textarea class="fc" id="f-defeito" rows="4" placeholder="Descreva o problema informado pelo cliente...">${esc(o ? o.problem_description : '')}</textarea></div>
    <div class="fg"><label>Solução aplicada</label>
      <textarea class="fc" id="f-solucao" rows="4" placeholder="Preenchida durante o atendimento...">${esc(o && o.solution ? o.solution : '')}</textarea></div>`;
}

async function saveOS() {
  const customerId = document.getElementById('f-cliente').value;
  const deviceId = document.getElementById('f-device').value;
  const openingDate = document.getElementById('f-data').value;
  const technicianId = document.getElementById('f-tecnico').value;
  const status = document.getElementById('f-status').value;
  const problemDescription = document.getElementById('f-defeito').value.trim();
  const solution = document.getElementById('f-solucao').value.trim();
  const slaField = document.getElementById('f-sla');
  const slaHours = slaField && !slaField.disabled ? Number(slaField.value) : undefined;

  if (slaHours !== undefined && (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 8760)) {
    return toast('Informe o SLA em horas (entre 1 e 8760).', 'err');
  }
  if (!customerId) return toast('Selecione o cliente.', 'err');
  if (!deviceId) return toast('Selecione o equipamento.', 'err');
  if (!isValidPastOrTodayDate(openingDate)) return toast('Data de abertura inválida (não pode ser futura).', 'err');
  if (problemDescription.length < 10) return toast('Descreva o defeito com ao menos 10 caracteres.', 'err');
  if (status === 'Finalizada' && solution.length < 5) return toast('Descreva a solução para finalizar a O.S.', 'err');

  const url = editingId ? `${API_URL}/service-orders/${editingId}` : `${API_URL}/service-orders`;
  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, deviceId, openingDate, technicianId, status, problemDescription, solution, slaHours }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Ordem de serviço salva!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteOS(id) {
  if (!confirm('Excluir esta ordem de serviço?')) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Ordem de serviço excluída.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── SLA padrão da empresa (Administrador da Empresa) ──
function configSLA() {
  document.getElementById('drawer-title').textContent = 'Prazo padrão (SLA)';
  document.getElementById('drawer-mode').textContent = 'Configuração da empresa';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-stopwatch"></i> SLA de atendimento</div>
    <p class="stat-lbl">Prazo aplicado automaticamente às novas ordens de serviço. Padrão de 48 horas.</p>
    <div class="fg"><label>Horas *</label>
      <input type="number" class="fc" id="f-sla-padrao" min="1" max="8760" value="${slaPadrao}"></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveSLAPadrao()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function saveSLAPadrao() {
  const slaHours = Number(document.getElementById('f-sla-padrao').value);
  if (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 8760) {
    return toast('Informe o SLA em horas (entre 1 e 8760).', 'err');
  }
  try {
    const res = await authFetch(`${API_URL}/company/settings/sla`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slaHours }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar o SLA.', 'err');
    slaPadrao = slaHours;
    toast('Prazo padrão atualizado.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  fetchDados();
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', newOS);
  const btnSla = document.getElementById('btn-sla');
  if (btnSla) btnSla.addEventListener('click', configSLA);
  document.getElementById('search-input').addEventListener('input', applyFilter);
  document.getElementById('filter-status').addEventListener('change', applyFilter);
  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === -1
      ? '<i class="fas fa-sort-numeric-down"></i> Mais recentes'
      : '<i class="fas fa-sort-numeric-up"></i> Mais antigas';
    applyFilter();
  });
});
