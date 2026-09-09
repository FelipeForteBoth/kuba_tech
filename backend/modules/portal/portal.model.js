// Módulo Portal do Cliente — consulta pública do andamento da O.S.
// Só responde para empresas ativas que contrataram o módulo "portal".
// O mesmo CPF pode ter ordens em várias empresas contratantes: a busca
// por CPF percorre todas elas.
const db = require('../../config/database');

const BASE = `
  SELECT so.number, so.status, so.opening_date, so.problem_description, so.solution,
         so.created_at, so.updated_at, so.closed_at, so.scheduled_at, so.service_type,
         (so.created_at + make_interval(hours => so.sla_hours)) AS sla_due_at,
         c.name AS customer_name,
         d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
         t.company_name, t.phone AS company_phone, t.email AS company_email
    FROM service_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN devices   d ON d.id = so.device_id
    JOIN tenants   t ON t.id = so.tenant_id
   WHERE EXISTS (
           SELECT 1 FROM tenant_modules tm
             JOIN modules m ON m.id = tm.module_id
            WHERE tm.tenant_id = t.id AND (m.code = 'portal' OR m.slug = 'portal')
         )
     AND so.deleted_at IS NULL
     AND t.status = 'active'
     AND REGEXP_REPLACE(COALESCE(c.document_number, c.cpf), '\\D', '', 'g') = $1`;

/** Todas as O.S. do CPF informado, em qualquer empresa contratante. */
const listByCpf = (cpf) => db.all(`${BASE} ORDER BY so.created_at DESC LIMIT 100`, [cpf]);

/** Uma O.S. específica — só retorna se pertencer ao CPF informado. */
const findByCpfAndNumber = (cpf, number) =>
  db.all(`${BASE} AND so.number = $2 ORDER BY so.created_at DESC LIMIT 10`, [cpf, number]);

module.exports = { listByCpf, findByCpfAndNumber };
