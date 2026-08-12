// Módulo Portal do Cliente — consulta pública do andamento da O.S.
// Só responde para empresas ativas que contrataram o módulo "portal".
const db = require('../../config/database');

const findPublicOrder = (number, cpf) =>
  db.one(
    `SELECT so.number, so.status, so.opening_date, so.problem_description, so.solution,
            so.created_at, so.updated_at, so.closed_at, so.scheduled_at,
            (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
            c.name AS customer_name,
            d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
            t.company_name, t.phone AS company_phone, t.email AS company_email
       FROM service_orders so
       JOIN customers c ON c.id = so.customer_id
       JOIN devices   d ON d.id = so.device_id
       JOIN tenants   t ON t.id = so.tenant_id
       JOIN tenant_modules tm ON tm.tenant_id = t.id
       JOIN modules m ON m.id = tm.module_id AND m.code = 'portal'
      WHERE so.number = $1
        AND REGEXP_REPLACE(c.cpf, '\\D', '', 'g') = $2
        AND t.status = 'active'
      LIMIT 1`,
    [number, cpf],
  );

module.exports = { findPublicOrder };
