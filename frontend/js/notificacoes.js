// Central de Notificações — Administrador da Plataforma.
let solicitacoes = [];

const STATUS = {
  pending: ['Aguardando análise', 'badge-todo'],
  in_service: ['Em atendimento', 'badge-prog'],
  done: ['Concluída', 'badge-done'],
  rejected: ['Recusada', 'badge-del'],
};

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

async function carregarSolicitacoes() {
  const box = document.getElementById('notificacoes');
  if (!box) return;
  box.innerHTML = stateMsg('loading', 'Carregando solicitações...');
  try {
    const filtro = document.getElementById('filtro-solic').value;
    const res = await authFetch(`${API_URL}/platform/plan-requests?status=${encodeURIComponent(filtro)}&t=${Date.now()}`);
    if (!res.ok) throw new Error('requests');
    solicitacoes = await res.json();
    renderSolicitacoes();
    atualizarContadores();
  } catch (e) {
    console.error(e);
    box.innerHTML = stateMsg('error', 'Não foi possível carregar as solicitações.');
  }
}

function atualizarContadores() {
  const pendentes = solicitacoes.filter((s) => s.status === 'pending').length;
  document.getElementById('sub-count').textContent =
    `${pendentes} pendente${pendentes !== 1 ? 's' : ''} · ${solicitacoes.length} solicitação${solicitacoes.length !== 1 ? 'ões' : ''}`;
}

function renderSolicitacoes() {
  const box = document.getElementById('notificacoes');
  if (!solicitacoes.length) {
    box.innerHTML = stateMsg('empty', 'Nenhuma solicitação de alteração de plano encontrada.');
    return;
  }

  box.innerHTML = solicitacoes.map((s) => {
    const [label, cls] = STATUS[s.status] || [s.status_label || s.status, 'badge-todo'];
    return `<article class="pay-card notification-card">
      <div class="pay-card-hd">
        <div>
          <strong>${esc(s.company_name || 'Empresa não identificada')}</strong>
          <div class="stat-lbl">Solicitação recebida em ${fmtDateTime(s.created_at)}</div>
        </div>
        <span class="badge ${cls}">${esc(label)}</span>
      </div>
      <div class="notification-grid">
        <div><span>Solicitante</span><strong>${esc(s.requester_name || '—')}</strong></div>
        <div><span>E-mail</span><strong>${esc(s.requester_email || '—')}</strong></div>
        <div><span>Plano atual</span><strong>${esc(s.current_plan_name || '—')}</strong></div>
        <div><span>Plano solicitado</span><strong>${esc(s.desired_plan_name || 'A definir')}</strong></div>
      </div>
      ${s.message ? `<div class="notification-message"><span>Mensagem da empresa</span><p>${esc(s.message)}</p></div>` : ''}
      <div class="fg">
        <label for="st-${s.id}">Situação</label>
        <select class="fc" id="st-${s.id}">
          ${Object.keys(STATUS).map((k) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${STATUS[k][0]}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label for="nt-${s.id}">Resposta à empresa</label>
        <textarea class="fc" id="nt-${s.id}" rows="3" placeholder="Informe condições, prazo ou orientações para a empresa...">${esc(s.answer || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="salvarSolicitacao('${s.id}', this)">
        <i class="fas fa-paper-plane"></i> Atualizar e notificar
      </button>
    </article>`;
  }).join('');
}

async function salvarSolicitacao(id, btn) {
  const status = document.getElementById(`st-${id}`).value;
  const answer = document.getElementById(`nt-${id}`).value.trim();
  await runAction(btn, async () => {
    try {
      const res = await authFetch(`${API_URL}/platform/plan-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, answer }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Não foi possível atualizar a solicitação.', 'err');
      toast(data.message || 'Solicitação atualizada.', 'ok');
      await carregarSolicitacoes();
    } catch (e) {
      console.error(e);
      toast('Falha de comunicação com o servidor.', 'err');
    }
    return undefined;
  }, 'Salvando...');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  carregarSolicitacoes();
  document.getElementById('filtro-solic').addEventListener('change', carregarSolicitacoes);
  // Mantém a central atualizada sem exigir recarregamento manual da página.
  window.setInterval(carregarSolicitacoes, 30000);
});
