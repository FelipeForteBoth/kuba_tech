// ─────────────────────────────────────────────────────────────
// Camada de acesso ao banco (PostgreSQL / Supabase).
// Todas as consultas usam placeholders parametrizados ($1, $2...),
// prevenindo SQL Injection conforme os requisitos de segurança.
// ─────────────────────────────────────────────────────────────
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on('error', (err) => console.error('Erro inesperado no pool do Postgres:', err));

/** Executa uma consulta parametrizada e devolve todas as linhas. */
async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

/** Executa uma consulta parametrizada e devolve a primeira linha (ou null). */
async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

/** Executa INSERT/UPDATE/DELETE e devolve a quantidade de linhas afetadas. */
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rowCount;
}

/** Executa várias operações dentro de uma transação. */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, all, one, run, transaction };
