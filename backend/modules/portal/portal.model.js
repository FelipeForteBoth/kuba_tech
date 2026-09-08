// Módulo Portal do Cliente — consulta pública do andamento da O.S.
// O CPF identifica o cliente; o número da O.S. é um filtro opcional.
const db = require('../../config/database');

const BASE_SELECT = `
  SELECT so.number, so.status, so.opening_date, so.problem_description, so.solution,
         so.created_at, so.updated_at, so.closed_at, so.scheduled_at,
         (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
         c.name AS customer_name,
         d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
         t.company_name, t.phone AS company_phone, t.email AS company_email
    FROM service_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN devices d ON d.id = so.device_id
    JOIN tenants t ON t.id = so.tenant_id
    JOIN tenant_modules tm ON tm.tenant_id = t.id
    JOIN modules m ON m.id = tm.module_id AND m.code = 'portal'
   WHERE REGEXP_REPLACE(COALESCE(c.document_number, c.cpf), '\\D', '', 'g') = $1
     AND t.status = 'active'`;

const findPublicOrders = (cpf, number = null) => {
  const params = [cpf];
  let sql = BASE_SELECT;
  if (number) {
    params.push(number);
    sql += ` AND so.number = $${params.length}`;
  }
  sql += ' ORDER BY so.opening_date DESC, so.number DESC';
  return db.all(sql, params);
};

const findPublicOrder = async (number, cpf) => (await findPublicOrders(cpf, number))[0] || null;

module.exports = { findPublicOrder, findPublicOrders };
