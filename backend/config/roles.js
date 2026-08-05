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

const OS_STATUS = ['A Realizar', 'Em Andamento', 'Finalizada', 'Cancelada'];

// Situações da assinatura da empresa contratante.
const TENANT_STATUS = ['active', 'suspended', 'canceled'];

module.exports = { ROLES, ROLE_LABELS, TENANT_ROLES, OS_STATUS, TENANT_STATUS };

