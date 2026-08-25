// ─────────────────────────────────────────────────────────────
// Módulo Relatórios — indicadores gerenciais (planos Profissional/Empresarial).
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function period() {
  return { from: $('f-from').value, to: $('f-to').value };
}

function query() {
  const { from, to } = period();
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params.toString() ? `?${params}` : '';
}

function fillRows(tbodyId, rows, render, cols) {
  const tbody = $(tbodyId);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--text-3)">Sem dados no período</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(render).join('');
}

async function load() {
  try {
    const res = await authFetch(`${API_URL}/reports/overview${query()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || 'Não foi possível carregar os relatórios.', 'err');
      return;
    }
    const d = await res.json();

    $('sub-info').textContent =
      `Período de ${new Date(d.periodo.de + 'T00:00:00').toLocaleDateString('pt-BR')} a ` +
      `${new Date(d.periodo.ate + 'T00:00:00').toLocaleDateString('pt-BR')}`;

    $('s-total').textContent = d.total;
    $('s-done').textContent = (d.status['Finalizado'] || 0) + (d.status['Entregue'] || 0);
    $('s-prog').textContent = ['Agendado', 'Em deslocamento', 'No local', 'Em execução', 'Aguardando cliente']
      .reduce((total, st) => total + (d.status[st] || 0), 0);
    $('s-sla').textContent = d.sla.aderencia === null ? '—' : `${d.sla.aderencia}%`;
    $('s-late').textContent = d.sla.atrasadas_abertas || 0;

    fillRows('t-mensal', d.mensal, (r) => `<tr><td>${esc(r.periodo)}</td><td>${r.total}</td></tr>`, 2);

    fillRows(
      't-tecnicos',
      d.tecnicos,
      (r) => `<tr>
        <td>${esc(r.technician_name)}</td>
        <td>${r.total}</td>
        <td>${r.em_andamento}</td>
        <td>${r.finalizadas}</td>
        <td>${r.horas_medias === null ? '—' : esc(r.horas_medias)}</td>
      </tr>`,
      5,
    );

    fillRows(
      't-clientes',
      d.clientes,
      (r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.cpf)}</td><td>${r.total}</td></tr>`,
      3,
    );

    fillRows(
      't-equipamentos',
      d.equipamentos,
      (r) => `<tr><td>${esc(r.type)}</td><td>${r.total}</td></tr>`,
      2,
    );
  } catch {
    toast('Falha de conexão com o servidor.', 'err');
  }
}

async function exportCsv() {
  const res = await authFetch(`${API_URL}/reports/export${query()}`);
  if (!res.ok) return toast('Não foi possível exportar o relatório.', 'err');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-kuba-tech.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('Relatório exportado.');
}

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  $('f-to').value = today.toISOString().slice(0, 10);
  $('f-from').value = start.toISOString().slice(0, 10);

  $('btn-filter').addEventListener('click', load);
  $('btn-export').addEventListener('click', exportCsv);
  $('btn-print').addEventListener('click', () => window.print());
  load();
});
