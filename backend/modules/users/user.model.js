// Módulo Usuários — acesso a dados (equipe da empresa contratante).
const db = require('../../config/database');

const PUBLIC_COLUMNS =
  'id, tenant_id, name, email, role, active, last_login_at, created_at';

const list = (tenantId) =>
  db.all(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE tenant_id = $1 ORDER BY name`, [tenantId]);

const listByRole = (tenantId, roles) =>
  db.all(
    `SELECT ${PUBLIC_COLUMNS} FROM users
      WHERE tenant_id = $1 AND active = TRUE AND role = ANY($2::text[])
      ORDER BY name`,
    [tenantId, roles],
  );

/**
 * Lista para a abertura de O.S.: SOMENTE usuários com o perfil Técnico
 * da empresa e que estejam ativos.
 */
const listTechnicians = (tenantId) =>
  db.all(
    `SELECT ${PUBLIC_COLUMNS} FROM users
      WHERE tenant_id = $1 AND role = 'technician' AND active = TRUE
      ORDER BY name`,
    [tenantId],
  );

const findById = (tenantId, id) =>
  db.one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);

const findByEmail = (email) => db.one('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);

const create = (tenantId, { name, email, passwordHash, role, mustChangePassword = true }) =>
  db.one(
    `INSERT INTO users (tenant_id, name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PUBLIC_COLUMNS}`,
    [tenantId, name, email, passwordHash, role, mustChangePassword],
  );

const update = (tenantId, id, { name, role, active }) =>
  db.one(
    `UPDATE users SET name = $3, role = $4, active = $5
      WHERE tenant_id = $1 AND id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [tenantId, id, name, role, active],
  );

const resetPassword = (tenantId, id, passwordHash) =>
  db.one(
    `UPDATE users SET password_hash = $3, must_change_password = TRUE WHERE tenant_id = $1 AND id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [tenantId, id, passwordHash],
  );

const remove = (tenantId, id) =>
  db.run('DELETE FROM users WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

const countActiveAdmins = (tenantId) =>
  db.one(
    `SELECT COUNT(*)::int AS total FROM users
      WHERE tenant_id = $1 AND role = 'company_admin' AND active = TRUE`,
    [tenantId],
  );

const countUsers = (tenantId) =>
  db.one('SELECT COUNT(*)::int AS total FROM users WHERE tenant_id = $1', [tenantId]);

module.exports = {
  list,
  listByRole,
  listTechnicians,
  findById,
  findByEmail,
  create,
  update,
  resetPassword,
  remove,
  countActiveAdmins,
  countUsers,
};
