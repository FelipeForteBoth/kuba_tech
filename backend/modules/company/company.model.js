// Módulo Empresa — configurações da empresa contratante (tenant).
const db = require('../../config/database');

const findSettings = (tenantId) =>
  db.one(
    `SELECT t.id, t.company_name, t.document, t.email, t.phone, t.status, t.sla_hours,
            p.name AS plan_name
       FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.id = $1`,
    [tenantId],
  );

const updateSlaHours = (tenantId, slaHours) =>
  db.one('UPDATE tenants SET sla_hours = $2 WHERE id = $1 RETURNING id, sla_hours', [tenantId, slaHours]);

const listModules = (tenantId) =>
  db.all(
    `SELECT m.code, m.name, m.description FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
      WHERE tm.tenant_id = $1 ORDER BY m.name`,
    [tenantId],
  );

module.exports = { findSettings, updateSlaHours, listModules };
