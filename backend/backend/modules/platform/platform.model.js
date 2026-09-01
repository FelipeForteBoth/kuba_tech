// Módulo Plataforma — acesso a dados do Administrador da Plataforma (SaaS).
const db = require('../../config/database');

/** Cancela automaticamente assinaturas suspensas há mais de 2 meses. */
const expireSuspended = () =>
  db.run(
    `UPDATE tenants SET status = 'canceled'
      WHERE status = 'suspended'
        AND suspended_at IS NOT NULL
        AND suspended_at <= NOW() - INTERVAL '2 months'`,
    [],
  );

const listTenants = (search) => {
  const sql = `
    SELECT t.*, p.name AS plan_name, p.monthly_price,
           (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) AS users_count,
           (SELECT COUNT(*)::int FROM service_orders s WHERE s.tenant_id = t.id) AS orders_count
      FROM tenants t
 LEFT JOIN plans p ON p.id = t.plan_id`;

  if (search) {
    return db.all(
      `${sql} WHERE t.company_name ILIKE $1 OR t.document ILIKE $1 OR t.email ILIKE $1
        ORDER BY t.company_name`,
      [`%${search}%`],
    );
  }
  return db.all(`${sql} ORDER BY t.company_name`, []);
};

const findTenant = (id) =>
  db.one(
    `SELECT t.*, p.name AS plan_name, p.code AS plan_code
       FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.id = $1`,
    [id],
  );

const updateTenantStatus = (id, status) =>
  db.one('UPDATE tenants SET status = $2 WHERE id = $1 RETURNING *', [id, status]);

const deleteTenant = (id) => db.run('DELETE FROM tenants WHERE id = $1', [id]);

const documentExists = (document) => db.one('SELECT id FROM tenants WHERE document = $1', [document]);

/** Troca o plano da empresa e sincroniza os módulos habilitados. */
async function changeTenantPlan(id, planId) {
  return db.transaction(async (client) => {
    const result = await client.query('UPDATE tenants SET plan_id = $2 WHERE id = $1 RETURNING *', [id, planId]);
    if (!result.rows[0]) return null;

    await client.query('DELETE FROM tenant_modules WHERE tenant_id = $1', [id]);
    await client.query(
      `INSERT INTO tenant_modules (tenant_id, module_id)
       SELECT $1, module_id FROM plan_modules WHERE plan_id = $2`,
      [id, planId],
    );
    return result.rows[0];
  });
}

const listPlans = () =>
  db.all(
    `SELECT p.*,
            COALESCE(
              (SELECT json_agg(m.name ORDER BY m.name)
                 FROM plan_modules pm JOIN modules m ON m.id = pm.module_id
                WHERE pm.plan_id = p.id), '[]'::json) AS modules,
            (SELECT COUNT(*)::int FROM plan_modules pm WHERE pm.plan_id = p.id) AS modules_count
       FROM plans p WHERE p.active = TRUE ORDER BY p.monthly_price`,
    [],
  );

const findPlanById = (id) => db.one('SELECT * FROM plans WHERE id = $1 AND active = TRUE', [id]);

const listModules = () => db.all('SELECT * FROM modules ORDER BY name', []);

const listTenantModules = (tenantId) =>
  db.all(
    `SELECT m.id, m.code, m.name FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
      WHERE tm.tenant_id = $1 ORDER BY m.name`,
    [tenantId],
  );

const metrics = () =>
  db.one(
    `SELECT
       (SELECT COUNT(*)::int FROM tenants)                            AS empresas,
       (SELECT COUNT(*)::int FROM tenants WHERE status = 'active')    AS empresas_ativas,
       (SELECT COUNT(*)::int FROM tenants WHERE status = 'suspended') AS empresas_suspensas,
       (SELECT COALESCE(SUM(p.monthly_price), 0) FROM tenants t
          JOIN plans p ON p.id = t.plan_id WHERE t.status = 'active') AS receita_mensal`,
    [],
  );

// ── Solicitações de alteração de plano (fluxo comercial manual) ──────
const listPlanRequests = (status) =>
  db.all(
    `SELECT r.*, t.company_name, t.email AS company_email,
            pc.name AS current_plan_name, pd.name AS desired_plan_name
       FROM plan_change_requests r
       JOIN tenants t  ON t.id = r.tenant_id
  LEFT JOIN plans pc ON pc.id = r.current_plan_id
  LEFT JOIN plans pd ON pd.id = r.desired_plan_id
      WHERE ($1 = '' OR r.status = $1)
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT 100`,
    [status || ''],
  );

const findPlanRequest = (id) =>
  db.one(
    `SELECT r.*, t.company_name, t.email AS company_email, pd.name AS desired_plan_name
       FROM plan_change_requests r
       JOIN tenants t  ON t.id = r.tenant_id
  LEFT JOIN plans pd ON pd.id = r.desired_plan_id
      WHERE r.id = $1`,
    [id],
  );

const updatePlanRequest = (id, { status, answer, decidedBy }) =>
  db.one(
    `UPDATE plan_change_requests
        SET status     = COALESCE($2, status),
            answer     = COALESCE($3, answer),
            decided_by = COALESCE($4, decided_by),
            decided_at = CASE WHEN $2 IN ('done', 'rejected') THEN NOW() ELSE decided_at END,
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, status || null, answer || null, decidedBy || null],
  );

module.exports = {
  expireSuspended,
  listPlanRequests,
  findPlanRequest,
  updatePlanRequest,
  listTenants,
  findTenant,
  updateTenantStatus,
  deleteTenant,
  documentExists,
  changeTenantPlan,
  listPlans,
  findPlanById,
  listModules,
  listTenantModules,
  metrics,
};
