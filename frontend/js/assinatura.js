// ─────────────────────────────────────────────────────────────
// Tela "Meu Plano" — Administrador da Empresa.
// Consome /api/plan: plano contratado, módulos liberados, catálogo
// de planos e solicitações de alteração.
//
// A plataforma NÃO processa pagamentos: a alteração de plano é um
// pedido registrado e tratado comercialmente pela equipe Kuba Tech.
// ─────────────────────────────────────────────────────────────
let assinatura = null;
let planos = [];
let solicitacoes = [];

const TENANT_LABEL = {
  active: ['Ativa', 'badge-done'],
  suspended: ['Suspensa', 'badge-open'],
  canceled: ['Cancelada', 'badge-del'],
};

const REQ_LABEL = {
  pending: ['Aguardando análise', 'badge-todo'],
  in_service: ['Em atendimento', 'badge-prog'],
  done: ['Concluída', 'badge-done'],
  rejected: ['Recusada', 'badge-del'],
};

const money = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dia = (v) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

async function carregar() {
  const resumo = document.getElementById('resumo');
  resumo.innerHTML = stateMsg('loading', 'Carregando o seu plano...');
  try {
    const [sRes, pRes, rRes] = await Promise.all([
      authFetch(`${API_URL}/plan/subscription?t=${Date.now()}`),
      authFetch(`${API_URL}/plan/plans?t=${Date.now()}`),
      authFetch(`${API_URL}/plan/requests?t=${Date.now()}`),
    ]);
    if (!sRes.ok) throw new Error('subscription');
    assinatura = await sRes.json();
    planos = pRes.ok ? await pRes.json() : [];
    solicitacoes = rRes.ok ? await rRes.json() : [];
    renderResumo();
    renderModulos();
    renderPlanos();
    renderSolicitacoes();
  } catch (e) {
    console.error(e);
    resumo.innerHTML = stateMsg('error', 'Não foi possível carregar os dados do plano.');
    toast('Não foi possível carregar os dados do plano.', 'err');
  }
}

function renderResumo() {
  const [label, cls] = TENANT_LABEL[assinatura.status] || ['—', 'badge-open'];
  const aberta = assinatura.solicitacao_aberta;
  const [rl, rc] = aberta ? (REQ_LABEL[aberta.status] || [aberta.status, 'badge-todo']) : [];

  document.getElementById('sub-count').textContent =
    `Plano ${assinatura.plan_name || '—'} · ${assinatura.modules.length} módulos liberados`;

  document.getElementById('resumo').innerHTML = `
    <article class="card">
      <span class="card-label">Plano contratado</span>
      <strong class="card-value">${esc(assinatura.plan_name || '—')}</strong>
      <span class="card-hint">${esc(assinatura.plan_description || 'Plano contratado pela empresa.')}</span>
    </article>
    <article class="card">
      <span class="card-label">Mensalidade combinada</span>
      <strong class="card-value">${money(assinatura.monthly_price)}</strong>
      <span class="card-hint">Cobrança tratada diretamente com a equipe Kuba Tech</span>
    </article>
    <article class="card">
      <span class="card-label">Situação da assinatura</span>
      <strong class="card-value"><span class="badge ${cls}">${label}</span></strong>
      <span class="card-hint">${assinatura.suspended_at
        ? `Suspensa em ${dia(assinatura.suspended_at)}`
        : 'Acesso liberado para a sua equipe'}</span>
    </article>
    <article class="card">
      <span class="card-label">Usuários da equipe</span>
      <strong class="card-value">${assinatura.users_count} / ${assinatura.max_users || '—'}</strong>
      <span class="card-hint">${aberta
        ? `Solicitação em andamento: <span class="badge ${rc}">${esc(rl)}</span>`
        : 'Limite de usuários do plano contratado'}</span>
    </article>`;

  const btn = document.getElementById('btn-solicitar');
  if (btn) {
    btn.disabled = Boolean(aberta);
    btn.title = aberta ? 'Já existe uma solicitação em andamento.' : '';
    btn.innerHTML = aberta
      ? '<i class="fas fa-hourglass-half"></i> Solicitação em andamento'
      : '<i class="fas fa-headset"></i> Solicitar alteração de plano';
  }
}

function renderModulos() {
  const box = document.getElementById('modulos');
  if (!assinatura.modules.length) {
    box.innerHTML = stateMsg('empty', 'Nenhum módulo liberado para a sua empresa.');
    return;
  }
  box.innerHTML = assinatura.modules.map((m) => `
    <article class="plan-card">
      <h3><i class="fas fa-circle-check" aria-hidden="true"></i> ${esc(m.name)}</h3>
      <p class="plan-desc">${esc(m.description || 'Módulo liberado pelo plano contratado.')}</p>
    </article>`).join('');
}

function renderPlanos() {
  document.getElementById('planos').innerHTML = planos.map((p) => {
    const atual = p.id === assinatura.plan_id;
    const acao = atual
      ? '<span class="badge badge-done">Plano atual</span>'
      : `<button class="btn btn-ghost" data-requires="companySettings"
            onclick="abrirSolicitacao('${p.id}')">
            ${Number(p.monthly_price) > Number(assinatura.monthly_price) ? 'Quero este plano' : 'Reduzir para este plano'}
         </button>`;
    return `
      <article class="plan-card${atual ? ' plan-card-current' : ''}">
        <h3>${esc(p.name)}</h3>
        <p class="plan-price">${money(p.monthly_price)}<span>/mês</span></p>
        <p class="plan-desc">${esc(p.description || '')}</p>
        <p class="plan-desc">Até ${p.max_users} usuários · ${(p.modules || []).length} módulos</p>
        <p class="plan-desc">${esc((p.modules || []).join(' · '))}</p>
        ${acao}
      </article>`;
  }).join('');
  document.querySelectorAll('#planos [data-requires]').forEach((el) => {
    if (!can(el.dataset.requires)) el.remove();
  });
}

function renderSolicitacoes() {
  const box = document.getElementById('solicitacoes');
  if (!solicitacoes.length) {
    box.innerHTML = stateMsg('empty', 'Nenhuma solicitação de alteração registrada.');
    return;
  }
  box.innerHTML = solicitacoes.map((s) => {
    const [label, cls] = REQ_LABEL[s.status] || [s.status, 'badge-todo'];
    return `<article class="pay-card">
      <div class="pay-card-hd">
        <strong>${esc(s.current_plan_name || '—')} → ${esc(s.desired_plan_name || 'A definir')}</strong>
        <span class="badge ${cls}">${esc(label)}</span>
      </div>
      <p><span>Enviada em</span> ${dia(s.created_at)}</p>
      <p><span>Solicitante</span> ${esc(s.requester_name || '—')}</p>
      ${s.message ? `<p><span>Mensagem</span> ${esc(s.message)}</p>` : ''}
      ${s.answer ? `<p><span>Kuba Tech</span> ${esc(s.answer)}</p>` : ''}
    </article>`;
  }).join('');
}

// ── Modal: solicitação de alteração de plano ──
function fecharModalPlano() {
  const m = document.getElementById('modal-plano');
  if (m) m.remove();
  document.body.classList.remove('no-scroll');
}

function abrirSolicitacao(planIdSelecionado = '') {
  if (assinatura && assinatura.solicitacao_aberta) {
    toast('Já existe uma solicitação em andamento.', 'err');
    return;
  }
  document.body.classList.add('no-scroll');
  const opcoes = planos
    .filter((p) => p.id !== assinatura.plan_id)
    .map((p) => `<option value="${p.id}" ${p.id === planIdSelecionado ? 'selected' : ''}>
        ${esc(p.name)} — ${money(p.monthly_price)}/mês</option>`).join('');

  const el = document.createElement('div');
  el.className = 'modal-ov';
  el.id = 'modal-plano';
  el.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="tit-plano">
      <div class="modal-hd">
        <h2 class="drawer-title" id="tit-plano">Solicitar alteração de plano</h2>
        <button class="drawer-x" type="button" onclick="fecharModalPlano()" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px;">Sua solicitação é enviada à equipe Kuba Tech, que entra em contato
          para combinar as condições comerciais. Nenhum pagamento é feito pelo sistema.</p>
        <div class="f">
          <label for="plano-desejado">Plano desejado</label>
          <select id="plano-desejado">
            <option value="">Quero orientação da equipe</option>
            ${opcoes}
          </select>
        </div>
        <div class="f">
          <label for="msg-plano">Mensagem (opcional)</label>
          <textarea id="msg-plano" rows="3" maxlength="1000"
            placeholder="Ex.: precisamos liberar o módulo de relatórios para o gestor."></textarea>
        </div>
      </div>
      <div class="modal-ft">
        <button class="btn btn-ghost" type="button" onclick="fecharModalPlano()">Cancelar</button>
        <button class="btn btn-primary" type="button" id="btn-enviar-solic">
          <i class="fas fa-paper-plane"></i> Enviar solicitação
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) fecharModalPlano(); });
  document.getElementById('btn-enviar-solic').addEventListener('click', enviarSolicitacao);
}

async function enviarSolicitacao() {
  const btn = document.getElementById('btn-enviar-solic');
  const desiredPlanId = document.getElementById('plano-desejado').value;
  const message = document.getElementById('msg-plano').value.trim();

  await runAction(btn, async () => {
    try {
      const res = await authFetch(`${API_URL}/plan/change-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desiredPlanId, message }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Não foi possível enviar a solicitação.', 'err');
      fecharModalPlano();
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
  const btn = document.getElementById('btn-solicitar');
  if (btn) btn.addEventListener('click', () => abrirSolicitacao());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModalPlano(); });
  carregar();
});
