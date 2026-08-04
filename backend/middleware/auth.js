// ─────────────────────────────────────────────────────────────
// Autenticação: valida o token JWT enviado em
// "Authorization: Bearer <token>" e injeta o contexto do usuário
// (id, nome, papel e tenant) na requisição.
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'kuba_secret_2026';

async function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  if (!token) return res.status(401).json({ error: 'Token não enviado.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  try {
    // Revalida o usuário no banco: um usuário desativado ou de uma
    // empresa suspensa perde o acesso mesmo com token ainda válido.
    const user = await db.one(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.active,
              t.status AS tenant_status, t.company_name
         FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = $1`,
      [payload.sub],
    );

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou inexistente.' });
    }
    if (user.tenant_id && user.tenant_status !== 'active') {
      return res.status(403).json({ error: 'A assinatura da empresa está inativa.' });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.company_name,
    };
    next();
  } catch (error) {
    console.error('Erro ao autenticar:', error);
    res.status(500).json({ error: 'Erro ao validar a sessão.' });
  }
}

module.exports = { authenticate, JWT_SECRET };
