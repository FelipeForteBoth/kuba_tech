// Módulo Auth — camada de acesso a dados.
const db = require('../../config/database');

/** Cancela assinaturas suspensas há mais de 2 meses (regra de negócio SaaS). */
const expireSuspendedTenants = () =>
  db.run(
    `UPDATE tenants SET status = 'canceled'
      WHERE status = 'suspended'
        AND suspended_at IS NOT NULL
        AND suspended_at <= NOW() - INTERVAL '2 months'`,
    [],
  );

const findUserByEmail = (email) =>
  db.one(
    `SELECT u.*, t.status AS tenant_status, t.company_name
       FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE LOWER(u.email) = LOWER($1)`,
    [email],
  );

const findUserById = (id) =>
  db.one(
    `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.active, u.created_at,
            t.company_name, t.status AS tenant_status, p.name AS plan_name
       FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
  LEFT JOIN plans   p ON p.id = t.plan_id
      WHERE u.id = $1`,
    [id],
  );

const registerLogin = (id) => db.run('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);

const getPasswordHash = (id) => db.one('SELECT password_hash FROM users WHERE id = $1', [id]);

const updatePassword = (id, hash) =>
  db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);

const findPlanByCode = (code) => db.one('SELECT * FROM plans WHERE code = $1 AND active = TRUE', [code]);

const findDefaultPlan = () =>
  db.one('SELECT * FROM plans WHERE active = TRUE ORDER BY monthly_price ASC LIMIT 1');

const tenantDocumentExists = (document) =>
  db.one('SELECT id FROM tenants WHERE document = $1', [document]);

/**
 * Cria a empresa contratante e o seu Administrador da Empresa
 * dentro de uma única transação, habilitando os módulos do plano.
 */
async function createCompanyWithAdmin({ company, admin, planId }) {
  return db.transaction(async (client) => {
    const tenantResult = await client.query(
      `INSERT INTO tenants (company_name, document, email, phone, plan_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [company.name, company.document, company.email, company.phone, planId],
    );
    const tenant = tenantResult.rows[0];

    await client.query(
      `INSERT INTO tenant_modules (tenant_id, module_id)
       SELECT $1, module_id FROM plan_modules WHERE plan_id = $2
       ON CONFLICT DO NOTHING`,
      [tenant.id, planId],
    );

    const userResult = await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'company_admin')
       RETURNING id, tenant_id, name, email, role`,
      [tenant.id, admin.name, admin.email, admin.passwordHash],
    );

    return { tenant, user: userResult.rows[0] };
  });
}

module.exports = {
  expireSuspendedTenants,
  findUserByEmail,
  findUserById,
  registerLogin,
  getPasswordHash,
  updatePassword,
  findPlanByCode,
  findDefaultPlan,
  tenantDocumentExists,
  createCompanyWithAdmin,
};
