// ─────────────────────────────────────────────────────────────
// Dashboard gerencial — indicadores interativos das ordens de
// serviço, com filtros por período, técnico, cliente, status e
// tipo de atendimento. A impressão gera um relatório próprio.
// ─────────────────────────────────────────────────────────────
let dadosAtuais = null;

const EM_ANDAMENTO = ['Agendado', 'Em deslocamento', 'No local', 'Em execução', 'Aguardando cliente'];

function el(id) {
  return document.getElementById(id);
}

function filtros() {
  return {
    from: el('f-from').value,
    to: el('f-to').value,
    technicianId: el('f-tec').value,
    customerId: el('f-cli').value,
    status: el('f-status').value,
    serviceType: el('f-tipo').value,
  };
}

function queryString() {
  const f = filtros();
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return params.toString();
}

/** Barras horizontais simples (sem biblioteca externa). */
function barras(box, itens) {
  const alvo = el(box);
  if (!alvo) return;
  if (!itens.length) {
    alvo.innerHTML = '<span class="stat-lbl">Sem dados no período.</span>';
    return;
  }
  const maior = Math.max(...itens.map((i) => i.valor)) || 1;
  alvo.innerHTML = itens.map((i) => `
    <div class="chart-row">
      <span class="chart-lbl">${esc(i.rotulo)}</span>
      <span class="chart-track"><span class="chart-fill" style="width:${Math.round((i.valor / maior) * 100)}%"></span></span>
      <strong class="chart-num">${i.valor}</strong>
    </div>`).join('');
}

/** Colunas verticais para a série mensal. */
function colunas(box, itens) {
  const alvo = el(box);
  if (!alvo) return;
  if (!itens.length) {
    alvo.innerHTML = '<span class="stat-lbl">Sem dados no período.</span>';
    return;
  }
  const maior = Math.max(...itens.map((i) => i.valor)) || 1;
  alvo.innerHTML = itens.map((i) => `
    <div class="chart-col" title="${esc(i.rotulo)}: ${i.valor}">
      <span class="chart-col-num">${i.valor}</span>
      <span class="chart-col-bar" style="height:${Math.max(6, Math.round((i.valor / maior) * 100))}%"></span>
      <span class="chart-col-lbl">${esc(i.rotulo)}</span>
    </div>`).join('');
}

function render(d) {
  dadosAtuais = d;
  const concluidas = (d.status['Finalizado'] || 0) + (d.status['Entregue'] || 0);
  const andamento = EM_ANDAMENTO.reduce((acc, s) => acc + (d.status[s] || 0), 0);

  el('s-total').textContent = d.total;
  el('s-done').textContent = concluidas;
  el('s-prog').textContent = andamento;
  el('s-sla').textContent = d.sla.aderencia === null ? '—' : `${d.sla.aderencia}%`;
  el('s-late').textContent = d.sla.atrasadas_abertas;
  el('sub-info').textContent =
    `Período de ${d.periodo.de.split('-').reverse().join('/')} a ${d.periodo.ate.split('-').reverse().join('/')}`;

  colunas('g-mensal', d.mensal.map((m) => ({ rotulo: m.periodo, valor: m.total })));
  barras('g-status', Object.entries(d.status).filter(([, v]) => v > 0).map(([k, v]) => ({ rotulo: k, valor: v })));
  barras('g-tipo', d.tipos.map((t) => ({ rotulo: t.tipo === 'externo' ? 'Externo' : 'Interno', valor: t.total })));
  barras('g-equip', d.equipamentos.map((e) => ({ rotulo: e.type, valor: e.total })));

  el('t-tecnicos').innerHTML = d.tecnicos.length
    ? d.tecnicos.map((t) => `<tr>
        <td>${esc(t.technician_name)}</td><td>${t.total}</td>
        <td>${t.em_andamento}</td><td>${t.finalizadas}</td>
        <td>${t.horas_medias === null ? '—' : t.horas_medias}</td></tr>`).join('')
    : '<tr><td colspan="5">Sem dados no período.</td></tr>';

  el('t-clientes').innerHTML = d.clientes.length
    ? d.clientes.map((c) => `<tr><td>${esc(c.name)}</td><td class="mono">${esc(c.cpf || '—')}</td><td>${c.total}</td></tr>`).join('')
    : '<tr><td colspan="3">Sem dados no período.</td></tr>';
}

async function carregarFiltros() {
  const res = await authFetch(`${API_URL}/reports/filters`);
  if (!res.ok) return;
  const d = await res.json();
  el('f-tec').innerHTML = '<option value="">Todos</option>'
    + d.tecnicos.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  el('f-cli').innerHTML = '<option value="">Todos</option>'
    + d.clientes.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  el('f-status').innerHTML = '<option value="">Todos</option>'
    + d.status.map((s) => `<option value="${s}">${s}</option>`).join('');
}

async function carregar() {
  try {
    const res = await authFetch(`${API_URL}/reports/overview?${queryString()}`);
    const d = await res.json();
    if (!res.ok) return toast(d.error || 'Não foi possível carregar os indicadores.', 'err');
    render(d);
  } catch {
    toast('Erro de conexão com o servidor.', 'err');
  }
  return undefined;
}

function exportar() {
  authFetch(`${API_URL}/reports/export?${queryString()}`)
    .then((r) => (r.ok ? r.blob() : Promise.reject()))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-kuba-tech.csv';
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => toast('Não foi possível exportar o relatório.', 'err'));
}

// ── Impressão: documento próprio, não uma cópia da tela ──
function descricaoFiltros() {
  const texto = (sel) => {
    const s = el(sel);
    return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : 'Todos';
  };
  return [
    `Período: ${el('f-from').value.split('-').reverse().join('/')} a ${el('f-to').value.split('-').reverse().join('/')}`,
    `Técnico: ${texto('f-tec')}`,
    `Cliente: ${texto('f-cli')}`,
    `Status: ${texto('f-status')}`,
    `Atendimento: ${texto('f-tipo')}`,
  ];
}

async function imprimir() {
  if (!dadosAtuais) return toast('Carregue os indicadores antes de imprimir.', 'err');
  toast('Preparando o relatório...');

  const res = await authFetch(`${API_URL}/reports/detail?${queryString()}`);
  if (!res.ok) return toast('Não foi possível gerar o relatório.', 'err');
  const { linhas } = await res.json();

  const d = dadosAtuais;
  const empresa = (currentUser() || {}).empresa || 'Kuba Tech';
  const emitido = new Date().toLocaleString('pt-BR');
  const dataBR = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Relatório de Ordens de Serviço</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      .meta { color: #555; font-size: 11px; }
      ul.filtros { margin: 10px 0 0; padding-left: 18px; color: #333; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
      th { background: #f1f3f7; }
      .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; min-width: 130px; }
      .kpi strong { display: block; font-size: 18px; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>Relatório de Ordens de Serviço</h1>
    <p class="meta">${esc(empresa)} · Emitido em ${emitido}</p>
    <ul class="filtros">${descricaoFiltros().map((f) => `<li>${esc(f)}</li>`).join('')}</ul>

    <div class="kpis">
      <div class="kpi"><strong>${d.total}</strong>O.S. no período</div>
      <div class="kpi"><strong>${(d.status['Finalizado'] || 0) + (d.status['Entregue'] || 0)}</strong>Concluídas / entregues</div>
      <div class="kpi"><strong>${d.sla.aderencia === null ? '—' : `${d.sla.aderencia}%`}</strong>Prazo cumprido (SLA)</div>
      <div class="kpi"><strong>${d.sla.atrasadas_abertas}</strong>Atrasadas em aberto</div>
    </div>

    <h2>Distribuição por status</h2>
    <table><thead><tr><th>Status</th><th>Total</th></tr></thead><tbody>
      ${Object.entries(d.status).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}
    </tbody></table>

    <h2>Produtividade por técnico</h2>
    <table><thead><tr><th>Técnico</th><th>Total</th><th>Em andamento</th><th>Finalizadas</th><th>Tempo médio (h)</th></tr></thead><tbody>
      ${d.tecnicos.map((t) => `<tr><td>${esc(t.technician_name)}</td><td>${t.total}</td><td>${t.em_andamento}</td><td>${t.finalizadas}</td><td>${t.horas_medias === null ? '—' : t.horas_medias}</td></tr>`).join('')
        || '<tr><td colspan="5">Sem dados.</td></tr>'}
    </tbody></table>

    <h2>Ordens de serviço do período (${linhas.length})</h2>
    <table><thead><tr>
      <th>O.S.</th><th>Abertura</th><th>Cliente</th><th>Equipamento</th>
      <th>Técnico</th><th>Atendimento</th><th>Status</th><th>Encerramento</th>
    </tr></thead><tbody>
      ${linhas.map((r) => `<tr>
        <td>#${esc(r.number)}</td><td>${dataBR(r.opening_date)}</td>
        <td>${esc(r.customer_name)}</td><td>${esc(r.device_type)} — ${esc(r.serial_number)}</td>
        <td>${esc(r.technician_name || '—')}</td>
        <td>${r.service_type === 'externo' ? 'Externo' : 'Interno'}</td>
        <td>${esc(r.status)}</td><td>${dataBR(r.closed_at)}</td></tr>`).join('')
        || '<tr><td colspan="8">Sem ordens de serviço no período.</td></tr>'}
    </tbody></table>
    </body></html>`;

  const janela = window.open('', '_blank');
  if (!janela) return toast('Permita janelas pop-up para imprimir o relatório.', 'err');
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
  return undefined;
}

function periodoPadrao() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
  el('f-to').value = hoje.toISOString().slice(0, 10);
  el('f-from').value = inicio.toISOString().slice(0, 10);
}

document.addEventListener('DOMContentLoaded', async () => {
  periodoPadrao();
  await carregarFiltros();
  carregar();

  el('btn-filter').addEventListener('click', carregar);
  el('btn-clear').addEventListener('click', () => {
    ['f-tec', 'f-cli', 'f-status', 'f-tipo'].forEach((id) => {
      el(id).value = '';
    });
    periodoPadrao();
    carregar();
  });
  el('btn-export').addEventListener('click', exportar);
  el('btn-print').addEventListener('click', imprimir);
});
