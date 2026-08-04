// ─────────────────────────────────────────────────────────────
// Controle de acesso baseado em perfis (RBAC).
// ─────────────────────────────────────────────────────────────
const { ROLES } = require('../config/roles');

/** Permite o acesso apenas aos perfis informados. */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para o seu perfil de usuário.' });
    }
    next();
  };
}

/** Restringe a rota ao Administrador da Plataforma. */
const platformAdminOnly = authorize(ROLES.PLATFORM_ADMIN);

/**
 * Garante que a requisição pertence a uma empresa contratante.
 * O tenant_id NUNCA vem do corpo da requisição: ele é sempre lido
 * do token, o que assegura o isolamento entre empresas.
 */
function tenantScope(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (!req.user.tenantId) {
    return res.status(403).json({
      error: 'Esta operação pertence a uma empresa contratante. Use o painel da plataforma.',
    });
  }
  req.tenantId = req.user.tenantId;
  next();
}

module.exports = { authorize, platformAdminOnly, tenantScope };
