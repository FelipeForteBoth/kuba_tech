// Módulo Agenda Técnica — acesso a dados dos atendimentos programados.
const db = require('../../config/database');

const BASE = `
  SELECT so.id, so.number, so.status, so.scheduled_at, so.opening_date, so.sla_hours,
         (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
         so.problem_description,
         c.name AS customer_name, c.phone AS customer_phone,
         d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
         so.technician_id, u.name AS technician_name
    FROM service_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN devices   d ON d.id = so.device_id
LEFT JOIN users     u ON u.id = so.technician_id
`;

/** Atendimentos programados dentro do intervalo informado. */
const listScheduled = (tenantId, { from, to, technicianId }) => {
  const params = [tenantId, from, to];
  let sql = `${BASE} WHERE so.tenant_id = $1
               AND so.scheduled_at >= $2::date
               AND so.scheduled_at < ($3::date + INTERVAL '1 day')`;
  if (technicianId) {
    params.push(technicianId);
    sql += ` AND so.technician_id = $${params.length}`;
  }
  return db.all(`${sql} ORDER BY so.scheduled_at`, params);
};

/** O.S. abertas que ainda não possuem data programada. */
const listUnscheduled = (tenantId, technicianId) => {
  const params = [tenantId];
  let sql = `${BASE} WHERE so.tenant_id = $1 AND so.scheduled_at IS NULL
               AND so.status IN ('A Realizar', 'Em Andamento')`;
  if (technicianId) {
    params.push(technicianId);
    sql += ` AND so.technician_id = $${params.length}`;
  }
  return db.all(`${sql} ORDER BY so.number DESC`, params);
};

const schedule = (tenantId, id, { scheduledAt, technicianId }) =>
  db.one(
    `UPDATE service_orders
        SET scheduled_at = $3,
            technician_id = COALESCE($4, technician_id)
      WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id, scheduledAt, technicianId],
  );

const findById = (tenantId, id) => db.one(`${BASE} WHERE so.tenant_id = $1 AND so.id = $2`, [tenantId, id]);

/** Carga de trabalho por técnico no intervalo. */
const workload = (tenantId, from, to) =>
  db.all(
    `SELECT COALESCE(u.name, 'Sem técnico') AS technician_name, COUNT(*)::int AS total
       FROM service_orders so LEFT JOIN users u ON u.id = so.technician_id
      WHERE so.tenant_id = $1
        AND so.scheduled_at >= $2::date
        AND so.scheduled_at < ($3::date + INTERVAL '1 day')
      GROUP BY u.name ORDER BY total DESC`,
    [tenantId, from, to],
  );

module.exports = { listScheduled, listUnscheduled, schedule, findById, workload };
