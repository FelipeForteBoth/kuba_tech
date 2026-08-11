// Módulo Ordens de Serviço — acesso a dados (filtrado por tenant_id).
const db = require('../../config/database');

const BASE_SELECT = `
  SELECT so.*,
         (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
         c.name  AS customer_name,  c.cpf   AS customer_cpf,
         d.serial_number, d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
         t.name  AS technician_name,
         u.name  AS created_by_name
    FROM service_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN devices   d ON d.id = so.device_id
LEFT JOIN users     t ON t.id = so.technician_id
LEFT JOIN users     u ON u.id = so.created_by
`;

/**
 * Lista as ordens de serviço da empresa.
 * O parâmetro technicianId restringe o resultado às O.S. do técnico logado.
 */
const list = (tenantId, { search, status, technicianId } = {}) => {
  const params = [tenantId];
  let sql = `${BASE_SELECT} WHERE so.tenant_id = $1`;

  if (technicianId) {
    params.push(technicianId);
    sql += ` AND so.technician_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND so.status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    sql += ` AND (c.name ILIKE ${p} OR c.cpf ILIKE ${p} OR d.serial_number ILIKE ${p}
                 OR so.problem_description ILIKE ${p} OR CAST(so.number AS TEXT) ILIKE ${p})`;
  }
  return db.all(`${sql} ORDER BY so.number DESC`, params);
};

const findById = (tenantId, id) =>
  db.one(`${BASE_SELECT} WHERE so.tenant_id = $1 AND so.id = $2`, [tenantId, id]);

const create = (tenantId, data) =>
  db.one(
    `INSERT INTO service_orders
       (tenant_id, customer_id, device_id, technician_id, opening_date, problem_description, status, created_by, sla_hours)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      tenantId,
      data.customerId,
      data.deviceId,
      data.technicianId,
      data.openingDate,
      data.problemDescription,
      data.status,
      data.createdBy,
      data.slaHours,
    ],
  );

const update = (tenantId, id, data) =>
  db.one(
    `UPDATE service_orders
        SET customer_id = $3, device_id = $4, technician_id = $5, opening_date = $6,
            problem_description = $7, solution = $8, status = $9, sla_hours = $10
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [
      tenantId,
      id,
      data.customerId,
      data.deviceId,
      data.technicianId,
      data.openingDate,
      data.problemDescription,
      data.solution,
      data.status,
      data.slaHours,
    ],
  );

/** Atualização restrita usada pelo Técnico: apenas andamento do serviço. */
const updateProgress = (tenantId, id, { status, solution }) =>
  db.one(
    `UPDATE service_orders SET status = $3, solution = COALESCE($4, solution)
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, id, status, solution],
  );

const remove = (tenantId, id) =>
  db.run('DELETE FROM service_orders WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

/** Indicadores para o painel da empresa. */
const statusSummary = (tenantId, technicianId) => {
  const params = [tenantId];
  let filter = '';
  if (technicianId) {
    params.push(technicianId);
    filter = ' AND technician_id = $2';
  }
  return db.all(
    `SELECT status, COUNT(*)::int AS total
       FROM service_orders WHERE tenant_id = $1${filter}
      GROUP BY status`,
    params,
  );
};

/** Ajuste isolado do prazo (SLA) da O.S. — Administrador da Empresa. */
const updateSla = (tenantId, id, slaHours) =>
  db.one('UPDATE service_orders SET sla_hours = $3 WHERE tenant_id = $1 AND id = $2 RETURNING *', [
    tenantId,
    id,
    slaHours,
  ]);

module.exports = { updateSla, list, findById, create, update, updateProgress, remove, statusSummary };
