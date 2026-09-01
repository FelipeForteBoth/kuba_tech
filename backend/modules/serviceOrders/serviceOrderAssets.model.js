// Evidências fotográficas, assinatura digital e auditoria da O.S.
const db = require('../../config/database');

// ── Evidências fotográficas ──
const listImages = (tenantId, orderId) =>
  db.all(
    `SELECT id, image_url, uploaded_at, uploaded_by
       FROM service_order_images
      WHERE tenant_id = $1 AND service_order_id = $2 AND deleted_at IS NULL
      ORDER BY uploaded_at`,
    [tenantId, orderId],
  );

const countImages = async (tenantId, orderId) => {
  const row = await db.one(
    `SELECT COUNT(*)::int AS total FROM service_order_images
      WHERE tenant_id = $1 AND service_order_id = $2 AND deleted_at IS NULL`,
    [tenantId, orderId],
  );
  return row.total;
};

const addImage = (tenantId, orderId, { url, publicId, userId }) =>
  db.one(
    `INSERT INTO service_order_images (tenant_id, service_order_id, image_url, public_id, uploaded_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, image_url, uploaded_at`,
    [tenantId, orderId, url, publicId, userId],
  );

const findImage = (tenantId, orderId, imageId) =>
  db.one(
    `SELECT * FROM service_order_images
      WHERE tenant_id = $1 AND service_order_id = $2 AND id = $3 AND deleted_at IS NULL`,
    [tenantId, orderId, imageId],
  );

const removeImage = (tenantId, imageId) =>
  db.run('UPDATE service_order_images SET deleted_at = NOW() WHERE tenant_id = $1 AND id = $2', [tenantId, imageId]);

// ── Assinatura digital ──
const findSignature = (tenantId, orderId) =>
  db.one(
    `SELECT id, signature_url, signer_name, signed_at
       FROM service_order_signatures
      WHERE tenant_id = $1 AND service_order_id = $2 AND deleted_at IS NULL
      ORDER BY signed_at DESC LIMIT 1`,
    [tenantId, orderId],
  );

const clearSignatures = (tenantId, orderId) =>
  db.run(
    `UPDATE service_order_signatures SET deleted_at = NOW()
      WHERE tenant_id = $1 AND service_order_id = $2 AND deleted_at IS NULL`,
    [tenantId, orderId],
  );

const addSignature = (tenantId, orderId, { url, publicId, signerName }) =>
  db.one(
    `INSERT INTO service_order_signatures (tenant_id, service_order_id, signature_url, public_id, signer_name)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, signature_url, signer_name, signed_at`,
    [tenantId, orderId, url, publicId, signerName],
  );

// ── Auditoria ──
const logHistory = (tenantId, orderId, userId, action, description) =>
  db.run(
    `INSERT INTO service_order_history (tenant_id, service_order_id, user_id, action, description)
     VALUES ($1,$2,$3,$4,$5)`,
    [tenantId, orderId, userId || null, action, description || null],
  ).catch((err) => console.error('[auditoria] falha ao registrar histórico:', err.message));

const listHistory = (tenantId, orderId) =>
  db.all(
    `SELECT h.id, h.action, h.description, h.created_at, u.name AS user_name
       FROM service_order_history h
  LEFT JOIN users u ON u.id = h.user_id
      WHERE h.tenant_id = $1 AND h.service_order_id = $2
      ORDER BY h.created_at DESC`,
    [tenantId, orderId],
  );

module.exports = {
  listImages, countImages, addImage, findImage, removeImage,
  findSignature, addSignature, clearSignatures,
  logHistory, listHistory,
};
