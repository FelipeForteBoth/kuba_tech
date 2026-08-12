// Módulo Relatórios — regras de negócio dos indicadores gerenciais.
const model = require('./report.model');
const { AppError } = require('../../shared/http');
const { OS_STATUS } = require('../../config/roles');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parsePeriod(query) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime());
  start.setMonth(start.getMonth() - 5);
  start.setDate(1);
  const defaultFrom = start.toISOString().slice(0, 10);

  const from = String(query.from || '').trim() || defaultFrom;
  const to = String(query.to || '').trim() || defaultTo;

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new AppError('Informe o período no formato AAAA-MM-DD.');
  if (from > to) throw new AppError('A data inicial não pode ser maior que a data final.');
  return { from, to };
}

async function overview(req, res) {
  const { from, to } = parsePeriod(req.query);

  const [statusRows, tecnicos, sla, clientes, equipamentos, mensal] = await Promise.all([
    model.byStatus(req.tenantId, from, to),
    model.byTechnician(req.tenantId, from, to),
    model.slaPerformance(req.tenantId, from, to),
    model.topCustomers(req.tenantId, from, to),
    model.byDeviceType(req.tenantId, from, to),
    model.monthly(req.tenantId, from, to),
  ]);

  const status = {};
  OS_STATUS.forEach((s) => {
    status[s] = 0;
  });
  statusRows.forEach((row) => {
    status[row.status] = row.total;
  });

  const total = Object.values(status).reduce((acc, value) => acc + value, 0);
  const finalizadasComPrazo = Number(sla.no_prazo) + Number(sla.fora_do_prazo);
  const aderencia = finalizadasComPrazo ? Math.round((sla.no_prazo / finalizadasComPrazo) * 100) : null;

  res.json({
    periodo: { de: from, ate: to },
    total,
    status,
    sla: { ...sla, aderencia },
    tecnicos,
    clientes,
    equipamentos,
    mensal,
  });
}

// GET /api/reports/export — exportação em CSV para uso gerencial.
async function exportCsv(req, res) {
  const { from, to } = parsePeriod(req.query);
  const rows = await model.rows(req.tenantId, from, to);

  const header = [
    'O.S.', 'Abertura', 'Status', 'SLA (h)', 'Prazo', 'Encerramento',
    'Cliente', 'Equipamento', 'Nº de série', 'Técnico',
  ];

  const csv = [header.join(';')]
    .concat(
      rows.map((r) =>
        [
          r.number,
          r.opening_date instanceof Date ? r.opening_date.toISOString().slice(0, 10) : r.opening_date,
          r.status,
          r.sla_hours,
          r.sla_due_at ? new Date(r.sla_due_at).toLocaleString('pt-BR') : '',
          r.closed_at ? new Date(r.closed_at).toLocaleString('pt-BR') : '',
          r.customer_name,
          r.device_type,
          r.serial_number,
          r.technician_name,
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(';'),
      ),
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${from}-a-${to}.csv"`);
  res.send(`\uFEFF${csv}`);
}

module.exports = { overview, exportCsv };
