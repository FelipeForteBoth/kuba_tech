// Módulo Ordens de Serviço — acesso a dados (filtrado por tenant_id).
const db = require('../../config/database');

// Regra de SLA por etapa:
//  - Aberto            -> SLA de agendamento (24h) a partir da abertura;
//  - Agendado          -> sem SLA (apenas a data marcada);
//  - Demais etapas     -> SLA de serviço (48h) a partir do início real.
const SLA_DUE_EXPR = `
  CASE
    WHEN so.status = 'Aberto'
      THEN so.created_at + make_interval(hours => so.scheduling_sla_hours)
    WHEN so.status = 'Agendado' THEN NULL
    WHEN so.status IN ('Finalizado','Entregue','Cancelado') THEN NULL
    ELSE COALESCE(so.execution_start_date, so.started_at, so.scheduled_at, so.created_at)
         + make_interval(hours => so.sla_hours)
  END`;

const SLA_KIND_EXPR = `
  CASE
    WHEN so.status = 'Aberto' THEN 'agendamento'
    WHEN so.status = 'Agendado' THEN 'agendada'
    WHEN so.status IN ('Finalizado','Entregue','Cancelado') THEN 'encerrada'
    ELSE 'servico'
  END`;

const BASE_SELECT = `
  SELECT so.*,
         ${SLA_DUE_EXPR} AS sla_due_at,
         ${SLA_KIND_EXPR} AS sla_kind,
         c.name  AS customer_name,
         c.document_type AS customer_document_type,
         COALESCE(c.document_number, c.cpf) AS customer_cpf,
         c.company_name AS customer_company_name,
         c.phone AS customer_phone,
         d.serial_number, d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
         t.name  AS technician_name,
         u.name  AS created_by_name,
         (SELECT COUNT(*)::int FROM service_order_images i
           WHERE i.service_order_id = so.id AND i.deleted_at IS NULL) AS photo_count,
         (SELECT COUNT(*)::int FROM service_order_signatures s
           WHERE s.service_order_id = so.id AND s.deleted_at IS NULL) AS signature_count
    FROM service_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN devices   d ON d.id = so.device_id
LEFT JOIN users     t ON t.id = so.technician_id
LEFT JOIN users     u ON u.id = so.created_by
`;

/**
 * Atendimento INTERNO agendado cuja hora chegou entra em execução
 * automaticamente (inicia o SLA de serviço). O atendimento EXTERNO
 * depende do técnico iniciar o deslocamento.
 */
const startDueOrders = (tenantId) =>
  db.run(
    `UPDATE service_orders
        SET status = 'Em execução',
            started_at = COALESCE(started_at, scheduled_at, NOW()),
            execution_start_date = COALESCE(execution_start_date, scheduled_at, NOW())
      WHERE tenant_id = $1 AND status = 'Agendado'
        AND COALESCE(service_type, 'interno') = 'interno'
        AND scheduled_at <= NOW() AND deleted_at IS NULL`,
    [tenantId],
  );

const list = (tenantId, { search, status, technicianId, serviceType, limit = 500, offset = 0 } = {}) => {
  const params = [tenantId];
  let sql = `${BASE_SELECT} WHERE so.tenant_id = $1 AND so.deleted_at IS NULL`;

  if (technicianId) {
    params.push(technicianId);
    sql += ` AND so.technician_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND so.status = $${params.length}`;
  }
  if (serviceType) {
    params.push(serviceType);
    sql += ` AND so.service_type = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    sql += ` AND (c.name ILIKE ${p} OR COALESCE(c.document_number, c.cpf) ILIKE ${p}
                 OR d.serial_number ILIKE ${p} OR so.problem_description ILIKE ${p}
                 OR CAST(so.number AS TEXT) ILIKE ${p})`;
  }
  params.push(limit, offset);
  return db.all(
    `${sql} ORDER BY so.number DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
};

const findById = (tenantId, id) =>
  db.one(`${BASE_SELECT} WHERE so.tenant_id = $1 AND so.id = $2 AND so.deleted_at IS NULL`, [tenantId, id]);

const create = (tenantId, data) =>
  db.one(
    `INSERT INTO service_orders
       (tenant_id, customer_id, device_id, technician_id, opening_date, problem_description,
        status, created_by, sla_hours, service_type, zip_code, address, address_number,
        neighborhood, city, state, latitude, longitude)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
      tenantId, data.customerId, data.deviceId, data.technicianId, data.openingDate,
      data.problemDescription, data.status, data.createdBy, data.slaHours,
      data.serviceType, data.zipCode, data.address, data.addressNumber,
      data.neighborhood, data.city, data.state, data.latitude, data.longitude,
    ],
  );

const update = (tenantId, id, data) =>
  db.one(
    `UPDATE service_orders
        SET customer_id = $3, device_id = $4, technician_id = $5, opening_date = $6,
            problem_description = $7, solution = $8, status = $9, sla_hours = $10,
            service_type = $11, zip_code = $12, address = $13, address_number = $14,
            neighborhood = $15, city = $16, state = $17, latitude = $18, longitude = $19
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *`,
    [
      tenantId, id, data.customerId, data.deviceId, data.technicianId, data.openingDate,
      data.problemDescription, data.solution, data.status, data.slaHours,
      data.serviceType, data.zipCode, data.address, data.addressNumber,
      data.neighborhood, data.city, data.state, data.latitude, data.longitude,
    ],
  );

/**
 * Atualização de andamento com os marcos de campo:
 * deslocamento, chegada, início da execução e diagnóstico.
 */
const updateProgress = (tenantId, id, { status, solution, diagnosis }) =>
  db.one(
    `UPDATE service_orders
        SET status = $3,
            solution  = COALESCE($4, solution),
            diagnosis = COALESCE($5, diagnosis),
            departure_date = CASE WHEN $3 = 'Em deslocamento' THEN COALESCE(departure_date, NOW()) ELSE departure_date END,
            arrival_date   = CASE WHEN $3 = 'No local'        THEN COALESCE(arrival_date, NOW())   ELSE arrival_date END,
            execution_start_date = CASE WHEN $3 = 'Em execução' THEN COALESCE(execution_start_date, NOW()) ELSE execution_start_date END,
            started_at = CASE WHEN $3 IN ('Em deslocamento','Em execução') THEN COALESCE(started_at, NOW()) ELSE started_at END
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *`,
    [tenantId, id, status, solution, diagnosis || null],
  );

/** Programa o atendimento: define a data marcada e coloca a O.S. como "Agendado". */
const scheduleOrder = (tenantId, id, { scheduledAt, technicianId }) =>
  db.one(
    `UPDATE service_orders
        SET scheduled_at = $3,
            technician_id = COALESCE($4, technician_id),
            started_at = NULL, execution_start_date = NULL,
            departure_date = NULL, arrival_date = NULL,
            status = 'Agendado'
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *`,
    [tenantId, id, scheduledAt, technicianId],
  );

/** Remove a programação e devolve a O.S. para a fila de agendamento. */
const unscheduleOrder = (tenantId, id) =>
  db.one(
    `UPDATE service_orders
        SET scheduled_at = NULL, started_at = NULL, execution_start_date = NULL,
            departure_date = NULL, arrival_date = NULL, status = 'Aberto'
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *`,
    [tenantId, id],
  );

/** Soft delete. */
const remove = (tenantId, id) =>
  db.run(
    'UPDATE service_orders SET deleted_at = NOW() WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL',
    [tenantId, id],
  );

/** Indicadores para o painel da empresa. */
const statusSummary = (tenantId, technicianId) => {
  const params = [tenantId];
  let filter = '';
  if (technicianId) {
    params.push(technicianId);
    filter = ' AND technician_id = $2';
  }
  return db.all(
    `SELECT status, COUNT(*)::int AS total
       FROM service_orders WHERE tenant_id = $1 AND deleted_at IS NULL${filter}
      GROUP BY status`,
    params,
  );
};

/** Ajuste isolado do prazo (SLA) da O.S. — Administrador da Empresa. */
const updateSla = (tenantId, id, slaHours) =>
  db.one('UPDATE service_orders SET sla_hours = $3 WHERE tenant_id = $1 AND id = $2 RETURNING *', [
    tenantId,
    id,
    slaHours,
  ]);

module.exports = {
  updateSla, startDueOrders, scheduleOrder, unscheduleOrder, list, findById,
  create, update, updateProgress, remove, statusSummary,
};
