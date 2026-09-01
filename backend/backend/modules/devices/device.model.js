// Módulo Equipamentos — acesso a dados (filtrado por tenant_id).
const db = require('../../config/database');

const BASE_SELECT = `
  SELECT d.*, c.name AS customer_name, c.cpf AS customer_cpf
    FROM devices d
    JOIN customers c ON c.id = d.customer_id
`;

const list = (tenantId, { search, customerId } = {}) => {
  const params = [tenantId];
  let sql = `${BASE_SELECT} WHERE d.tenant_id = $1`;

  if (customerId) {
    params.push(customerId);
    sql += ` AND d.customer_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (d.serial_number ILIKE $${params.length} OR d.type ILIKE $${params.length}
                 OR d.brand ILIKE $${params.length} OR d.model ILIKE $${params.length}
                 OR c.name ILIKE $${params.length} OR c.cpf ILIKE $${params.length})`;
  }
  return db.all(`${sql} ORDER BY d.serial_number`, params);
};

const findById = (tenantId, id) =>
  db.one(`${BASE_SELECT} WHERE d.tenant_id = $1 AND d.id = $2`, [tenantId, id]);

const findBySerial = (tenantId, serial) =>
  db.one('SELECT * FROM devices WHERE tenant_id = $1 AND serial_number = $2', [tenantId, serial]);

const create = (tenantId, { customerId, serialNumber, type, brand, model }) =>
  db.one(
    `INSERT INTO devices (tenant_id, customer_id, serial_number, type, brand, model)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, customerId, serialNumber, type, brand, model],
  );

const update = (tenantId, id, { customerId, type, brand, model }) =>
  db.one(
    `UPDATE devices SET customer_id = $3, type = $4, brand = $5, model = $6
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, id, customerId, type, brand, model],
  );

const remove = (tenantId, id) =>
  db.run('DELETE FROM devices WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

const count = (tenantId) =>
  db.one('SELECT COUNT(*)::int AS total FROM devices WHERE tenant_id = $1', [tenantId]);

module.exports = { list, findById, findBySerial, create, update, remove, count };
