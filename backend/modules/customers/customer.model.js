// Módulo Clientes — acesso a dados (sempre filtrado por tenant_id).
const db = require('../../config/database');

const list = (tenantId, search) => {
  if (search) {
    return db.all(
      `SELECT * FROM customers
        WHERE tenant_id = $1
          AND (name ILIKE $2 OR cpf ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)
        ORDER BY name`,
      [tenantId, `%${search}%`],
    );
  }
  return db.all('SELECT * FROM customers WHERE tenant_id = $1 ORDER BY name', [tenantId]);
};

const findById = (tenantId, id) =>
  db.one('SELECT * FROM customers WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

const findByCpf = (tenantId, cpf) =>
  db.one('SELECT * FROM customers WHERE tenant_id = $1 AND cpf = $2', [tenantId, cpf]);

const create = (tenantId, { cpf, name, phone, email }) =>
  db.one(
    `INSERT INTO customers (tenant_id, cpf, name, phone, email)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tenantId, cpf, name, phone, email],
  );

const update = (tenantId, id, { name, phone, email }) =>
  db.one(
    `UPDATE customers SET name = $3, phone = $4, email = $5
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, id, name, phone, email],
  );

const remove = (tenantId, id) =>
  db.run('DELETE FROM customers WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

const count = (tenantId) =>
  db.one('SELECT COUNT(*)::int AS total FROM customers WHERE tenant_id = $1', [tenantId]);

module.exports = { list, findById, findByCpf, create, update, remove, count };
