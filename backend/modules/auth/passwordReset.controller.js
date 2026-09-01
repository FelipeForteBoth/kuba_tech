// ─────────────────────────────────────────────────────────────
// Recuperação de senha com aprovação hierárquica.
//
//   • Funcionário (atendente, técnico, gestor)
//       → aprovado pelo Administrador da Empresa
//   • Administrador da Empresa
//       → aprovado pelo Administrador da Plataforma
//
// O usuário nunca redefine a senha sozinho: o pedido fica pendente
// até a aprovação. Aprovado, ele recebe um link de uso único válido
// por 1 hora (o token é guardado em hash, nunca em texto puro).
// ─────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const model = require('./passwordReset.model');
const mailer = require('../../shared/mailer');
const { AppError } = require('../../shared/http');
const { ROLES } = require('../../config/roles');
const { isValidEmail, isValidPassword, isValidUUID } = require('../../shared/validators');
const { resetUrl, panelUrl } = require('../../shared/appUrl');

const SALT_ROUNDS = 10;
const TOKEN_TTL_HOURS = 1;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const STATUS_LABEL = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovada — link enviado',
  rejected: 'Recusada',
  used: 'Senha redefinida',
  expired: 'Expirada',
};

const withLabel = (r) => ({ ...r, status_label: STATUS_LABEL[r.status] || r.status, token_hash: undefined });

// POST /api/auth/forgot-password  (público)
async function forgot(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) throw new AppError('Informe um e-mail válido.');

  // Resposta sempre genérica: não revela se o e-mail existe.
  const generico = {
    message: 'Se o e-mail estiver cadastrado, o responsável receberá a solicitação para aprovação.',
  };

  const user = await model.findUserByEmail(email);
  if (!user || !user.active) return res.json(generico);
  if (user.role === ROLES.PLATFORM_ADMIN) {
    return res.json({
      message: 'A senha do Administrador da Plataforma é redefinida diretamente no banco de dados por segurança.',
    });
  }
  if (await model.pendingForUser(user.id)) {
    return res.json({ message: 'Já existe uma solicitação em análise para este usuário. Aguarde a aprovação.' });
  }

  const approverScope = user.role === ROLES.COMPANY_ADMIN
    ? ROLES.PLATFORM_ADMIN
    : ROLES.COMPANY_ADMIN;

  await model.create({
    userId: user.id,
    tenantId: user.tenant_id,
    approverScope,
    reason: String(req.body.reason || '').trim().slice(0, 300) || null,
  });

  const aprovadores = approverScope === ROLES.PLATFORM_ADMIN
    ? await model.platformAdmins()
    : await model.companyAdmins(user.tenant_id);

  const destino = approverScope === ROLES.PLATFORM_ADMIN ? 'plataforma.html' : 'usuarios.html';
  await Promise.all(
    aprovadores.map((a) =>
      mailer.sendTemplate('recuperacaoSolicitada', a.email, {
        approverName: a.name,
        userName: user.name,
        userEmail: user.email,
        companyName: user.company_name,
        panelUrl: panelUrl(destino),
      }, user.tenant_id)),
  );

  res.json(generico);
}

// GET /api/auth/password-requests  (aprovador autenticado)
async function list(req, res) {
  const status = String(req.query.status || '').trim();
  if (req.user.role === ROLES.PLATFORM_ADMIN) {
    return res.json((await model.listForPlatform(status)).map(withLabel));
  }
  if (req.user.role !== ROLES.COMPANY_ADMIN) throw new AppError('Acesso negado para o seu perfil.', 403);
  res.json((await model.listForCompany(req.user.tenantId, status)).map(withLabel));
}

/** Garante que o aprovador logado pode decidir sobre a solicitação. */
async function carregarParaDecisao(req) {
  if (!isValidUUID(req.params.id)) throw new AppError('Identificador inválido.');
  const pedido = await model.findById(req.params.id);
  if (!pedido) throw new AppError('Solicitação não encontrada.', 404);
  if (pedido.status !== 'pending') throw new AppError('Esta solicitação já foi decidida.', 409);

  if (req.user.role === ROLES.PLATFORM_ADMIN) {
    if (pedido.approver_scope !== ROLES.PLATFORM_ADMIN) throw new AppError('Solicitação de outra alçada.', 403);
  } else if (req.user.role === ROLES.COMPANY_ADMIN) {
    if (pedido.approver_scope !== ROLES.COMPANY_ADMIN || pedido.tenant_id !== req.user.tenantId) {
      throw new AppError('Solicitação de outra alçada.', 403);
    }
  } else {
    throw new AppError('Acesso negado para o seu perfil.', 403);
  }
  return pedido;
}

// POST /api/auth/password-requests/:id/approve
async function approve(req, res) {
  const pedido = await carregarParaDecisao(req);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
  await model.approve(pedido.id, {
    tokenHash: hashToken(token),
    expiresAt,
    decidedBy: req.user.id,
  });

  const link = resetUrl(token);
  const email = await mailer.sendTemplate('recuperacaoAprovada', pedido.user_email, {
    name: pedido.user_name,
    resetUrl: link,
    expiresInHours: TOKEN_TTL_HOURS,
  }, pedido.tenant_id);

  res.json({
    message: email.sent
      ? 'Solicitação aprovada. O link de redefinição foi enviado ao usuário.'
      : 'Solicitação aprovada. Repasse o link abaixo ao usuário (o envio de e-mail não está configurado).',
    // O link só é devolvido quando o e-mail não pôde ser enviado.
    link: email.sent ? undefined : link,
    expiraEm: expiresAt,
  });
}

// POST /api/auth/password-requests/:id/reject
async function reject(req, res) {
  const pedido = await carregarParaDecisao(req);
  const motivo = String(req.body.reason || '').trim().slice(0, 300) || null;
  await model.reject(pedido.id, req.user.id, motivo);

  await mailer.sendTemplate('recuperacaoRecusada', pedido.user_email, {
    name: pedido.user_name,
    reason: motivo,
  }, pedido.tenant_id);

  res.json({ message: 'Solicitação recusada. O usuário foi avisado por e-mail.' });
}

// GET /api/auth/reset-password/:token  (público — valida o link)
async function checkToken(req, res) {
  const pedido = await model.findValidToken(hashToken(String(req.params.token || '')));
  if (!pedido) throw new AppError('Link inválido ou expirado. Solicite a recuperação novamente.', 400);
  res.json({ valid: true, nome: pedido.user_name, email: pedido.user_email });
}

// POST /api/auth/reset-password  (público — conclui a redefinição)
async function reset(req, res) {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (!isValidPassword(password)) {
    throw new AppError('A nova senha deve ter ao menos 8 caracteres, com letras e números.');
  }

  const pedido = await model.findValidToken(hashToken(token));
  if (!pedido) throw new AppError('Link inválido ou expirado. Solicite a recuperação novamente.', 400);

  await model.setPassword(pedido.user_id, await bcrypt.hash(password, SALT_ROUNDS));
  await model.consume(pedido.id);

  res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
}

module.exports = { forgot, list, approve, reject, checkToken, reset, STATUS_LABEL };
