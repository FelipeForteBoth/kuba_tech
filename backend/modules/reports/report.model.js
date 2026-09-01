// Módulo Relatórios — indicadores gerenciais (acesso a dados).
const db = require('../../config/database');

/** Totais por status no período. */
const byStatus = (tenantId, from, to) =>
  db.all(
    `SELECT status, COUNT(*)::int AS total
       FROM service_orders
      WHERE tenant_id = $1 AND opening_date BETWEEN $2 AND $3
      GROUP BY status`,
    [tenantId, from, to],
  );

/** Produtividade por técnico. */
const byTechnician = (tenantId, from, to) =>
  db.all(
    `SELECT COALESCE(u.name, 'Sem técnico') AS technician_name,
            COUNT(*)::int                                                        AS total,
            COUNT(*) FILTER (WHERE so.status IN ('Finalizado','Entregue'))::int                AS finalizadas,
            COUNT(*) FILTER (WHERE so.status IN ('Em deslocamento','No local','Em execução','Aguardando cliente'))::int              AS em_andamento,
            ROUND(AVG(EXTRACT(EPOCH FROM (so.closed_at - so.created_at)) / 3600.0)
                  FILTER (WHERE so.closed_at IS NOT NULL)::numeric, 1)           AS horas_medias
       FROM service_orders so
  LEFT JOIN users u ON u.id = so.technician_id
      WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3
      GROUP BY u.name
      ORDER BY total DESC`,
    [tenantId, from, to],
  );

/** Cumprimento de prazo (SLA). */
const slaPerformance = (tenantId, from, to) =>
  db.one(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (
         WHERE so.closed_at IS NOT NULL
           AND so.closed_at <= so.created_at + make_interval(hours => so.sla_hours)
       )::int AS no_prazo,
       COUNT(*) FILTER (
         WHERE so.closed_at IS NOT NULL
           AND so.closed_at > so.created_at + make_interval(hours => so.sla_hours)
       )::int AS fora_do_prazo,
       COUNT(*) FILTER (
         WHERE so.closed_at IS NULL
           AND so.status NOT IN ('Finalizado', 'Entregue', 'Cancelado')
           AND NOW() > so.created_at + make_interval(hours => so.sla_hours)
       )::int AS atrasadas_abertas
      FROM service_orders so
     WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3`,
    [tenantId, from, to],
  );

/** Clientes com mais atendimentos. */
const topCustomers = (tenantId, from, to) =>
  db.all(
    `SELECT c.name, COALESCE(c.document_number, c.cpf) AS cpf, COUNT(*)::int AS total
       FROM service_orders so JOIN customers c ON c.id = so.customer_id
      WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3
      GROUP BY c.name, COALESCE(c.document_number, c.cpf) ORDER BY total DESC, c.name LIMIT 10`,
    [tenantId, from, to],
  );

/** Equipamentos mais atendidos (por tipo). */
const byDeviceType = (tenantId, from, to) =>
  db.all(
    `SELECT d.type, COUNT(*)::int AS total
       FROM service_orders so JOIN devices d ON d.id = so.device_id
      WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3
      GROUP BY d.type ORDER BY total DESC LIMIT 10`,
    [tenantId, from, to],
  );

/** Evolução mensal das aberturas. */
const monthly = (tenantId, from, to) =>
  db.all(
    `SELECT TO_CHAR(DATE_TRUNC('month', so.opening_date), 'MM/YYYY') AS periodo,
            DATE_TRUNC('month', so.opening_date)                     AS ordem,
            COUNT(*)::int                                            AS total
       FROM service_orders so
      WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3
      GROUP BY 1, 2 ORDER BY 2`,
    [tenantId, from, to],
  );

/** Linhas detalhadas para exportação (CSV). */
const rows = (tenantId, from, to) =>
  db.all(
    `SELECT so.number, so.opening_date, so.status, so.sla_hours,
            (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
            so.closed_at, c.name AS customer_name, d.type AS device_type,
            d.serial_number, COALESCE(u.name, '') AS technician_name
       FROM service_orders so
       JOIN customers c ON c.id = so.customer_id
       JOIN devices   d ON d.id = so.device_id
  LEFT JOIN users     u ON u.id = so.technician_id
      WHERE so.tenant_id = $1 AND so.opening_date BETWEEN $2 AND $3
      ORDER BY so.number`,
    [tenantId, from, to],
  );

module.exports = { byStatus, byTechnician, slaPerformance, topCustomers, byDeviceType, monthly, rows };
