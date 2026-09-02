// Módulo Clientes — acesso a dados (sempre filtrado por tenant_id).
// Pessoa Física (CPF) e Pessoa Jurídica (CNPJ), com soft delete.
const db = require('../../config/database');

const ACTIVE = 'deleted_at IS NULL';

const list = (tenantId, search, { limit = 500, offset = 0 } = {}) => {
  const params = [tenantId];
  let sql = `SELECT * FROM customers WHERE tenant_id = $1 AND ${ACTIVE}`;
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    sql += ` AND (name ILIKE ${p} OR company_name ILIKE ${p} OR document_number ILIKE ${p}
                  OR email ILIKE ${p} OR phone ILIKE ${p})`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY name LIMIT $${params.length - 1} OFFSET $${params.length}`;
  return db.all(sql, params);
};

const findById = (tenantId, id) =>
  db.one(`SELECT * FROM customers WHERE tenant_id = $1 AND id = $2 AND ${ACTIVE}`, [tenantId, id]);

const findByDocument = (tenantId, documentNumber, ignoreId = null) =>
  db.one(
    `SELECT * FROM customers
      WHERE tenant_id = $1 AND document_number = $2 AND ${ACTIVE}
        AND ($3::uuid IS NULL OR id <> $3)`,
    [tenantId, documentNumber, ignoreId],
  );

// Mantido por compatibilidade com chamadas antigas.
const findByCpf = (tenantId, cpf) => findByDocument(tenantId, cpf);

const create = (tenantId, data) =>
  db.one(
    `INSERT INTO customers
       (tenant_id, cpf, document_type, document_number, name, company_name, phone, email,
        zip_code, address, neighborhood, city, state,
        trade_name, cnae, opening_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      tenantId,
      data.documentType === 'CPF' ? data.documentNumber : null,
      data.documentType,
      data.documentNumber,
      data.name,
      data.companyName,
      data.phone,
      data.email,
      data.zipCode,
      data.address,
      data.neighborhood,
      data.city,
      data.state,
      data.tradeName || null,
      data.cnae || null,
      data.openingDate || null,
    ],
  );

const update = (tenantId, id, data) =>
  db.one(
    `UPDATE customers
        SET name = $3, company_name = $4, phone = $5, email = $6,
            zip_code = $7, address = $8, neighborhood = $9, city = $10, state = $11,
            trade_name = COALESCE($12, trade_name),
            cnae = COALESCE($13, cnae),
            opening_date = COALESCE($14, opening_date)
      WHERE tenant_id = $1 AND id = $2 AND ${ACTIVE} RETURNING *`,
    [
      tenantId, id, data.name, data.companyName, data.phone, data.email,
      data.zipCode, data.address, data.neighborhood, data.city, data.state,
      data.tradeName || null, data.cnae || null, data.openingDate || null,
    ],
  );

/** Soft delete: o histórico da empresa é preservado. */
const remove = (tenantId, id) =>
  db.run(`UPDATE customers SET deleted_at = NOW() WHERE tenant_id = $1 AND id = $2 AND ${ACTIVE}`, [tenantId, id]);

const count = (tenantId) =>
  db.one(`SELECT COUNT(*)::int AS total FROM customers WHERE tenant_id = $1 AND ${ACTIVE}`, [tenantId]);

module.exports = { list, findById, findByDocument, findByCpf, create, update, remove, count };
