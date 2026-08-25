// ─────────────────────────────────────────────────────────────
// Tela "Plano e Assinatura" — Administrador da Empresa.
// Consome /billing: plano atual, troca de plano (upgrade/downgrade),
// geração da cobrança no Mercado Pago e histórico de pagamentos.
// ─────────────────────────────────────────────────────────────
let assinatura = null;
let planos = [];
let pagamentos = [];

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

const money = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dia = (v) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

async function carregar() {
  try {
    const [sRes, pRes, hRes] = await Promise.all([
      authFetch(`${API_URL}/billing/subscription?t=${Date.now()}`),
      authFetch(`${API_URL}/billing/plans?t=${Date.now()}`),
      authFetch(`${API_URL}/billing/payments?t=${Date.now()}`),
    ]);
    if (!sRes.ok) throw new Error('subscription');
    assinatura = await sRes.json();
    planos = pRes.ok ? await pRes.json() : [];
    pagamentos = hRes.ok ? await hRes.json() : [];
    renderResumo();
    renderPlanos();
    renderHistorico();
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os dados da assinatura.', 'err');
  }
}

function renderResumo() {
  const [label, cls] = TENANT_LABEL[assinatura.status] || ['—', 'badge-open'];
  document.getElementById('sub-count').textContent =
    `Plano ${assinatura.plan_name || '—'} · ${money(assinatura.monthly_price)}/mês`;

  document.getElementById('resumo').innerHTML = `
    <article class="card">
      <span class="card-label">Plano atual</span>
      <strong class="card-value">${esc(assinatura.plan_name || '—')}</strong>
      <span class="card-hint">${esc(assinatura.plan_description || 'Plano contratado pela empresa.')}</span>
    </article>
    <article class="card">
      <span class="card-label">Mensalidade</span>
      <strong class="card-value">${money(assinatura.monthly_price)}</strong>
      <span class="card-hint">Cobrança mensal recorrente</span>
    </article>
    <article class="card">
      <span class="card-label">Situação da assinatura</span>
      <strong class="card-value"><span class="badge ${cls}">${label}</span></strong>
      <span class="card-hint">Próximo vencimento: ${dia(assinatura.next_due_date)}</span>
    </article>`;

  const pendente = assinatura.pagamento_pendente;
  const btn = document.getElementById('btn-pagar');
  if (btn) {
    btn.innerHTML = pendente && pendente.checkout_url
      ? '<i class="fas fa-credit-card"></i> Pagar mensalidade em aberto'
      : '<i class="fas fa-credit-card"></i> Gerar cobrança';
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
    if (!can(el.dataset.requires)) el.style.display = 'none';
  });
}

function linhaLink(p) {
  return p.checkout_url
    ? `<a class="btn-link" href="${esc(p.checkout_url)}" target="_blank" rel="noopener">Abrir pagamento</a>`
    : '—';
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

  tbody.innerHTML = pagamentos.map((p) => {
    const [label, cls] = STATUS_LABEL[p.status] || [p.status, 'badge-open'];
    return `<tr>
      <td><strong>${dia(p.reference_month || p.created_at)}</strong></td>
      <td class="td2">${esc(p.plan_name || '—')}</td>
      <td>${money(p.amount)}</td>
      <td class="td2">${dia(p.due_date)}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td>${linhaLink(p)}</td>
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
      <p><span>Pagamento</span> ${linhaLink(p)}</p>
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
    if (!res.ok) return toast(data.message || 'Não foi possível alterar o plano.', 'err');
    toast(data.message, 'ok');
    await carregar();
  } catch (e) {
    console.error(e);
    toast('Falha de comunicação com o servidor.', 'err');
  }
}

async function pagar() {
  const pendente = assinatura && assinatura.pagamento_pendente;
  if (pendente && pendente.checkout_url) {
    window.open(pendente.checkout_url, '_blank', 'noopener');
    return;
  }
  try {
    const res = await authFetch(`${API_URL}/billing/checkout`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return toast(data.message || 'Não foi possível gerar a cobrança.', 'err');
    toast(data.message || 'Cobrança gerada.', 'ok');
    if (data.checkout_url) window.open(data.checkout_url, '_blank', 'noopener');
    await carregar();
  } catch (e) {
    console.error(e);
    toast('Falha de comunicação com o servidor.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-pagar');
  if (btn) btn.addEventListener('click', pagar);
  carregar();
});
