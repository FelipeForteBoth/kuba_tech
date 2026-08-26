// ─────────────────────────────────────────────────────────────
// Tela "Plano e Assinatura" — Administrador da Empresa.
// Consome /billing: plano atual, troca de plano (upgrade/downgrade),
// solicitação MANUAL de renovação (Pix ou boleto) e histórico.
// Não há gateway automático: a equipe Kuba Tech envia as informações
// de pagamento por e-mail e confirma a baixa.
// ─────────────────────────────────────────────────────────────
let assinatura = null;
let planos = [];
let pagamentos = [];
let solicitacoes = [];

const STATUS_LABEL = {
  pending: ['Aguardando pagamento', 'badge-open'],
  in_process: ['Em análise', 'badge-open'],
  approved: ['Pago', 'badge-done'],
  rejected: ['Recusado', 'badge-del'],
  cancelled: ['Cancelado', 'badge-del'],
};

const TENANT_LABEL = {
  active: ['Ativa', 'badge-done'],
  suspended: ['Suspensa', 'badge-open'],
  canceled: ['Cancelada', 'badge-del'],
};

// Andamento da solicitação manual de pagamento.
const REQ_LABEL = {
  sent: ['Solicitação enviada', 'badge-todo'],
  in_service: ['Em atendimento', 'badge-prog'],
  info_sent: ['Informações enviadas', 'badge-prog'],
  awaiting_confirmation: ['Aguardando confirmação', 'badge-prog'],
  confirmed: ['Pagamento confirmado', 'badge-done'],
  canceled: ['Cancelada', 'badge-del'],
};

const METODO_LABEL = { pix: 'Pix', boleto: 'Boleto' };

const money = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dia = (v) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

async function carregar() {
  const resumo = document.getElementById('resumo');
  resumo.innerHTML = stateMsg('loading', 'Carregando sua assinatura...');
  try {
    const [sRes, pRes, hRes, rRes] = await Promise.all([
      authFetch(`${API_URL}/billing/subscription?t=${Date.now()}`),
      authFetch(`${API_URL}/billing/plans?t=${Date.now()}`),
      authFetch(`${API_URL}/billing/payments?t=${Date.now()}`),
      authFetch(`${API_URL}/billing/requests?t=${Date.now()}`),
    ]);
    if (!sRes.ok) throw new Error('subscription');
    assinatura = await sRes.json();
    planos = pRes.ok ? await pRes.json() : [];
    pagamentos = hRes.ok ? await hRes.json() : [];
    solicitacoes = rRes.ok ? await rRes.json() : [];
    renderResumo();
    renderPlanos();
    renderSolicitacoes();
    renderHistorico();
  } catch (e) {
    console.error(e);
    resumo.innerHTML = stateMsg('error', 'Não foi possível carregar os dados da assinatura.');
    toast('Não foi possível carregar os dados da assinatura.', 'err');
  }
}

function renderResumo() {
  const [label, cls] = TENANT_LABEL[assinatura.status] || ['—', 'badge-open'];
  document.getElementById('sub-count').textContent =
    `Plano ${assinatura.plan_name || '—'} · ${money(assinatura.monthly_price)}/mês`;

  const aberta = assinatura.solicitacao_aberta;
  const [rl, rc] = aberta ? (REQ_LABEL[aberta.status] || [aberta.status, 'badge-todo']) : [];

  document.getElementById('resumo').innerHTML = `
    <article class="card">
      <span class="card-label">Plano atual</span>
      <strong class="card-value">${esc(assinatura.plan_name || '—')}</strong>
      <span class="card-hint">${esc(assinatura.plan_description || 'Plano contratado pela empresa.')}</span>
    </article>
    <article class="card">
      <span class="card-label">Mensalidade</span>
      <strong class="card-value">${money(assinatura.monthly_price)}</strong>
      <span class="card-hint">Cobrança mensal · pagamento por Pix ou boleto</span>
    </article>
    <article class="card">
      <span class="card-label">Situação da assinatura</span>
      <strong class="card-value"><span class="badge ${cls}">${label}</span></strong>
      <span class="card-hint">Próximo vencimento: ${dia(assinatura.next_due_date)}</span>
    </article>
    <article class="card">
      <span class="card-label">Solicitação de pagamento</span>
      <strong class="card-value">${aberta ? `<span class="badge ${rc}">${esc(rl)}</span>` : '<span class="badge badge-todo">Nenhuma em aberto</span>'}</strong>
      <span class="card-hint">${aberta
        ? `${esc(METODO_LABEL[aberta.method] || aberta.method)} · enviada em ${dia(aberta.created_at)}`
        : 'Clique em "Renovar assinatura" para solicitar as informações de pagamento.'}</span>
    </article>`;

  const btn = document.getElementById('btn-pagar');
  if (btn) {
    btn.disabled = Boolean(aberta);
    btn.title = aberta ? 'Já existe uma solicitação em andamento.' : '';
    btn.innerHTML = aberta
      ? '<i class="fas fa-hourglass-half"></i> Solicitação em andamento'
      : '<i class="fas fa-rotate"></i> Renovar assinatura';
  }
}

function renderPlanos() {
  document.getElementById('planos').innerHTML = planos.map((p) => {
    const atual = p.id === assinatura.plan_id;
    const acao = atual
      ? '<span class="badge badge-done">Plano atual</span>'
      : `<button class="btn btn-ghost" data-requires="companySettings"
            onclick="trocarPlano('${p.id}','${esc(p.name)}')">
            ${Number(p.monthly_price) > Number(assinatura.monthly_price) ? 'Fazer upgrade' : 'Fazer downgrade'}
         </button>`;
    return `
      <article class="plan-card${atual ? ' plan-card-current' : ''}">
        <h3>${esc(p.name)}</h3>
        <p class="plan-price">${money(p.monthly_price)}<span>/mês</span></p>
        <p class="plan-desc">${esc(p.description || '')}</p>
        <p class="plan-desc">Até ${p.max_users} usuários</p>
        ${acao}
      </article>`;
  }).join('');
  document.querySelectorAll('#planos [data-requires]').forEach((el) => {
    if (!can(el.dataset.requires)) el.remove();
  });
}

// ── Solicitações manuais ──
function renderSolicitacoes() {
  const box = document.getElementById('solicitacoes');
  if (!box) return;
  if (!solicitacoes.length) {
    box.innerHTML = stateMsg('empty', 'Nenhuma solicitação de pagamento registrada.');
    return;
  }
  box.innerHTML = solicitacoes.map((s) => {
    const [label, cls] = REQ_LABEL[s.status] || [s.status, 'badge-todo'];
    return `<article class="pay-card">
      <div class="pay-card-hd">
        <strong>${esc(METODO_LABEL[s.method] || s.method)} · ${esc(s.plan_name || '—')}</strong>
        <span class="badge ${cls}">${esc(label)}</span>
      </div>
      <p><span>Valor</span> ${money(s.amount)}</p>
      <p><span>Enviada em</span> ${dia(s.created_at)}</p>
      <p><span>Solicitante</span> ${esc(s.requester_name || '—')}</p>
      ${s.notes ? `<p><span>Kuba Tech</span> ${esc(s.notes)}</p>` : ''}
    </article>`;
  }).join('');
}

function renderHistorico() {
  const tbody = document.getElementById('tbody');
  const cards = document.getElementById('cards');

  if (!pagamentos.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty"><i class="fas fa-receipt"></i>
      <p>Nenhuma cobrança registrada até o momento.</p></div></td></tr>`;
    cards.innerHTML = '';
    return;
  }

  const metodo = (p) => esc(METODO_LABEL[p.method] || (p.method || '—'));

  tbody.innerHTML = pagamentos.map((p) => {
    const [label, cls] = STATUS_LABEL[p.status] || [p.status, 'badge-open'];
    return `<tr>
      <td><strong>${dia(p.created_at)}</strong></td>
      <td class="td2">${esc(p.plan_name || '—')}</td>
      <td>${money(p.amount)}</td>
      <td class="td2">${dia(p.due_date)}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td class="td2">${metodo(p)}</td>
    </tr>`;
  }).join('');

  cards.innerHTML = pagamentos.map((p) => {
    const [label, cls] = STATUS_LABEL[p.status] || [p.status, 'badge-open'];
    return `<article class="pay-card">
      <div class="pay-card-hd">
        <strong>${esc(p.plan_name || '—')}</strong>
        <span class="badge ${cls}">${label}</span>
      </div>
      <p><span>Valor</span> ${money(p.amount)}</p>
      <p><span>Vencimento</span> ${dia(p.due_date)}</p>
      <p><span>Forma de pagamento</span> ${metodo(p)}</p>
    </article>`;
  }).join('');
}

async function trocarPlano(planId, nome) {
  if (!confirm(`Confirma a alteração para o plano ${nome}?`)) return;
  try {
    const res = await authFetch(`${API_URL}/billing/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || data.message || 'Não foi possível alterar o plano.', 'err');
    toast(data.message, 'ok');
    await carregar();
  } catch (e) {
    console.error(e);
    toast('Falha de comunicação com o servidor.', 'err');
  }
  return undefined;
}

// ── Modal: renovar assinatura (etapa 1 — forma de pagamento) ──
function fecharModalRenovacao() {
  const m = document.getElementById('modal-renovar');
  if (m) m.remove();
  document.body.classList.remove('no-scroll');
}

function abrirRenovacao() {
  if (assinatura && assinatura.solicitacao_aberta) {
    toast('Já existe uma solicitação em andamento.', 'err');
    return;
  }
  document.body.classList.add('no-scroll');
  const el = document.createElement('div');
  el.className = 'modal-ov';
  el.id = 'modal-renovar';
  el.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="tit-renovar">
      <div class="modal-hd">
        <h2 class="drawer-title" id="tit-renovar">Renovar assinatura</h2>
        <button class="drawer-x" type="button" onclick="fecharModalRenovacao()" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px;">Escolha a forma de pagamento. Enviaremos sua solicitação para a equipe Kuba Tech,
          que responderá por e-mail com as informações do pagamento.</p>
        <div class="f">
          <label for="metodo-pag">Forma de pagamento</label>
          <select id="metodo-pag">
            <option value="pix">Pix</option>
            <option value="boleto">Boleto bancário</option>
          </select>
        </div>
        <p class="card-hint">Plano ${esc(assinatura.plan_name || '—')} · ${money(assinatura.monthly_price)} ·
          vencimento ${dia(assinatura.next_due_date)}</p>
      </div>
      <div class="modal-ft">
        <button class="btn btn-ghost" type="button" onclick="fecharModalRenovacao()">Cancelar</button>
        <button class="btn btn-primary" type="button" id="btn-enviar-solic">
          <i class="fas fa-paper-plane"></i> Enviar solicitação
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) fecharModalRenovacao(); });
  document.getElementById('btn-enviar-solic').addEventListener('click', enviarSolicitacao);
}

// ── Etapa 2 — envio da solicitação ──
async function enviarSolicitacao() {
  const btn = document.getElementById('btn-enviar-solic');
  const method = document.getElementById('metodo-pag').value;

  await runAction(btn, async () => {
    try {
      const res = await authFetch(`${API_URL}/billing/renewal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Não foi possível enviar a solicitação.', 'err');
      fecharModalRenovacao();
      toast(data.message || 'Solicitação enviada.', 'ok');
      await carregar();
    } catch (e) {
      console.error(e);
      toast('Falha de comunicação com o servidor.', 'err');
    }
    return undefined;
  }, 'Enviando...');
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-pagar');
  if (btn) btn.addEventListener('click', abrirRenovacao);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModalRenovacao(); });
  carregar();
});
