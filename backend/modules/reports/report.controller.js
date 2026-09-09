// Módulo Relatórios — regras de negócio do dashboard gerencial.
const model = require('./report.model');
const { AppError } = require('../../shared/http');
const { OS_STATUS, SERVICE_TYPES } = require('../../config/roles');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFilters(query) {
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

  const technicianId = String(query.technicianId || '').trim();
  const customerId = String(query.customerId || '').trim();
  const status = String(query.status || '').trim();
  const serviceType = String(query.serviceType || '').trim();

  if (technicianId && !UUID_RE.test(technicianId)) throw new AppError('Técnico inválido.');
  if (customerId && !UUID_RE.test(customerId)) throw new AppError('Cliente inválido.');
  if (status && !OS_STATUS.includes(status)) throw new AppError('Status inválido.');
  if (serviceType && !SERVICE_TYPES.includes(serviceType)) throw new AppError('Tipo de atendimento inválido.');

  return {
    from,
    to,
    technicianId: technicianId || null,
    customerId: customerId || null,
    status: status || null,
    serviceType: serviceType || null,
  };
}

// GET /api/reports/filters — listas auxiliares do dashboard.
async function filters(req, res) {
  const [tecnicos, clientes] = await Promise.all([
    model.technicians(req.tenantId),
    model.customers(req.tenantId),
  ]);
  res.json({ tecnicos, clientes, status: OS_STATUS, tipos: SERVICE_TYPES });
}

async function overview(req, res) {
  const f = parseFilters(req.query);

  const [statusRows, tipos, tecnicos, sla, clientes, equipamentos, mensal] = await Promise.all([
    model.byStatus(req.tenantId, f),
    model.byServiceType(req.tenantId, f),
    model.byTechnician(req.tenantId, f),
    model.slaPerformance(req.tenantId, f),
    model.topCustomers(req.tenantId, f),
    model.byDeviceType(req.tenantId, f),
    model.monthly(req.tenantId, f),
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
    periodo: { de: f.from, ate: f.to },
    filtros: f,
    total,
    status,
    tipos,
    sla: { ...sla, aderencia },
    tecnicos,
    clientes,
    equipamentos,
    mensal,
  });
}

// GET /api/reports/detail — linhas detalhadas (usadas na versão de impressão).
async function detail(req, res) {
  const f = parseFilters(req.query);
  res.json({ periodo: { de: f.from, ate: f.to }, linhas: await model.rows(req.tenantId, f) });
}

// GET /api/reports/export — exportação em CSV para uso gerencial.
async function exportCsv(req, res) {
  const f = parseFilters(req.query);
  const rows = await model.rows(req.tenantId, f);

  const header = [
    'O.S.', 'Abertura', 'Status', 'Atendimento', 'SLA (h)', 'Prazo', 'Encerramento',
    'Cliente', 'Equipamento', 'Nº de série', 'Técnico',
  ];

  const csv = [header.join(';')]
    .concat(
      rows.map((r) =>
        [
          r.number,
          r.opening_date instanceof Date ? r.opening_date.toISOString().slice(0, 10) : r.opening_date,
          r.status,
          r.service_type === 'externo' ? 'Externo' : 'Interno',
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
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${f.from}-a-${f.to}.csv"`);
  res.send(`\uFEFF${csv}`);
}

module.exports = { overview, detail, filters, exportCsv };
