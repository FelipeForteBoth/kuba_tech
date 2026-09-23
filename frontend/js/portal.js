// ─────────────────────────────────────────────────────────────
// Portal do Cliente — consulta pública das ordens de serviço.
// CPF é o único campo obrigatório; o número da O.S. é opcional.
// Sem o número, o portal lista todas as O.S. daquele CPF, em
// qualquer empresa contratante.
// ─────────────────────────────────────────────────────────────
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function badge(status) {
  return osBadge(status);
}

function cardOS(d) {
  const progresso = Math.round((d.etapa / d.totalEtapas) * 100);
  return `
    <article class="tcard portal-card">
      <div class="portal-card-hd">
        <div>
          <strong>O.S. #${esc(d.numero)}</strong>
          <span class="stat-lbl">${esc(d.empresa.nome || 'Assistência técnica')}</span>
        </div>
        <div class="portal-card-badges">
          ${badge(d.status)}
          ${d.atrasada ? '<span class="badge badge-del">Atrasada</span>' : ''}
        </div>
      </div>

      <div class="portal-bar" aria-hidden="true"><span style="width:${progresso}%"></span></div>
      <p class="stat-lbl">Etapa ${d.etapa} de ${d.totalEtapas} · Atendimento ${d.tipo === 'externo' ? 'externo' : 'interno'}</p>

      <div class="d-field"><div class="d-lbl">Cliente</div><div class="d-val">${esc(d.cliente)}</div></div>
      <div class="d-field"><div class="d-lbl">Equipamento</div><div class="d-val">${esc(d.equipamento)}</div></div>
      <div class="d-field"><div class="d-lbl">Abertura</div><div class="d-val">${fmtDate(d.abertura)}</div></div>
      <div class="d-field"><div class="d-lbl">Previsão de atendimento</div><div class="d-val">${fmtDateTime(d.previsao)}</div></div>
      ${d.agendamento ? `<div class="d-field"><div class="d-lbl">Atendimento agendado</div><div class="d-val">${fmtDateTime(d.agendamento)}</div></div>` : ''}
      ${d.encerramento ? `<div class="d-field"><div class="d-lbl">Encerramento</div><div class="d-val">${fmtDateTime(d.encerramento)}</div></div>` : ''}

      <div class="d-divider"></div>
      <div class="d-field"><div class="d-lbl">Defeito relatado</div><div class="d-val pre-box">${esc(d.defeito)}</div></div>
      <div class="d-field"><div class="d-lbl">Solução aplicada</div><div class="d-val pre-box">${esc(d.solucao || 'Ainda não informada.')}</div></div>

      <div class="d-divider"></div>
      <div class="d-field"><div class="d-lbl">Contato da assistência</div>
        <div class="d-val">${esc(d.empresa.telefone || '—')} · ${esc(d.empresa.email || '—')}</div></div>
      <p class="stat-lbl">Atualizado em ${fmtDateTime(d.atualizadoEm)}</p>
    </article>`;
}

async function consultar() {
  const numero = document.getElementById('f-numero').value.trim();
  const cpf = document.getElementById('f-cpf').value.trim();
  const box = document.getElementById('resultado');

  if (!isValidCPF(cpf)) {
    toast('Informe um CPF válido.', 'err');
    box.innerHTML = stateMsg('error', 'Informe um CPF válido para consultar.');
    return;
  }

  box.innerHTML = stateMsg('loading', 'Buscando as suas ordens de serviço...');
  try {
    const res = await fetch(`${API_URL}/portal/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, numero: numero || undefined }),
    });
    const d = await res.json();
    if (!res.ok) {
      box.innerHTML = stateMsg('empty', d.error || 'Nenhuma ordem de serviço encontrada.');
      return;
    }

    const ordens = d.ordens || [];
    box.innerHTML = `
      <p class="page-sub portal-count">${ordens.length} ordem${ordens.length !== 1 ? 'ns' : ''} de serviço encontrada${ordens.length !== 1 ? 's' : ''}.</p>
      ${ordens.map(cardOS).join('')}`;
  } catch {
    box.innerHTML = stateMsg('error', 'Falha de conexão com o servidor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-consultar').addEventListener('click', consultar);
  ['f-cpf', 'f-numero'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') consultar();
    });
  });
});
