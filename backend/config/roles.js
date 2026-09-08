// Perfis de acesso (RBAC) reconhecidos pela plataforma.
const ROLES = { PLATFORM_ADMIN: 'platform_admin', COMPANY_ADMIN: 'company_admin', ATTENDANT: 'attendant', TECHNICIAN: 'technician', MANAGER: 'manager' };
const ROLE_LABELS = { platform_admin: 'Administrador da Plataforma', company_admin: 'Administrador da Empresa', attendant: 'Atendente', technician: 'Técnico', manager: 'Gestor' };
const TENANT_ROLES = [ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN, ROLES.MANAGER];
const OS_STATUS = ['Aberto','Agendado','Em deslocamento','No local','Em execução','Aguardando cliente','Finalizado','Entregue','Cancelado'];
const OS_INITIAL_STATUS = 'Aberto';
const OS_SCHEDULED_STATUS = 'Agendado';
const OS_IN_PROGRESS_STATUS = 'Em execução';
const OS_CLOSED_STATUS = ['Finalizado', 'Entregue', 'Cancelado'];
const OS_TRANSITIONS = {
  'Aberto': ['Agendado', 'Cancelado'],
  'Agendado': ['Em deslocamento', 'Em execução', 'Aguardando cliente', 'Cancelado', 'Aberto'],
  'Em deslocamento': ['No local', 'Aguardando cliente', 'Cancelado'],
  'No local': ['Em execução', 'Aguardando cliente', 'Cancelado'],
  'Em execução': ['Aguardando cliente', 'Finalizado', 'Cancelado'],
  'Aguardando cliente': ['Em execução', 'Finalizado', 'Cancelado'],
  'Finalizado': ['Entregue'], 'Entregue': [], 'Cancelado': [],
};
const OS_INTERNAL_TRANSITIONS = {
  'Aberto': ['Agendado', 'Em execução', 'Cancelado'],
  'Agendado': ['Em execução', 'Cancelado', 'Aberto'],
  'Em execução': ['Aguardando cliente', 'Finalizado', 'Cancelado'],
  'Aguardando cliente': ['Em execução', 'Finalizado', 'Cancelado'],
  'Finalizado': ['Entregue'], 'Entregue': [], 'Cancelado': [],
};
const SERVICE_TYPES = ['interno','externo'];
const DIAGNOSIS = ['Serviço Completo','Encerramento Interno'];
const DIAGNOSIS_FULL_SERVICE = 'Serviço Completo';
const PHOTOS_MIN = 2; const PHOTOS_MAX = 15;
const SCHEDULING_SLA_HOURS = 24; const SCHEDULE_MIN_MINUTES = 1; const SCHEDULE_MAX_DAYS = 30;
const TENANT_STATUS = ['active','suspended','canceled'];
const MODULES = { CUSTOMERS:'customers', DEVICES:'devices', ORDERS:'orders', USERS:'users', REPORTS:'reports', SLA:'sla', SCHEDULE:'schedule', PORTAL:'portal', PHOTOS:'service-order-photos', SIGNATURE:'digital-signature', GEOLOCATION:'geolocation' };
module.exports = { ROLES, ROLE_LABELS, TENANT_ROLES, OS_STATUS, OS_INITIAL_STATUS, OS_SCHEDULED_STATUS, OS_IN_PROGRESS_STATUS, OS_CLOSED_STATUS, OS_TRANSITIONS, OS_INTERNAL_TRANSITIONS, SERVICE_TYPES, DIAGNOSIS, DIAGNOSIS_FULL_SERVICE, PHOTOS_MIN, PHOTOS_MAX, SCHEDULING_SLA_HOURS, SCHEDULE_MIN_MINUTES, SCHEDULE_MAX_DAYS, TENANT_STATUS, MODULES };
