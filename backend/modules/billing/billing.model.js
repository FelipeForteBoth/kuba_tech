// Módulo Assinatura — acesso a dados de planos, cobranças manuais e
// solicitações de renovação (Pix / Boleto).
const db = require('../../config/database');

/** Assinatura vigente da empresa (plano, valor e vencimento). */
const findSubscription = (tenantId) =>
  db.one(
    `SELECT t.id, t.company_name, t.document, t.email, t.billing_email, t.status, t.next_due_date,
            t.last_payment_at, t.suspended_at,
            p.id AS plan_id, p.code AS plan_code, p.name AS plan_name,
            p.monthly_price, p.max_users
       FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.id = $1`,
    [tenantId],
  );

/** Planos disponíveis para contratação (com os módulos incluídos). */
const listPlans = () =>
  db.all(
    `SELECT p.id, p.code, p.name, p.description, p.monthly_price, p.max_users,
            COALESCE(
              (SELECT json_agg(m.name ORDER BY m.name)
                 FROM plan_modules pm JOIN modules m ON m.id = pm.module_id
                WHERE pm.plan_id = p.id), '[]'::json) AS modules
       FROM plans p WHERE p.active = TRUE ORDER BY p.monthly_price`,
    [],
  );

const findPlan = (planId) => db.one('SELECT * FROM plans WHERE id = $1 AND active = TRUE', [planId]);

const listPayments = (tenantId, limit = 50) =>
  db.all(
    `SELECT id, plan_name, amount, status, provider, method, external_id,
            due_date, paid_at, created_at
       FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );

const findPayment = (id) => db.one('SELECT * FROM payments WHERE id = $1', [id]);

/** Cobrança em aberto mais recente (evita duplicar cobranças). */
const findOpenPayment = (tenantId) =>
  db.one(
    `SELECT * FROM payments WHERE tenant_id = $1 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId],
  );

const createPayment = (tenantId, { planId, planName, amount, dueDate, method }) =>
  db.one(
    `INSERT INTO payments (tenant_id, plan_id, plan_name, amount, due_date, status, provider, method)
     VALUES ($1,$2,$3,$4,$5,'pending','manual',$6) RETURNING *`,
    [tenantId, planId, planName, amount, dueDate, method || null],
  );

const setPaymentMethod = (id, method) =>
  db.one('UPDATE payments SET method = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, method]);

/** Confirma o pagamento (baixa manual) e renova a assinatura por 30 dias. */
async function approvePayment(paymentId, externalId) {
  return db.transaction(async (client) => {
    const paid = await client.query(
      `UPDATE payments SET status = 'approved', paid_at = NOW(),
              external_id = COALESCE($2, external_id), updated_at = NOW()
        WHERE id = $1 AND status <> 'approved' RETURNING *`,
      [paymentId, externalId || null],
    );
    if (!paid.rows[0]) return null;

    const tenant = await client.query(
      `UPDATE tenants
          SET status = 'active', suspended_at = NULL, last_payment_at = NOW(),
              next_due_date = (GREATEST(COALESCE(next_due_date, CURRENT_DATE), CURRENT_DATE) + INTERVAL '30 days')::date
        WHERE id = $1 RETURNING *`,
      [paid.rows[0].tenant_id],
    );
    return { payment: paid.rows[0], tenant: tenant.rows[0] };
  });
}

const updatePaymentStatus = (id, status) =>
  db.one('UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, status]);

/** Troca o plano da empresa e sincroniza os módulos habilitados. */
async function changePlan(tenantId, planId) {
  return db.transaction(async (client) => {
    const result = await client.query('UPDATE tenants SET plan_id = $2 WHERE id = $1 RETURNING *', [tenantId, planId]);
    if (!result.rows[0]) return null;

    await client.query('DELETE FROM tenant_modules WHERE tenant_id = $1', [tenantId]);
    await client.query(
      `INSERT INTO tenant_modules (tenant_id, module_id)
       SELECT $1, module_id FROM plan_modules WHERE plan_id = $2`,
      [tenantId, planId],
    );
    return result.rows[0];
  });
}

// ── Solicitações de renovação (fluxo manual) ────────────────────────
const OPEN_REQUEST_STATUS = ['sent', 'in_service', 'info_sent', 'awaiting_confirmation'];

/** Solicitação em andamento da empresa (evita pedidos duplicados). */
const findOpenRequest = (tenantId) =>
  db.one(
    `SELECT * FROM payment_requests
      WHERE tenant_id = $1 AND status = ANY($2::varchar[])
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId, OPEN_REQUEST_STATUS],
  );

const createRequest = (tenantId, { paymentId, userId, requesterName, requesterEmail, method, planName, amount }) =>
  db.one(
    `INSERT INTO payment_requests
       (tenant_id, payment_id, requested_by, requester_name, requester_email, method, plan_name, amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [tenantId, paymentId || null, userId || null, requesterName, requesterEmail, method, planName, amount],
  );

/** Histórico de solicitações da própria empresa (escopo do tenant). */
const listRequests = (tenantId, limit = 30) =>
  db.all(
    `SELECT id, method, status, plan_name, amount, notes, requester_name, created_at, updated_at
       FROM payment_requests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );

/** Todas as solicitações (Administrador da Plataforma). */
const listAllRequests = (status) => {
  const base = `
    SELECT r.*, t.company_name, t.document, t.email AS company_email, t.billing_email
      FROM payment_requests r JOIN tenants t ON t.id = r.tenant_id`;
  if (status) return db.all(`${base} WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 200`, [status]);
  return db.all(`${base} ORDER BY r.created_at DESC LIMIT 200`, []);
};

const findRequest = (id) =>
  db.one(
    `SELECT r.*, t.company_name, t.email AS company_email, t.billing_email
       FROM payment_requests r JOIN tenants t ON t.id = r.tenant_id WHERE r.id = $1`,
    [id],
  );

const updateRequest = (id, { status, notes }) =>
  db.one(
    `UPDATE payment_requests
        SET status = COALESCE($2, status),
            notes  = COALESCE($3, notes),
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, status || null, notes === undefined ? null : notes],
  );

module.exports = {
  OPEN_REQUEST_STATUS,
  findSubscription,
  listPlans,
  findPlan,
  listPayments,
  findPayment,
  findOpenPayment,
  createPayment,
  setPaymentMethod,
  approvePayment,
  updatePaymentStatus,
  changePlan,
  findOpenRequest,
  createRequest,
  listRequests,
  listAllRequests,
  findRequest,
  updateRequest,
};
