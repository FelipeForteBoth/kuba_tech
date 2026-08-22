// Módulo Ordens de Serviço — regras de negócio e ciclo de vida da O.S. (v2).
const model = require('./serviceOrder.model');
const assets = require('./serviceOrderAssets.model');
const customerModel = require('../customers/customer.model');
const deviceModel = require('../devices/device.model');
const userModel = require('../users/user.model');
const companyModel = require('../company/company.model');
const { parseSlaHours } = require('../company/company.controller');
const { AppError } = require('../../shared/http');
const { tenantHasModule } = require('../../middleware/modules');
const cloudinary = require('../../shared/cloudinary');
const { geocode, buildAddress } = require('../../shared/geo');
const {
  ROLES,
  OS_STATUS,
  OS_INITIAL_STATUS,
  OS_CLOSED_STATUS,
  OS_TRANSITIONS,
  SERVICE_TYPES,
  DIAGNOSIS,
  DIAGNOSIS_FULL_SERVICE,
  PHOTOS_MIN,
  PHOTOS_MAX,
  SCHEDULE_MIN_MINUTES,
  SCHEDULE_MAX_DAYS,
  MODULES,
} = require('../../config/roles');
const { isNonEmptyText, isValidUUID, isValidPastOrTodayDate, onlyDigits } = require('../../shared/validators');

// O Técnico enxerga e atualiza apenas as O.S. atribuídas a ele.
function technicianFilter(user) {
  return user.role === ROLES.TECHNICIAN ? user.id : null;
}

async function index(req, res) {
  await model.startDueOrders(req.tenantId);
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const serviceType = String(req.query.serviceType || '').trim();
  if (status && !OS_STATUS.includes(status)) throw new AppError('Status inválido.');
  if (serviceType && !SERVICE_TYPES.includes(serviceType)) throw new AppError('Tipo de atendimento inválido.');

  res.json(
    await model.list(req.tenantId, {
      search,
      status: status || null,
      serviceType: serviceType || null,
      technicianId: technicianFilter(req.user),
      limit: Math.min(Number(req.query.limit) || 500, 1000),
      offset: Math.max(Number(req.query.offset) || 0, 0),
    }),
  );
}

async function summary(req, res) {
  await model.startDueOrders(req.tenantId);
  const rows = await model.statusSummary(req.tenantId, technicianFilter(req.user));
  const totals = OS_STATUS.reduce((acc, st) => ({ ...acc, [st]: 0 }), {});
  rows.forEach((row) => {
    totals[row.status] = row.total;
  });

  res.json({
    ordens: totals,
    clientes: (await customerModel.count(req.tenantId)).total,
    equipamentos: (await deviceModel.count(req.tenantId)).total,
  });
}

async function loadOrder(req) {
  await model.startDueOrders(req.tenantId);
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const order = await model.findById(req.tenantId, req.params.id);
  if (!order) throw new AppError('Ordem de serviço não encontrada.', 404);
  if (req.user.role === ROLES.TECHNICIAN && order.technician_id !== req.user.id) {
    throw new AppError('Esta ordem de serviço não está atribuída a você.', 403);
  }
  return order;
}

async function show(req, res) {
  res.json(await loadOrder(req));
}

function optionalText(value, max = 255) {
  const v = String(value || '').trim();
  return v ? v.slice(0, max) : null;
}

/** Endereço do atendimento externo (ViaCEP no front + geocodificação aqui). */
async function resolveLocation(req, body, current) {
  const serviceType = String(body.serviceType || (current && current.service_type) || 'interno').trim();
  if (!SERVICE_TYPES.includes(serviceType)) throw new AppError('Selecione o tipo de atendimento (interno ou externo).');

  if (serviceType === 'interno') {
    return {
      serviceType,
      zipCode: null, address: null, addressNumber: null,
      neighborhood: null, city: null, state: null, latitude: null, longitude: null,
    };
  }

  if (!(await tenantHasModule(req.tenantId, MODULES.GEOLOCATION))) {
    throw new AppError('O atendimento externo faz parte do módulo Geolocalização, que não está no plano contratado.', 403);
  }

  const zip = onlyDigits(body.zipCode);
  if (zip.length !== 8) throw new AppError('Informe o CEP do atendimento (8 números).');
  const address = optionalText(body.address);
  const addressNumber = optionalText(body.addressNumber, 20);
  const neighborhood = optionalText(body.neighborhood, 100);
  const city = optionalText(body.city, 100);
  const state = optionalText(body.state, 50);
  if (!address || !city || !state) throw new AppError('Informe rua, cidade e estado do atendimento.');

  const location = {
    serviceType,
    zipCode: `${zip.slice(0, 5)}-${zip.slice(5)}`,
    address, addressNumber, neighborhood, city, state,
    latitude: null, longitude: null,
  };

  const coords = await geocode(buildAddress(location));
  if (coords) {
    location.latitude = coords.latitude;
    location.longitude = coords.longitude;
  }
  return location;
}

async function validatePayload(req, current = null) {
  const customerId = String(req.body.customerId || '').trim();
  const deviceId = String(req.body.deviceId || '').trim();
  const technicianId = String(req.body.technicianId || '').trim() || null;
  const openingDate = String(req.body.openingDate || '').trim();
  const problemDescription = String(req.body.problemDescription || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  // Toda O.S. nasce Aberta; na edição o status atual é preservado.
  const status = current ? String(req.body.status || current.status).trim() : OS_INITIAL_STATUS;

  // SLA: usa o prazo padrão da empresa (48h de fábrica) quando não informado.
  let slaHours;
  if (req.body.slaHours === undefined || req.body.slaHours === null || req.body.slaHours === '') {
    const settings = await companyModel.findSettings(req.tenantId);
    slaHours = (current && Number(current.sla_hours)) || Number(settings && settings.sla_hours) || 48;
  } else {
    slaHours = parseSlaHours(req.body.slaHours);
  }

  if (!isValidUUID(customerId)) throw new AppError('Selecione o cliente da ordem de serviço.');
  if (!isValidUUID(deviceId)) throw new AppError('Selecione o equipamento da ordem de serviço.');
  if (technicianId && !isValidUUID(technicianId)) throw new AppError('Técnico inválido.');
  if (!isValidPastOrTodayDate(openingDate)) throw new AppError('Data de abertura inválida. Não pode ser futura.');
  if (!isNonEmptyText(problemDescription, 10)) throw new AppError('Descreva o problema com pelo menos 10 caracteres.');
  if (!OS_STATUS.includes(status)) throw new AppError('Status inválido.');

  const customer = await customerModel.findById(req.tenantId, customerId);
  if (!customer) throw new AppError('Cliente não encontrado nesta empresa.', 404);

  const device = await deviceModel.findById(req.tenantId, deviceId);
  if (!device) throw new AppError('Equipamento não encontrado nesta empresa.', 404);
  if (device.customer_id !== customerId) throw new AppError('O equipamento selecionado não pertence a este cliente.');

  if (technicianId) {
    const technician = await userModel.findById(req.tenantId, technicianId);
    if (!technician || technician.role !== ROLES.TECHNICIAN || technician.active === false) {
      throw new AppError('Selecione um usuário com o perfil Técnico da empresa.');
    }
  }

  const location = await resolveLocation(req, req.body, current);

  return {
    customerId, deviceId, technicianId, openingDate, problemDescription,
    solution, status, slaHours, ...location,
  };
}

async function store(req, res) {
  const data = await validatePayload(req);
  const created = await model.create(req.tenantId, { ...data, createdBy: req.user.id });
  await assets.logHistory(
    req.tenantId, created.id, req.user.id, 'criacao',
    `O.S. #${created.number} aberta (atendimento ${data.serviceType}).`,
  );
  res.status(201).json(await model.findById(req.tenantId, created.id));
}

async function update(req, res) {
  const current = await loadOrder(req);
  const data = await validatePayload(req, current);
  await model.update(req.tenantId, req.params.id, data);
  await assets.logHistory(req.tenantId, req.params.id, req.user.id, 'edicao', 'Dados da ordem de serviço alterados.');
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/schedule — programa o atendimento (mínimo: próximo minuto; máximo: 1 mês).
function parseScheduledAt(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new AppError('Informe a data e a hora do atendimento.');
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw new AppError('Data do atendimento inválida.');

  const min = new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60000);
  const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
  if (when < min) throw new AppError('O agendamento deve ser para, no mínimo, o próximo minuto.');
  if (when > max) throw new AppError('O agendamento deve ser para, no máximo, 1 mês à frente.');
  return when;
}

async function schedule(req, res) {
  const order = await loadOrder(req);
  if (OS_CLOSED_STATUS.includes(order.status)) {
    throw new AppError('Esta ordem de serviço já foi encerrada.');
  }

  // Desmarcar devolve a O.S. para a fila de agendamento.
  if (req.body.scheduledAt === null || String(req.body.scheduledAt || '').trim() === '') {
    if (req.body.clear !== true) throw new AppError('Informe a data e a hora do atendimento.');
    await model.unscheduleOrder(req.tenantId, req.params.id);
    await assets.logHistory(req.tenantId, req.params.id, req.user.id, 'desagendamento', 'Agendamento cancelado.');
    return res.json(await model.findById(req.tenantId, req.params.id));
  }

  const scheduledAt = parseScheduledAt(req.body.scheduledAt);

  const technicianId = String(req.body.technicianId || '').trim() || null;
  if (technicianId) {
    if (!isValidUUID(technicianId)) throw new AppError('Técnico inválido.');
    const technician = await userModel.findById(req.tenantId, technicianId);
    if (!technician || technician.role !== ROLES.TECHNICIAN || technician.active === false) {
      throw new AppError('Selecione um usuário com o perfil Técnico da empresa.');
    }
  }

  await model.scheduleOrder(req.tenantId, req.params.id, { scheduledAt, technicianId });
  await assets.logHistory(
    req.tenantId, req.params.id, req.user.id, 'agendamento',
    `Atendimento agendado para ${scheduledAt.toISOString()}.`,
  );
  res.json(await model.findById(req.tenantId, req.params.id));
}

/** Regras de encerramento: evidências fotográficas e assinatura digital. */
async function assertClosingRequirements(req, order) {
  const diagnosis = order.diagnosis;
  const photosModule = await tenantHasModule(req.tenantId, MODULES.PHOTOS);
  const signatureModule = await tenantHasModule(req.tenantId, MODULES.SIGNATURE);

  if (photosModule && diagnosis === DIAGNOSIS_FULL_SERVICE) {
    const total = await assets.countImages(req.tenantId, order.id);
    if (total < PHOTOS_MIN) {
      throw new AppError(
        `Diagnóstico "Serviço Completo" exige no mínimo ${PHOTOS_MIN} evidências fotográficas (atual: ${total}).`,
      );
    }
  }

  if (signatureModule && order.service_type === 'externo') {
    const signature = await assets.findSignature(req.tenantId, order.id);
    if (!signature) throw new AppError('Capture a assinatura do cliente para finalizar o atendimento externo.');
  }
}

// PATCH /:id/status — andamento do ciclo de vida (Técnico, Atendente e Admin)
async function updateStatus(req, res) {
  const order = await loadOrder(req);

  const status = String(req.body.status || '').trim();
  const solution = String(req.body.solution || '').trim() || null;
  const diagnosis = String(req.body.diagnosis || '').trim() || null;

  if (!OS_STATUS.includes(status)) throw new AppError('Status inválido.');
  if (diagnosis && !DIAGNOSIS.includes(diagnosis)) throw new AppError('Diagnóstico inválido.');
  if (status === 'Agendado') {
    throw new AppError('Use a programação do atendimento para agendar a ordem de serviço.');
  }
  if (status !== order.status && !(OS_TRANSITIONS[order.status] || []).includes(status)) {
    throw new AppError(`Não é possível mudar de "${order.status}" para "${status}".`);
  }
  if (status === 'Finalizado') {
    if (!isNonEmptyText(solution, 5)) {
      throw new AppError('Descreva o serviço executado para finalizar a ordem de serviço.');
    }
    const finalDiagnosis = diagnosis || order.diagnosis;
    if (!finalDiagnosis) throw new AppError('Informe o diagnóstico (Serviço Completo ou Encerramento Interno).');
    await assertClosingRequirements(req, { ...order, diagnosis: finalDiagnosis });
  }

  await model.updateProgress(req.tenantId, req.params.id, { status, solution, diagnosis });
  await assets.logHistory(
    req.tenantId, req.params.id, req.user.id, 'status',
    `Status alterado de "${order.status}" para "${status}".`,
  );
  res.json(await model.findById(req.tenantId, req.params.id));
}

// PATCH /:id/sla — ajuste do prazo pelo Administrador da Empresa.
async function updateSla(req, res) {
  await loadOrder(req);
  const slaHours = parseSlaHours(req.body.slaHours);
  await model.updateSla(req.tenantId, req.params.id, slaHours);
  await assets.logHistory(req.tenantId, req.params.id, req.user.id, 'sla', `Prazo ajustado para ${slaHours}h.`);
  res.json(await model.findById(req.tenantId, req.params.id));
}

async function destroy(req, res) {
  await loadOrder(req);
  const removed = await model.remove(req.tenantId, req.params.id);
  if (!removed) throw new AppError('Ordem de serviço não encontrada.', 404);
  await assets.logHistory(req.tenantId, req.params.id, req.user.id, 'exclusao', 'Ordem de serviço excluída.');
  res.json({ message: 'Ordem de serviço excluída com sucesso.' });
}

// ── Evidências fotográficas (módulo service-order-photos) ──
async function listPhotos(req, res) {
  const order = await loadOrder(req);
  res.json({
    max: PHOTOS_MAX,
    min: PHOTOS_MIN,
    diagnosis: order.diagnosis,
    fotos: await assets.listImages(req.tenantId, order.id),
  });
}

async function addPhotos(req, res) {
  const order = await loadOrder(req);
  if (OS_CLOSED_STATUS.includes(order.status) && order.status !== 'Finalizado') {
    throw new AppError('Esta ordem de serviço já foi encerrada.');
  }

  const images = Array.isArray(req.body.images) ? req.body.images : [req.body.image].filter(Boolean);
  if (!images.length) throw new AppError('Selecione ao menos uma foto.');

  const current = await assets.countImages(req.tenantId, order.id);
  if (current + images.length > PHOTOS_MAX) {
    throw new AppError(`Limite de ${PHOTOS_MAX} fotos por ordem de serviço (atual: ${current}).`);
  }

  const saved = [];
  for (const image of images) {
    const uploaded = await cloudinary.upload(image, `kuba-tech/${req.tenantId}/os-${order.number}`);
    saved.push(await assets.addImage(req.tenantId, order.id, {
      url: uploaded.url, publicId: uploaded.publicId, userId: req.user.id,
    }));
  }

  await assets.logHistory(
    req.tenantId, order.id, req.user.id, 'fotos',
    `${saved.length} evidência(s) fotográfica(s) adicionada(s).`,
  );
  res.status(201).json({ fotos: saved, total: current + saved.length, max: PHOTOS_MAX });
}

async function removePhoto(req, res) {
  const order = await loadOrder(req);
  if (!isValidUUID(req.params.imageId)) throw new AppError('Identificador inválido.');
  const image = await assets.findImage(req.tenantId, order.id, req.params.imageId);
  if (!image) throw new AppError('Foto não encontrada.', 404);

  await assets.removeImage(req.tenantId, image.id);
  await cloudinary.destroy(image.public_id);
  await assets.logHistory(req.tenantId, order.id, req.user.id, 'fotos', 'Evidência fotográfica removida.');
  res.json({ message: 'Foto removida.' });
}

// ── Assinatura digital (módulo digital-signature) ──
async function getSignature(req, res) {
  const order = await loadOrder(req);
  res.json({ assinatura: await assets.findSignature(req.tenantId, order.id) });
}

async function saveSignature(req, res) {
  const order = await loadOrder(req);
  if (OS_CLOSED_STATUS.includes(order.status) && order.status !== 'Finalizado') {
    throw new AppError('Esta ordem de serviço já foi encerrada.');
  }
  const image = String(req.body.signature || req.body.image || '');
  if (!image) throw new AppError('Assine no campo indicado antes de salvar.');

  const signerName = optionalText(req.body.signerName, 120) || order.customer_name;
  const uploaded = await cloudinary.upload(image, `kuba-tech/${req.tenantId}/assinaturas`);

  await assets.clearSignatures(req.tenantId, order.id);
  const signature = await assets.addSignature(req.tenantId, order.id, {
    url: uploaded.url, publicId: uploaded.publicId, signerName,
  });
  await assets.logHistory(req.tenantId, order.id, req.user.id, 'assinatura', `Assinatura capturada (${signerName}).`);
  res.status(201).json({ assinatura: signature });
}

async function deleteSignature(req, res) {
  const order = await loadOrder(req);
  await assets.clearSignatures(req.tenantId, order.id);
  await assets.logHistory(req.tenantId, order.id, req.user.id, 'assinatura', 'Assinatura removida.');
  res.json({ message: 'Assinatura removida.' });
}

// ── Auditoria ──
async function history(req, res) {
  const order = await loadOrder(req);
  res.json(await assets.listHistory(req.tenantId, order.id));
}

module.exports = {
  index, summary, show, store, update, schedule, updateStatus, updateSla, destroy,
  listPhotos, addPhotos, removePhoto,
  getSignature, saveSignature, deleteSignature,
  history,
};
