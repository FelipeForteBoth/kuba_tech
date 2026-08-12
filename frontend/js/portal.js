// ─────────────────────────────────────────────────────────────
// Módulo Portal do Cliente — consulta pública da O.S. (plano Empresarial).
// ─────────────────────────────────────────────────────────────
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function badge(status) {
  const map = {
    'A Realizar': 'badge-todo',
    'Em Andamento': 'badge-prog',
    Finalizada: 'badge-done',
    Cancelada: 'badge-del',
  };
  return `<span class="badge ${map[status] || ''}">${esc(status)}</span>`;
}

async function consultar() {
  const numero = document.getElementById('f-numero').value.trim();
  const cpf = document.getElementById('f-cpf').value.trim();
  const box = document.getElementById('resultado');

  if (!numero) return toast('Informe o número da ordem de serviço.', 'err');
  if (!isValidCPF(cpf)) return toast('Informe um CPF válido.', 'err');

  box.innerHTML = '';
  try {
    const res = await fetch(`${API_URL}/portal/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, cpf }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast(d.error || 'Não foi possível consultar a ordem de serviço.', 'err');
      return;
    }

    box.innerHTML = `
      <div class="tcard" style="padding:20px;">
        <div class="d-section"><i class="fas fa-file-invoice"></i> Ordem de Serviço #${esc(d.numero)}</div>
        <div class="d-field"><div class="d-lbl">Situação</div>
          <div class="d-val">${badge(d.status)} ${d.atrasada ? '<span class="badge badge-todo">Atrasada</span>' : ''}</div></div>
        <div class="d-field"><div class="d-lbl">Etapa</div><div class="d-val">${d.etapa} de ${d.totalEtapas}</div></div>
        <div class="d-field"><div class="d-lbl">Abertura</div><div class="d-val">${fmtDate(d.abertura)}</div></div>
        <div class="d-field"><div class="d-lbl">Previsão de atendimento (SLA)</div><div class="d-val">${fmtDateTime(d.previsao)}</div></div>
        ${d.agendamento ? `<div class="d-field"><div class="d-lbl">Atendimento agendado</div><div class="d-val">${fmtDateTime(d.agendamento)}</div></div>` : ''}
        ${d.encerramento ? `<div class="d-field"><div class="d-lbl">Encerramento</div><div class="d-val">${fmtDateTime(d.encerramento)}</div></div>` : ''}
        <div class="d-divider"></div>
        <div class="d-section"><i class="fas fa-laptop-medical"></i> Equipamento</div>
        <div class="d-field"><div class="d-lbl">Cliente</div><div class="d-val">${esc(d.cliente)}</div></div>
        <div class="d-field"><div class="d-lbl">Equipamento</div><div class="d-val">${esc(d.equipamento)}</div></div>
        <div class="d-field"><div class="d-lbl">Defeito relatado</div><div class="d-val pre-box">${esc(d.defeito)}</div></div>
        <div class="d-field"><div class="d-lbl">Solução aplicada</div><div class="d-val pre-box">${esc(d.solucao || 'Ainda não informada.')}</div></div>
        <div class="d-divider"></div>
        <div class="d-section"><i class="fas fa-building"></i> Assistência técnica</div>
        <div class="d-field"><div class="d-lbl">Empresa</div><div class="d-val">${esc(d.empresa.nome)}</div></div>
        <div class="d-field"><div class="d-lbl">Contato</div>
          <div class="d-val">${esc(d.empresa.telefone || '—')} · ${esc(d.empresa.email || '—')}</div></div>
        <div class="stat-lbl" style="margin-top:10px;">Atualizado em ${fmtDateTime(d.atualizadoEm)}</div>
      </div>`;
  } catch {
    toast('Falha de conexão com o servidor.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-consultar').addEventListener('click', consultar);
  document.getElementById('f-cpf').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') consultar();
  });
});
