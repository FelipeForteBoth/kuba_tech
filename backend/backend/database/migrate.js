// ─────────────────────────────────────────────────────────────
// Linha de comando do schema único da Kuba Tech.
//   npm run migrate           → aplica database/schema.sql (idempotente)
//   npm run migrate:status    → informa se o schema atual já foi aplicado
//   npm run migrate -- force  → reaplica mesmo sem alterações
// O banco NUNCA deve ser alterado manualmente.
// ─────────────────────────────────────────────────────────────
require('dotenv').config();

const db = require('../config/database');
const runner = require('./runner');

const arg = process.argv[2];
const action = arg === 'status'
  ? () => runner.status()
  : () => runner.run(console.log, arg === 'force');

action()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('✖ Falha ao aplicar o schema:', err.message);
    db.pool.end().finally(() => process.exit(1));
  });
