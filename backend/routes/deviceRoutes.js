const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const auth    = require('../middleware/auth');
const admin   = require('../middleware/admin');
const { isValidCPF, isValidSerial, isNonEmptyText, normalizeCPF, formatCPF } = require('../utils/validators');

// Todas as rotas de dispositivos exigem login de administrador
// (mesma regra já aplicada na tela de dispositivos do front-end).
router.use(auth);
router.use(admin);

// Listar todos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM devices ORDER BY serial_number');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar um
router.get('/:serial', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM devices WHERE serial_number = ?', [req.params.serial]);
        if (!rows.length) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar
router.post('/', async (req, res) => {
    const serial_number   = String(req.body.serial_number || '').trim();
    const customerCpfInput = String(req.body.customer_cpf || '').trim();
    const type             = String(req.body.type || '').trim();

    if (!serial_number || !customerCpfInput || !type)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isValidSerial(serial_number))
        return res.status(400).json({ error: 'Serial/IMEI inválido. Use ao menos 4 caracteres (letras, números, "-" ou "/").' });
    if (!isValidCPF(customerCpfInput))
        return res.status(400).json({ error: 'CPF do cliente inválido. Informe os 11 números no formato 000.000.000-00.' });
    if (!isNonEmptyText(type))
        return res.status(400).json({ error: 'Informe o tipo de aparelho (ao menos 2 caracteres).' });

    const customer_cpf = formatCPF(normalizeCPF(customerCpfInput));

    try {
        // Verifica se o cliente existe
        const [cliente] = await db.query('SELECT cpf FROM customers WHERE cpf = ?', [customer_cpf]);
        if (!cliente.length)
            return res.status(400).json({ error: 'Cliente com este CPF não encontrado.' });

        await db.query(
            'INSERT INTO devices (serial_number, customer_cpf, type) VALUES (?, ?, ?)',
            [serial_number, customer_cpf, type]
        );
        res.status(201).json({ message: 'Dispositivo cadastrado!' });
    } catch (error) {
        if (error.code === '23505') // violação de chave única no Postgres
            return res.status(409).json({ error: 'Serial já cadastrado.' });
        res.status(500).json({ error: error.message });
    }
});

// Atualizar
router.put('/:serial', async (req, res) => {
    const customerCpfInput = String(req.body.customer_cpf || '').trim();
    const type              = String(req.body.type || '').trim();

    if (!customerCpfInput || !type)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isValidCPF(customerCpfInput))
        return res.status(400).json({ error: 'CPF do cliente inválido. Informe os 11 números no formato 000.000.000-00.' });
    if (!isNonEmptyText(type))
        return res.status(400).json({ error: 'Informe o tipo de aparelho (ao menos 2 caracteres).' });

    const customer_cpf = formatCPF(normalizeCPF(customerCpfInput));

    try {
        const [cliente] = await db.query('SELECT cpf FROM customers WHERE cpf = ?', [customer_cpf]);
        if (!cliente.length)
            return res.status(400).json({ error: 'Cliente com este CPF não encontrado.' });

        const [result] = await db.query(
            'UPDATE devices SET customer_cpf=?, type=? WHERE serial_number=?',
            [customer_cpf, type, req.params.serial]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Dispositivo não encontrado.' });
        res.json({ message: 'Dispositivo atualizado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar
router.delete('/:serial', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM devices WHERE serial_number=?', [req.params.serial]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Dispositivo não encontrado.' });
        res.json({ message: 'Dispositivo deletado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
