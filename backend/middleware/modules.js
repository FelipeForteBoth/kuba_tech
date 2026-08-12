// ─────────────────────────────────────────────────────────────
// Controle de acesso por módulo contratado (plano da empresa).
// Um módulo só responde se estiver habilitado em tenant_modules.
// ─────────────────────────────────────────────────────────────
const db = require('../config/database');

async function tenantModuleCodes(tenantId) {
  if (!tenantId) return [];
  const rows = await db.all(
    `SELECT m.code FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
      WHERE tm.tenant_id = $1`,
    [tenantId],
  );
  return rows.map((row) => row.code);
}

async function tenantHasModule(tenantId, code) {
  const row = await db.one(
    `SELECT 1 AS ok FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
      WHERE tm.tenant_id = $1 AND m.code = $2`,
    [tenantId, code],
  );
  return Boolean(row);
}

/** Bloqueia a rota quando o módulo não faz parte do plano contratado. */
function requireModule(code) {
  return async (req, res, next) => {
    try {
      if (!req.tenantId) return res.status(403).json({ error: 'Operação exclusiva de empresas contratantes.' });
      if (!(await tenantHasModule(req.tenantId, code))) {
        return res.status(403).json({
          error: 'Este módulo não faz parte do plano contratado pela sua empresa.',
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireModule, tenantHasModule, tenantModuleCodes };
