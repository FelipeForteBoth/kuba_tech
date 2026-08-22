// ─────────────────────────────────────────────────────────────
// Sistema de migrações da Kuba Tech.
//
// Aplica, em ordem, todos os arquivos .sql de database/migrations
// que ainda não foram executados, registrando-os em schema_migrations.
// O banco NUNCA deve ser alterado manualmente.
//
// Uso:  npm run migrate            (aplica pendentes)
//       npm run migrate:status     (apenas lista)
// ─────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = require('../config/database');

const DIR = path.join(__dirname, 'migrations');

async function ensureTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

function files() {
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
}

async function applied() {
  const rows = await db.all('SELECT version FROM schema_migrations');
  return new Set(rows.map((r) => r.version));
}

async function status() {
  await ensureTable();
  const done = await applied();
  files().forEach((f) => console.log(`${done.has(f) ? '✔ aplicada ' : '• pendente '} ${f}`));
}

async function run() {
  await ensureTable();
  const done = await applied();
  const pending = files().filter((f) => !done.has(f));

  if (!pending.length) {
    console.log('✔ Banco já está atualizado. Nenhuma migração pendente.');
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    process.stdout.write(`→ aplicando ${file} ... `);
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
    console.log('ok');
  }
  console.log(`✔ ${pending.length} migração(ões) aplicada(s).`);
}

const action = process.argv[2] === 'status' ? status : run;
action()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('✖ Falha na migração:', err.message);
    db.pool.end().finally(() => process.exit(1));
  });
