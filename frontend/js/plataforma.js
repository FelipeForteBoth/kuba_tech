// Painel da Plataforma — visão do Administrador da Plataforma (SaaS).
let tenants = [];
let plans = [];
let sortDir = 1;
let solicitacoes = [];

const STATUS_LABEL = { active: 'Ativa', suspended: 'Suspensa', canceled: 'Cancelada' };
const STATUS_BADGE = { active: 'badge-done', suspended: 'badge-prog', canceled: 'badge-del' };

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

// Dias restantes até o cancelamento automático (2 meses suspensa).
function diasParaCancelar(suspendedAt) {
  if (!suspendedAt) return null;
  const limite = new Date(suspendedAt);
  limite.setMonth(limite.getMonth() + 2);
  return Math.ceil((limite - new Date()) / 86400000);
}

const REQ_STATUS = {
  sent: ['Solicitação enviada', 'badge-todo'],
  in_service: ['Em atendimento', 'badge-prog'],
  info_sent: ['Informações enviadas', 'badge-prog'],
  awaiting_confirmation: ['Aguardando confirmação', 'badge-prog'],
  confirmed: ['Pagamento confirmado', 'badge-done'],
  canceled: ['Cancelada', 'badge-del'],
};

// ── Solicitações manuais de pagamento (Pix / boleto) ──
async function loadSolicitacoes() {
  const box = document.getElementById('solicitacoes');
  if (!box) return;
  const filtro = document.getElementById('filtro-solic').value;
  box.innerHTML = stateMsg('loading', 'Carregando solicitações...');
  try {
    const res = await authFetch(`${API_URL}/platform/payment-requests?status=${filtro}&t=${Date.now()}`);
    if (!res.ok) throw new Error('requests');
    solicitacoes = await res.json();
    renderSolicitacoes();
  } catch (e) {
    console.error(e);
    box.innerHTML = stateMsg('error', 'Não foi possível carregar as solicitações.');
  }
}

function renderSolicitacoes() {
  const box = document.getElementById('solicitacoes');
  if (!solicitacoes.length) {
    box.innerHTML = stateMsg('empty', 'Nenhuma solicitação de pagamento no momento.');
    return;
  }
  box.innerHTML = solicitacoes.map((s) => {
    const [label, cls] = REQ_STATUS[s.status] || [s.status_label || s.status, 'badge-todo'];
    return `<article class="pay-card">
      <div class="pay-card-hd">
        <strong>${esc(s.company_name || '—')}</strong>
        <span class="badge ${cls}">${esc(label)}</span>
      </div>
      <p><span>Plano</span> ${esc(s.plan_name || '—')} · ${money(s.amount)}</p>
      <p><span>Forma</span> ${esc(s.method_label || s.method)}</p>
      <p><span>Solicitante</span> ${esc(s.requester_name || '—')} · ${fmtDateTime(s.created_at)}</p>
      <div class="fg">
        <label for="st-${s.id}">Atualizar situação</label>
        <select class="fc" id="st-${s.id}">
          ${Object.keys(REQ_STATUS).map((k) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${REQ_STATUS[k][0]}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label for="nt-${s.id}">Observações enviadas à empresa</label>
        <textarea class="fc" id="nt-${s.id}" rows="2" placeholder="Chave Pix, código do boleto ou orientações...">${esc(s.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="salvarSolicitacao('${s.id}', this)">
        <i class="fas fa-paper-plane"></i> Atualizar e notificar
      </button>
    </article>`;
  }).join('');
}

async function salvarSolicitacao(id, btn) {
  const status = document.getElementById(`st-${id}`).value;
  const notes = document.getElementById(`nt-${id}`).value.trim();
  await runAction(btn, async () => {
    try {
      const res = await authFetch(`${API_URL}/platform/payment-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Não foi possível atualizar a solicitação.', 'err');
      toast(data.message || 'Solicitação atualizada.', 'ok');
      await Promise.all([loadSolicitacoes(), loadTudo()]);
    } catch (e) {
      console.error(e);
      toast('Falha de comunicação com o servidor.', 'err');
    }
    return undefined;
  }, 'Salvando...');
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
    document.getElementById('s-suspensas').textContent = m.empresas_suspensas ?? 0;
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
        <div class="stat-lbl">${money(p.monthly_price)} / mês · ${(p.modules || []).length} módulos</div>
        <div class="stat-lbl">${(p.modules || []).map(esc).join(', ') || 'sem módulos'}</div>
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
  tbody.innerHTML = data.map((t) => {
    const dias = t.status === 'suspended' ? diasParaCancelar(t.suspended_at) : null;
    const aviso = dias !== null
      ? `<br><span class="stat-lbl">cancela em ${Math.max(dias, 0)} dia(s)</span>` : '';
    return `
    <tr onclick="viewEmpresa('${t.id}')">
      <td><strong>${esc(t.company_name)}</strong></td>
      <td class="td2 mono">${esc(t.document)}</td>
      <td class="td2">${esc(t.plan_name || '—')}</td>
      <td class="td2">${t.users_count}</td>
      <td class="td2">${t.orders_count}</td>
      <td><span class="badge ${STATUS_BADGE[t.status]}">${STATUS_LABEL[t.status]}</span>${aviso}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`;
  }).join('');
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

  const dias = t.status === 'suspended' ? diasParaCancelar(t.suspended_at) : null;

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
        ${plans.map((p) => `<option value="${p.id}" ${p.id === t.plan_id ? 'selected' : ''}>${esc(p.name)} — ${money(p.monthly_price)} — ${(p.modules || []).length} módulos</option>`).join('')}
      </select></div>
    <div class="fg"><label>Situação da assinatura</label>
      <select class="fc" id="f-status">
        ${Object.keys(STATUS_LABEL).map((s) => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
      </select></div>
    ${t.status === 'suspended' ? `
    <div class="d-field"><div class="d-lbl">Suspensa desde</div><div class="d-val">${fmtDateTime(t.suspended_at)}</div></div>
    <div class="d-field"><div class="d-lbl">Cancelamento automático</div>
      <div class="d-val">Em ${Math.max(dias || 0, 0)} dia(s) — 2 meses após a suspensão.</div></div>` : ''}
    <div class="d-field"><div class="d-lbl">Usuários</div><div class="d-val">${t.users_count}</div></div>
    <div class="d-field"><div class="d-lbl">Ordens de serviço</div><div class="d-val">${t.orders_count}</div></div>`;

  const acoes = [];
  if (t.status === 'canceled') {
    acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteEmpresa('${t.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  }
  acoes.push(`<button class="btn btn-ghost btn-sm" onclick="enviarCobranca('${t.id}')"><i class="fas fa-envelope"></i> Enviar cobrança</button>`);
  acoes.push('<button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Fechar</button>');
  acoes.push(`<button class="btn btn-primary btn-sm" onclick="saveEmpresa('${t.id}')"><i class="fas fa-save"></i> Salvar</button>`);
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();
}

// ── Nova empresa contratante ──
function newEmpresa() {
  document.getElementById('drawer-title').textContent = 'Nova Empresa';
  document.getElementById('drawer-mode').textContent = 'Cadastro de contratante';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-building"></i> Dados da Empresa</div>
    <div class="fg"><label>Razão social *</label><input class="fc" id="n-nome" placeholder="Assistência Técnica LTDA"></div>
    <div class="fg"><label>CNPJ *</label><input class="fc" id="n-cnpj" data-mask="cnpj" placeholder="00.000.000/0000-00" maxlength="18">
      <span class="stat-lbl">A razão social e o endereço são preenchidos automaticamente pela Receita Federal.</span></div>
    <div class="fg"><label>E-mail da empresa *</label><input class="fc" id="n-email" type="email" placeholder="contato@empresa.com.br"></div>
    <div class="fg"><label>Telefone</label><input class="fc" id="n-fone" data-mask="phone" placeholder="(00) 00000-0000" maxlength="15"></div>
    <div class="fg"><label>CEP</label><input class="fc" id="n-cep" maxlength="9" placeholder="00000-000"></div>
    <div class="fg"><label>Endereço</label><input class="fc" id="n-rua" placeholder="Rua, número"></div>
    <div class="grid-2">
      <div class="fg"><label>Bairro</label><input class="fc" id="n-bairro"></div>
      <div class="fg"><label>Cidade</label><input class="fc" id="n-cidade"></div>
    </div>
    <div class="fg"><label>Estado (UF)</label><input class="fc" id="n-uf" maxlength="2"></div>
    <div class="fg"><label>Plano *</label>
      <select class="fc" id="n-plano">
        ${plans.map((p) => `<option value="${p.id}">${esc(p.name)} — ${money(p.monthly_price)} — ${(p.modules || []).length} módulos</option>`).join('')}
      </select></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user-shield"></i> Administrador da Empresa</div>
    <div class="fg"><label>Nome completo *</label><input class="fc" id="n-adm-nome" placeholder="Maria da Silva"></div>
    <div class="fg"><label>E-mail de acesso *</label><input class="fc" id="n-adm-email" type="email" placeholder="admin@empresa.com.br"></div>
    <div class="fg"><label>Senha * (mín. 8 caracteres, com letras e números)</label>
      <input class="fc" id="n-senha" type="password" placeholder="••••••••"></div>`;
  bindCNPJEmpresa();
  bindCEP('n-cep', {
    logradouro: 'n-rua', bairro: 'n-bairro', cidade: 'n-cidade', estado: 'n-uf',
  });

  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="createEmpresa()"><i class="fas fa-save"></i> Cadastrar</button>`;
  openDrawer();
}

// Consulta automática do CNPJ: razão social + endereço da Receita Federal.
function bindCNPJEmpresa() {
  const campo = document.getElementById('n-cnpj');
  if (!campo) return;
  let ultimo = '';
  const consultar = async () => {
    const digitos = onlyDigits(campo.value);
    if (digitos.length !== 14 || digitos === ultimo) return;
    if (!isValidCNPJ(digitos)) {
      fieldHint(campo, 'CNPJ inválido: confira os dígitos verificadores.', 'err');
      return;
    }
    ultimo = digitos;
    fieldHint(campo, 'Consultando a Receita Federal...', 'loading');
    try {
      const r = await consultarCNPJ(digitos);
      if (r.unavailable) {
        fieldHint(campo, 'Consulta indisponível agora. Preencha manualmente.', 'err');
        return;
      }
      const d = r.data || {};
      preencherCampo(document.getElementById('n-nome'), d.razaoSocial || d.nomeFantasia);
      if (d.email) preencherCampo(document.getElementById('n-email'), d.email);
      if (d.telefone) preencherCampo(document.getElementById('n-fone'), maskPhone(d.telefone));
      preencherCampo(document.getElementById('n-cep'), d.cep ? maskCEP(d.cep) : '');
      preencherCampo(document.getElementById('n-rua'), [d.logradouro, d.numero].filter(Boolean).join(', '));
      preencherCampo(document.getElementById('n-bairro'), d.bairro);
      preencherCampo(document.getElementById('n-cidade'), d.cidade);
      preencherCampo(document.getElementById('n-uf'), d.estado);
      fieldHint(campo, 'Razão social e endereço preenchidos. Revise antes de salvar.', 'ok');
    } catch (e) {
      ultimo = '';
      fieldHint(campo, e.message || 'Não foi possível consultar o CNPJ.', 'err');
    }
  };
  campo.addEventListener('blur', consultar);
  campo.addEventListener('input', () => { if (onlyDigits(campo.value).length === 14) consultar(); });
}

async function createEmpresa() {
  const body = {
    companyName: document.getElementById('n-nome').value.trim(),
    document: document.getElementById('n-cnpj').value.trim(),
    companyEmail: document.getElementById('n-email').value.trim(),
    phone: document.getElementById('n-fone').value.trim(),
    planId: document.getElementById('n-plano').value,
    adminName: document.getElementById('n-adm-nome').value.trim(),
    adminEmail: document.getElementById('n-adm-email').value.trim(),
    password: document.getElementById('n-senha').value,
    zipCode: document.getElementById('n-cep').value.trim(),
    address: document.getElementById('n-rua').value.trim(),
    neighborhood: document.getElementById('n-bairro').value.trim(),
    city: document.getElementById('n-cidade').value.trim(),
    state: document.getElementById('n-uf').value.trim().toUpperCase(),
  };

  if (body.companyName.length < 3) return toast('Informe a razão social.', 'err');
  if (body.document.replace(/\D/g, '').length !== 14) return toast('CNPJ inválido.', 'err');
  if (!body.companyEmail.includes('@')) return toast('E-mail da empresa inválido.', 'err');
  if (!body.planId) return toast('Selecione um plano.', 'err');
  if (body.adminName.split(' ').filter(Boolean).length < 2) return toast('Informe o nome completo do administrador.', 'err');
  if (!body.adminEmail.includes('@')) return toast('E-mail do administrador inválido.', 'err');
  if (body.password.length < 8) return toast('A senha deve ter ao menos 8 caracteres.', 'err');

  try {
    const res = await authFetch(`${API_URL}/platform/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao cadastrar a empresa.', 'err');
    toast('Empresa cadastrada com sucesso.');
    closeDrawer();
    loadTudo();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

/** Envia manualmente, por e-mail, a cobrança da mensalidade em atraso. */
async function enviarCobranca(id) {
  if (!confirm('Enviar a cobrança da mensalidade por e-mail para esta empresa?')) return;
  try {
    const res = await authFetch(`${API_URL}/platform/tenants/${id}/charge`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return toast(data.message || 'Não foi possível enviar a cobrança.', 'err');
    toast(data.message, 'ok');
  } catch (e) {
    console.error(e);
    toast('Falha de comunicação com o servidor.', 'err');
  }
}

async function deleteEmpresa(id) {
  const t = tenants.find((x) => x.id === id);
  if (!t) return;
  if (t.status !== 'canceled') {
    return toast('Só é possível excluir empresas com a assinatura cancelada.', 'err');
  }
  if (!confirm(`Excluir definitivamente "${t.company_name}" e todos os seus dados?`)) return;

  try {
    const res = await authFetch(`${API_URL}/platform/tenants/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir a empresa.', 'err');
    toast('Empresa excluída.');
    closeDrawer();
    loadTudo();
  } catch {
    toast('Erro de conexão.', 'err');
  }
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
  loadSolicitacoes();
  const filtro = document.getElementById('filtro-solic');
  if (filtro) filtro.addEventListener('change', loadSolicitacoes);
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', newEmpresa);
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
