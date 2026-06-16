const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware que valida o token JWT enviado em "Authorization: Bearer <token>"
function auth(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) {
        return res.status(401).json({ error: 'Token não enviado.' });
    }

    const parts = header.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'kuba_secret_2026');
        req.user = payload; // { tipo, nome, cpf? }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

module.exports = auth;
