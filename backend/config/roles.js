// Perfis de acesso (RBAC) reconhecidos pela plataforma.
const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  COMPANY_ADMIN: 'company_admin',
  ATTENDANT: 'attendant',
  TECHNICIAN: 'technician',
  MANAGER: 'manager',
};

const ROLE_LABELS = {
  platform_admin: 'Administrador da Plataforma',
  company_admin: 'Administrador da Empresa',
  attendant: 'Atendente',
  technician: 'Técnico',
  manager: 'Gestor',
};

// Perfis que podem ser criados dentro de uma empresa contratante.
const TENANT_ROLES = [ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN, ROLES.MANAGER];

// ── Esteira da Ordem de Serviço (v2 — atendimento interno e externo) ──
const OS_STATUS = [
  'Aberto',
  'Ag. Execução',
  'Agendado',
  'Em deslocamento',
  'No local',
  'Em execução',
  'Aguardando cliente',
  'Finalizado',
  'Entregue',
  'Cancelado',
];

const OS_INITIAL_STATUS = 'Aberto';
// A O.S. interna não passa por agendamento: nasce aguardando execução.
const OS_INTERNAL_INITIAL_STATUS = 'Ag. Execução';
const OS_SCHEDULED_STATUS = 'Agendado';
const OS_IN_PROGRESS_STATUS = 'Em execução';
const OS_CLOSED_STATUS = ['Finalizado', 'Entregue', 'Cancelado'];

// Transições permitidas (o backend recusa qualquer salto fora do fluxo).
const OS_TRANSITIONS = {
  'Aberto': ['Agendado', 'Cancelado'],
  'Ag. Execução': ['Em execução', 'Cancelado'],
  'Agendado': ['Em deslocamento', 'Em execução', 'Aguardando cliente', 'Cancelado', 'Aberto'],
  'Em deslocamento': ['No local', 'Aguardando cliente', 'Cancelado'],
  'No local': ['Em execução', 'Aguardando cliente', 'Cancelado'],
  'Em execução': ['Aguardando cliente', 'Finalizado', 'Cancelado'],
  'Aguardando cliente': ['Em execução', 'Finalizado', 'Cancelado'],
  'Finalizado': ['Entregue'],
  'Entregue': [],
  'Cancelado': [],
};

// Tipo de atendimento.
const SERVICE_TYPES = ['interno', 'externo'];

// A O.S. INTERNA é executada na própria assistência: não existe
// agendamento, deslocamento da equipe nem espera no local do cliente.
const OS_INTERNAL_BLOCKED_STATUS = ['Em deslocamento', 'No local', 'Aguardando cliente', 'Aberto', 'Agendado'];
// "Ag. Execução" existe apenas no fluxo interno.
const OS_EXTERNAL_BLOCKED_STATUS = ['Ag. Execução'];

/** Status inicial conforme o tipo de atendimento. */
function osInitialStatusFor(serviceType) {
  return serviceType === 'interno' ? OS_INTERNAL_INITIAL_STATUS : OS_INITIAL_STATUS;
}

/** Status bloqueados para o tipo de atendimento informado. */
function osBlockedStatusFor(serviceType) {
  return serviceType === 'interno' ? OS_INTERNAL_BLOCKED_STATUS : OS_EXTERNAL_BLOCKED_STATUS;
}

/** Status válidos para o tipo de atendimento informado. */
function osStatusesFor(serviceType) {
  const bloqueados = osBlockedStatusFor(serviceType);
  return OS_STATUS.filter((s) => !bloqueados.includes(s));
}

/** Transições permitidas a partir de um status, respeitando o tipo de atendimento. */
function osTransitionsFor(serviceType, status) {
  const permitidas = OS_TRANSITIONS[status] || [];
  const bloqueados = osBlockedStatusFor(serviceType);
  return permitidas.filter((s) => !bloqueados.includes(s));
}

// Diagnóstico do encerramento (regra das evidências fotográficas).
const DIAGNOSIS = ['Serviço Completo', 'Encerramento Interno'];
const DIAGNOSIS_FULL_SERVICE = 'Serviço Completo';

// Evidências fotográficas.
const PHOTOS_MIN = 2;
const PHOTOS_MAX = 15;

// SLA de agendamento (prazo para programar a O.S.) em horas.
const SCHEDULING_SLA_HOURS = 24;

// Limites da janela de agendamento: do próximo minuto até 1 mês à frente.
const SCHEDULE_MIN_MINUTES = 1;
const SCHEDULE_MAX_DAYS = 30;

// Situações da assinatura da empresa contratante.
const TENANT_STATUS = ['active', 'suspended', 'canceled'];

// Códigos dos módulos comercializáveis.
const MODULES = {
  CUSTOMERS: 'customers',
  DEVICES: 'devices',
  ORDERS: 'orders',
  USERS: 'users',
  REPORTS: 'reports',
  SLA: 'sla',
  SCHEDULE: 'schedule',
  PORTAL: 'portal',
  PHOTOS: 'service-order-photos',
  SIGNATURE: 'digital-signature',
  GEOLOCATION: 'geolocation',
};

module.exports = {
  ROLES,
  ROLE_LABELS,
  TENANT_ROLES,
  OS_STATUS,
  OS_INITIAL_STATUS,
  OS_INTERNAL_INITIAL_STATUS,
  OS_SCHEDULED_STATUS,
  OS_IN_PROGRESS_STATUS,
  OS_CLOSED_STATUS,
  OS_TRANSITIONS,
  OS_INTERNAL_BLOCKED_STATUS,
  OS_EXTERNAL_BLOCKED_STATUS,
  osInitialStatusFor,
  osStatusesFor,
  osTransitionsFor,
  SERVICE_TYPES,
  DIAGNOSIS,
  DIAGNOSIS_FULL_SERVICE,
  PHOTOS_MIN,
  PHOTOS_MAX,
  SCHEDULING_SLA_HOURS,
  SCHEDULE_MIN_MINUTES,
  SCHEDULE_MAX_DAYS,
  TENANT_STATUS,
  MODULES,
};
