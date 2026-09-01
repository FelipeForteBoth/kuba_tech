// Módulo Plano — acesso a dados (somente leitura do plano contratado
// e solicitações de alteração; a plataforma não processa pagamentos).
const db = require('../../config/database');

/** Plano vigente da empresa contratante + módulos habilitados. */
const subscription = (tenantId) =>
  db.one(
    `SELECT t.id            AS tenant_id,
            t.company_name,
            t.status,
            t.suspended_at,
            t.sla_hours,
            p.id            AS plan_id,
            p.code          AS plan_code,
            p.name          AS plan_name,
            p.description   AS plan_description,
            p.monthly_price,
            p.max_users,
            (SELECT COUNT(*)::int FROM users u
              WHERE u.tenant_id = t.id AND u.deleted_at IS NULL) AS users_count,
            COALESCE(
              (SELECT json_agg(json_build_object('code', m.code, 'name', m.name,
                                                 'description', m.description) ORDER BY m.name)
                 FROM tenant_modules tm JOIN modules m ON m.id = tm.module_id
                WHERE tm.tenant_id = t.id), '[]'::json) AS modules
       FROM tenants t
  LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.id = $1`,
    [tenantId],
  );

/** Catálogo de planos (comparativo exibido para a empresa). */
const plans = () =>
  db.all(
    `SELECT p.id, p.code, p.name, p.description, p.monthly_price, p.max_users,
            COALESCE(
              (SELECT json_agg(m.name ORDER BY m.name)
                 FROM plan_modules pm JOIN modules m ON m.id = pm.module_id
                WHERE pm.plan_id = p.id), '[]'::json) AS modules
       FROM plans p
      WHERE p.active = TRUE
      ORDER BY p.monthly_price`,
    [],
  );

const openRequest = (tenantId) =>
  db.one(
    `SELECT * FROM plan_change_requests
      WHERE tenant_id = $1 AND status IN ('pending', 'in_service')
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId],
  );

const listRequests = (tenantId) =>
  db.all(
    `SELECT r.*, pc.name AS current_plan_name, pd.name AS desired_plan_name
       FROM plan_change_requests r
  LEFT JOIN plans pc ON pc.id = r.current_plan_id
  LEFT JOIN plans pd ON pd.id = r.desired_plan_id
      WHERE r.tenant_id = $1
      ORDER BY r.created_at DESC
      LIMIT 30`,
    [tenantId],
  );

const createRequest = ({
  tenantId, userId, requesterName, requesterEmail, currentPlanId, desiredPlanId, message,
}) =>
  db.one(
    `INSERT INTO plan_change_requests
       (tenant_id, requested_by, requester_name, requester_email,
        current_plan_id, desired_plan_id, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tenantId, userId, requesterName, requesterEmail, currentPlanId, desiredPlanId, message],
  );

module.exports = { subscription, plans, openRequest, listRequests, createRequest };
