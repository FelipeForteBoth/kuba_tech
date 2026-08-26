// ─────────────────────────────────────────────────────────────
// Linha de comando das migrações.
//   npm run migrate            (aplica pendentes)
//   npm run migrate:status     (apenas lista)
// O banco NUNCA deve ser alterado manualmente.
// ─────────────────────────────────────────────────────────────
require('dotenv').config();

const db = require('../config/database');
const runner = require('./runner');

const action = process.argv[2] === 'status' ? runner.status : runner.run;

action()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('✖ Falha na migração:', err.message);
    db.pool.end().finally(() => process.exit(1));
  });
