// Módulo Relatórios — indicadores gerenciais (acesso a dados).
// Todas as consultas são filtradas pelo tenant da empresa logada e
// aceitam os mesmos filtros interativos do dashboard.
const db = require('../../config/database');

/**
 * Monta o trecho WHERE comum a todas as consultas.
 * filtros: { from, to, technicianId, status, serviceType, customerId }
 */
function buildFilter(tenantId, f = {}) {
  const params = [tenantId, f.from, f.to];
  let where = 'so.tenant_id = $1 AND so.deleted_at IS NULL AND so.opening_date BETWEEN $2 AND $3';

  if (f.technicianId) {
    params.push(f.technicianId);
    where += ` AND so.technician_id = $${params.length}`;
  }
  if (f.status) {
    params.push(f.status);
    where += ` AND so.status = $${params.length}`;
  }
  if (f.serviceType) {
    params.push(f.serviceType);
    where += ` AND COALESCE(so.service_type, 'interno') = $${params.length}`;
  }
  if (f.customerId) {
    params.push(f.customerId);
    where += ` AND so.customer_id = $${params.length}`;
  }
  return { where, params };
}

const byStatus = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT so.status, COUNT(*)::int AS total FROM service_orders so
      WHERE ${where} GROUP BY so.status`,
    params,
  );
};

const byServiceType = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT COALESCE(so.service_type, 'interno') AS tipo, COUNT(*)::int AS total
       FROM service_orders so WHERE ${where} GROUP BY 1 ORDER BY total DESC`,
    params,
  );
};

const byTechnician = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT COALESCE(u.name, 'Sem técnico') AS technician_name,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE so.status IN ('Finalizado','Entregue'))::int AS finalizadas,
            COUNT(*) FILTER (WHERE so.status IN ('Em deslocamento','No local','Em execução','Aguardando cliente'))::int AS em_andamento,
            ROUND(AVG(EXTRACT(EPOCH FROM (so.closed_at - so.created_at)) / 3600.0)
                  FILTER (WHERE so.closed_at IS NOT NULL)::numeric, 1) AS horas_medias
       FROM service_orders so
  LEFT JOIN users u ON u.id = so.technician_id
      WHERE ${where}
      GROUP BY u.name ORDER BY total DESC`,
    params,
  );
};

const slaPerformance = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.one(
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
      FROM service_orders so WHERE ${where}`,
    params,
  );
};

const topCustomers = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT c.name, COALESCE(c.document_number, c.cpf) AS cpf, COUNT(*)::int AS total
       FROM service_orders so JOIN customers c ON c.id = so.customer_id
      WHERE ${where}
      GROUP BY c.name, COALESCE(c.document_number, c.cpf)
      ORDER BY total DESC, c.name LIMIT 10`,
    params,
  );
};

const byDeviceType = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT d.type, COUNT(*)::int AS total
       FROM service_orders so JOIN devices d ON d.id = so.device_id
      WHERE ${where} GROUP BY d.type ORDER BY total DESC LIMIT 10`,
    params,
  );
};

const monthly = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT TO_CHAR(DATE_TRUNC('month', so.opening_date), 'MM/YYYY') AS periodo,
            DATE_TRUNC('month', so.opening_date) AS ordem,
            COUNT(*)::int AS total
       FROM service_orders so WHERE ${where} GROUP BY 1, 2 ORDER BY 2`,
    params,
  );
};

/** Linhas detalhadas (exportação CSV e versão para impressão). */
const rows = (tenantId, f) => {
  const { where, params } = buildFilter(tenantId, f);
  return db.all(
    `SELECT so.number, so.opening_date, so.status, so.sla_hours,
            COALESCE(so.service_type, 'interno') AS service_type,
            (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
            so.closed_at, c.name AS customer_name, d.type AS device_type,
            d.serial_number, COALESCE(u.name, '') AS technician_name
       FROM service_orders so
       JOIN customers c ON c.id = so.customer_id
       JOIN devices   d ON d.id = so.device_id
  LEFT JOIN users     u ON u.id = so.technician_id
      WHERE ${where}
      ORDER BY so.number`,
    params,
  );
};

/** Listas auxiliares para os filtros do dashboard. */
const technicians = (tenantId) =>
  db.all(
    `SELECT id, name FROM users
      WHERE tenant_id = $1 AND role = 'technician' AND deleted_at IS NULL
      ORDER BY name`,
    [tenantId],
  );

const customers = (tenantId) =>
  db.all(
    `SELECT id, name FROM customers
      WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT 500`,
    [tenantId],
  );

module.exports = {
  byStatus, byServiceType, byTechnician, slaPerformance, topCustomers,
  byDeviceType, monthly, rows, technicians, customers,
};
