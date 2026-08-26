// ─────────────────────────────────────────────────────────────
// Executor das migrações da Kuba Tech.
// Usado tanto pela linha de comando (npm run migrate) quanto pela
// API, que aplica as migrações pendentes automaticamente ao subir
// (evita que o banco de produção fique defasado após um deploy).
// ─────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const db = require('../config/database');

const DIR = path.join(__dirname, 'migrations');

async function ensureTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

const files = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

async function applied() {
  const rows = await db.all('SELECT version FROM schema_migrations', []);
  return new Set(rows.map((r) => r.version));
}

async function status(log = console.log) {
  await ensureTable();
  const done = await applied();
  files().forEach((f) => log(`${done.has(f) ? '✔ aplicada ' : '• pendente '} ${f}`));
}

async function run(log = console.log) {
  await ensureTable();
  const done = await applied();
  const pending = files().filter((f) => !done.has(f));

  if (!pending.length) {
    log('✔ Banco já está atualizado. Nenhuma migração pendente.');
    return 0;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    log(`→ aplicando ${file} ...`);
    // eslint-disable-next-line no-await-in-loop
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
  }
  log(`✔ ${pending.length} migração(ões) aplicada(s).`);
  return pending.length;
}

/** Execução no boot da API: nunca derruba o servidor em caso de falha. */
async function runOnBoot() {
  try {
    await run((msg) => console.log(`[migração] ${msg}`));
  } catch (err) {
    console.error('[migração] falha ao atualizar o banco:', err.message);
  }
}

module.exports = { run, status, runOnBoot };
