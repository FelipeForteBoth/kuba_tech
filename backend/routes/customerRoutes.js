const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const auth    = require('../middleware/auth');
const admin   = require('../middleware/admin');
const { isValidCPF, isValidPhone, isValidEmail, isValidName, normalizeCPF, formatCPF, normalizePhone, formatPhone } = require('../utils/validators');

// Todas as rotas de clientes exigem login de administrador.
// (Clientes finais nunca acessam estas rotas: a tela de
// clientes já é restrita a admin no front-end, e aqui
// reforçamos a mesma regra no back-end para fechar a brecha
// de qualquer chamada direta à API sem autenticação.)
router.use(auth);
router.use(admin);

// Listar todos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers ORDER BY name');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar um
router.get('/:cpf', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers WHERE cpf = ?', [req.params.cpf]);
        if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar
router.post('/', async (req, res) => {
    const cpfInput   = String(req.body.cpf || '').trim();
    const name       = String(req.body.name || '').trim();
    const phoneInput = String(req.body.phone || '').trim();
    const email      = String(req.body.email || '').trim();

    if (!cpfInput || !name || !phoneInput || !email)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isValidName(name))
        return res.status(400).json({ error: 'Informe o nome completo (nome e sobrenome), apenas letras.' });
    if (!isValidCPF(cpfInput))
        return res.status(400).json({ error: 'CPF inválido. Informe os 11 números no formato 000.000.000-00.' });
    if (!isValidPhone(phoneInput))
        return res.status(400).json({ error: 'Telefone inválido. Use o formato (00) 00000-0000.' });
    if (!isValidEmail(email))
        return res.status(400).json({ error: 'E-mail inválido.' });

    // Normaliza para o formato canônico antes de gravar, independente
    // de como o dado chegou (com ou sem máscara).
    const cpf   = formatCPF(normalizeCPF(cpfInput));
    const phone = formatPhone(normalizePhone(phoneInput));

    try {
        await db.query('INSERT INTO customers (cpf, name, phone, email) VALUES (?, ?, ?, ?)', [cpf, name, phone, email]);
        res.status(201).json({ message: 'Cliente cadastrado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'CPF já cadastrado.' });
        res.status(500).json({ error: error.message });
    }
});

// Atualizar
router.put('/:cpf', async (req, res) => {
    const name       = String(req.body.name || '').trim();
    const phoneInput = String(req.body.phone || '').trim();
    const email      = String(req.body.email || '').trim();

    if (!name || !phoneInput || !email)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isValidName(name))
        return res.status(400).json({ error: 'Informe o nome completo (nome e sobrenome), apenas letras.' });
    if (!isValidPhone(phoneInput))
        return res.status(400).json({ error: 'Telefone inválido. Use o formato (00) 00000-0000.' });
    if (!isValidEmail(email))
        return res.status(400).json({ error: 'E-mail inválido.' });

    const phone = formatPhone(normalizePhone(phoneInput));

    try {
        const [result] = await db.query(
            'UPDATE customers SET name=?, phone=?, email=? WHERE cpf=?',
            [name, phone, email, req.params.cpf]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Cliente não encontrado.' });
        res.json({ message: 'Cliente atualizado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar (ON DELETE CASCADE cuida do resto)
router.delete('/:cpf', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM customers WHERE cpf=?', [req.params.cpf]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Cliente não encontrado.' });
        res.json({ message: 'Cliente deletado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
