// Ajustes específicos do atendimento interno.
// O fluxo interno não oferece etapas de deslocamento ou chegada ao local.
(() => {
  const semDeslocamento = ['Em deslocamento', 'No local', 'Aguardando cliente'];
  const originalFormHTML = window.formHTML;
  if (typeof originalFormHTML === 'function') {
    window.formHTML = function (o) {
      let html = originalFormHTML(o);
      if (o && o.service_type === 'interno') {
        semDeslocamento.forEach((status) => {
          const re = new RegExp(`\\s*<option value="${status}"[^>]*>${status}<\\/option>`, 'g');
          html = html.replace(re, '');
        });
      }
      return html;
    };
  }

  window.statusChips = function (o) {
    if (!can('orderStatus')) return '';
    const transicoes = o.service_type === 'interno'
      ? { Aberto: ['Agendado', 'Em execução', 'Cancelado'], Agendado: ['Em execução', 'Cancelado', 'Aberto'], 'Em execução': ['Aguardando cliente', 'Finalizado', 'Cancelado'], 'Aguardando cliente': ['Em execução', 'Finalizado', 'Cancelado'], Finalizado: ['Entregue'], Entregue: [], Cancelado: [] }
      : TRANSICOES;
    const opcoes = transicoes[o.status] || [];
    const chips = [];
    if (!SLA_ENCERRADAS.includes(o.status)) chips.push(`<button class="chip chip-alt" onclick="agendarOS('${o.id}')"><i class="fas fa-calendar-plus"></i> ${o.scheduled_at ? 'Reagendar' : 'Agendar'}</button>`);
    opcoes.forEach((s) => {
      const destaque = s === 'Finalizado' ? 'chip-ok' : (s === 'Cancelado' ? 'chip-del' : '');
      chips.push(`<button class="chip ${destaque}" onclick="quickStatus('${o.id}','${s}')">${esc(s)}</button>`);
    });
    if (!chips.length) return '<p class="stat-lbl">Esta ordem de serviço já está encerrada.</p>';
    return `<div class="status-flow">${chips.join('')}</div><span class="stat-lbl">Toque no próximo passo para atualizar o andamento em um clique.</span>`;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const filtro = document.getElementById('filter-status');
    if (filtro) [...filtro.options].forEach((option) => {
      if (semDeslocamento.includes(option.value)) option.remove();
    });
  });
})();
