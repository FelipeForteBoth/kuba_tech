const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../config/database');
require('dotenv').config();

// Credenciais fixas do administrador
const ADMIN_LOGIN = 'admin';
const ADMIN_SENHA = 'admin';

// Helper: deixa só os dígitos do CPF
function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
}

// Regra de negócio: senha do cliente = 5 primeiros dígitos do CPF + último dígito
function senhaDoCliente(cpfDigits) {
    if (cpfDigits.length < 6) return null;
    return cpfDigits.slice(0, 5) + cpfDigits.slice(-1);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { login, senha } = req.body || {};

        if (!login || !senha) {
            return res.status(400).json({ error: 'Informe login e senha.' });
        }

        // 1) Admin (login/senha fixos)
        if (login === ADMIN_LOGIN && senha === ADMIN_SENHA) {
            const token = jwt.sign(
                { tipo: 'admin', nome: 'Administrador' },
                process.env.JWT_SECRET || 'kuba_secret_2026',
                { expiresIn: '1d' }
            );
            return res.json({ token, tipo: 'admin', nome: 'Administrador' });
        }

        // 2) Cliente: login = CPF (só dígitos), senha = cpf[0..5] + cpf[-1]
        const cpfDigits = onlyDigits(login);
        if (cpfDigits.length !== 11) {
            return res.status(401).json({ error: 'Login ou senha inválidos.' });
        }

        // Procura o cliente comparando só os dígitos do CPF gravado
        const [rows] = await db.query(
            `SELECT cpf, name FROM customers
              WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?`,
            [cpfDigits]
        );

        if (!rows.length) {
            return res.status(401).json({ error: 'Login ou senha inválidos.' });
        }

        const cliente = rows[0];
        const senhaEsperada = senhaDoCliente(cpfDigits);

        if (senha !== senhaEsperada) {
            return res.status(401).json({ error: 'Login ou senha inválidos.' });
        }

        const token = jwt.sign(
            { tipo: 'cliente', cpf: cliente.cpf, nome: cliente.name },
            process.env.JWT_SECRET || 'kuba_secret_2026',
            { expiresIn: '1d' }
        );

        return res.json({
            token,
            tipo: 'cliente',
            nome: cliente.name,
            cpf:  cliente.cpf
        });
    } catch (err) {
        console.error('Erro no login:', err);
        return res.status(500).json({ error: 'Erro no servidor.' });
    }
});

module.exports = router;
