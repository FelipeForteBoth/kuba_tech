// ─────────────────────────────────────────────────────────────
// Aplicação do schema único da Kuba Tech.
//
// Todas as migrações antigas foram consolidadas em database/schema.sql,
// que é idempotente. Este executor aplica o arquivo quando o seu
// conteúdo muda (controle por hash), tanto pela linha de comando
// (npm run migrate) quanto automaticamente no boot da API.
// ─────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../config/database');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

const readSchema = () => fs.readFileSync(SCHEMA_FILE, 'utf8');
const hashOf = (sql) => crypto.createHash('sha256').update(sql).digest('hex').slice(0, 32);

async function ensureTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

async function isApplied(version) {
  const row = await db.one('SELECT version FROM schema_migrations WHERE version = $1', [version]);
  return Boolean(row);
}

async function status(log = console.log) {
  await ensureTable();
  const version = `schema:${hashOf(readSchema())}`;
  log(`${(await isApplied(version)) ? '✔ aplicado' : '• pendente'}  ${version}`);
}

/**
 * Aplica o schema. Use force = true para reaplicar mesmo sem mudanças
 * (o arquivo é idempotente, nada é perdido).
 */
async function run(log = console.log, force = false) {
  await ensureTable();
  const sql = readSchema();
  const version = `schema:${hashOf(sql)}`;

  if (!force && (await isApplied(version))) {
    log('✔ Banco já está atualizado (schema.sql sem alterações).');
    return 0;
  }

  log('→ aplicando database/schema.sql ...');
  await db.transaction(async (client) => {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [version],
    );
  });
  log('✔ Schema aplicado com sucesso.');
  return 1;
}

/** Execução no boot da API: nunca derruba o servidor em caso de falha. */
async function runOnBoot() {
  try {
    await run((msg) => console.log(`[schema] ${msg}`));
  } catch (err) {
    console.error('[schema] falha ao atualizar o banco:', err.message);
  }
}

module.exports = { run, status, runOnBoot };
