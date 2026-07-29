const { Pool } = require('pg');
require('dotenv').config();

// Supabase (Postgres) exige SSL. Usamos a connection string única
// fornecida pelo Supabase (Project Settings > Database > Connection string > URI).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

console.log('Banco configurado (PostgreSQL / Supabase)');

/**
 * Camada de compatibilidade: o projeto foi escrito para o mysql2
 * (placeholders "?" e retorno "[rows]"). Em vez de reescrever todas
 * as rotas para a sintaxe do pg ($1, $2 e {rows}), esta função traduz
 * a chamada automaticamente, para que o resto do código continue
 * funcionando sem alterações.
 */
async function query(sql, params = []) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await pool.query(pgSql, params);

    result.affectedRows = result.rowCount; // equivalente ao mysql2

    const isSelect = /^\s*select/i.test(sql);
    return [isSelect ? result.rows : result];
}

module.exports = { query };
