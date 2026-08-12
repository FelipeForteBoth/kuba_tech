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

// Esteira da O.S.: nasce aguardando agendamento e só avança após ser agendada.
const OS_STATUS = ['Aguardando Agendamento', 'Agendada', 'Em Andamento', 'Finalizada', 'Cancelada'];

const OS_INITIAL_STATUS = 'Aguardando Agendamento';
const OS_SCHEDULED_STATUS = 'Agendada';
const OS_IN_PROGRESS_STATUS = 'Em Andamento';

// SLA de agendamento (prazo para programar a O.S.) em horas.
const SCHEDULING_SLA_HOURS = 24;

// Limites da janela de agendamento: do próximo minuto até 1 mês à frente.
const SCHEDULE_MIN_MINUTES = 1;
const SCHEDULE_MAX_DAYS = 30;

// Situações da assinatura da empresa contratante.
const TENANT_STATUS = ['active', 'suspended', 'canceled'];

module.exports = {
  ROLES,
  ROLE_LABELS,
  TENANT_ROLES,
  OS_STATUS,
  OS_INITIAL_STATUS,
  OS_SCHEDULED_STATUS,
  OS_IN_PROGRESS_STATUS,
  SCHEDULING_SLA_HOURS,
  SCHEDULE_MIN_MINUTES,
  SCHEDULE_MAX_DAYS,
  TENANT_STATUS,
};

