// Recuperação de senha com aprovação hierárquica — acesso a dados.
const db = require('../../config/database');

const findUserByEmail = (email) =>
  db.one(
    `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.active,
            t.company_name, t.status AS tenant_status
       FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE LOWER(u.email) = LOWER($1)`,
    [email],
  );

const pendingForUser = (userId) =>
  db.one(
    `SELECT id FROM password_reset_requests
      WHERE user_id = $1 AND status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId],
  );

const create = ({ userId, tenantId, approverScope, reason }) =>
  db.one(
    `INSERT INTO password_reset_requests (user_id, tenant_id, approver_scope, reason)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [userId, tenantId, approverScope, reason],
  );

/** Aprovadores: quem recebe o aviso por e-mail. */
const companyAdmins = (tenantId) =>
  db.all(
    `SELECT name, email FROM users
      WHERE tenant_id = $1 AND role = 'company_admin' AND active = TRUE`,
    [tenantId],
  );

const platformAdmins = () =>
  db.all("SELECT name, email FROM users WHERE role = 'platform_admin' AND active = TRUE", []);

/** Fila do Administrador da Plataforma (pedidos de Administradores de Empresa). */
const listForPlatform = (status) =>
  db.all(
    `SELECT r.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
            t.company_name
       FROM password_reset_requests r
       JOIN users u   ON u.id = r.user_id
  LEFT JOIN tenants t ON t.id = r.tenant_id
      WHERE r.approver_scope = 'platform_admin'
        AND ($1 = '' OR r.status = $1)
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT 50`,
    [status || ''],
  );

/** Fila do Administrador da Empresa (pedidos da própria equipe). */
const listForCompany = (tenantId, status) =>
  db.all(
    `SELECT r.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM password_reset_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.approver_scope = 'company_admin'
        AND r.tenant_id = $1
        AND ($2 = '' OR r.status = $2)
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT 50`,
    [tenantId, status || ''],
  );

const findById = (id) =>
  db.one(
    `SELECT r.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
            t.company_name
       FROM password_reset_requests r
       JOIN users u   ON u.id = r.user_id
  LEFT JOIN tenants t ON t.id = r.tenant_id
      WHERE r.id = $1`,
    [id],
  );

const approve = (id, { tokenHash, expiresAt, decidedBy }) =>
  db.one(
    `UPDATE password_reset_requests
        SET status = 'approved', token_hash = $2, token_expires_at = $3,
            decided_by = $4, decided_at = NOW()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, tokenHash, expiresAt, decidedBy],
  );

const reject = (id, decidedBy, reason) =>
  db.one(
    `UPDATE password_reset_requests
        SET status = 'rejected', reason = COALESCE($3, reason),
            decided_by = $2, decided_at = NOW()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, decidedBy, reason],
  );

const findValidToken = (tokenHash) =>
  db.one(
    `SELECT r.*, u.name AS user_name, u.email AS user_email
       FROM password_reset_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = $1 AND r.status = 'approved'
        AND r.token_expires_at > NOW()`,
    [tokenHash],
  );

const consume = (id) =>
  db.run(
    "UPDATE password_reset_requests SET status = 'used', token_hash = NULL WHERE id = $1",
    [id],
  );

const setPassword = (userId, hash) =>
  db.run(
    'UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE id = $1',
    [userId, hash],
  );

module.exports = {
  findUserByEmail,
  pendingForUser,
  create,
  companyAdmins,
  platformAdmins,
  listForPlatform,
  listForCompany,
  findById,
  approve,
  reject,
  findValidToken,
  consume,
  setPassword,
};
