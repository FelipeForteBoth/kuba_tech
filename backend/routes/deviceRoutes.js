const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

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
    const { serial_number, customer_cpf, type } = req.body;
    if (!serial_number || !customer_cpf || !type)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });

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
        if (error.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Serial já cadastrado.' });
        res.status(500).json({ error: error.message });
    }
});

// Atualizar
router.put('/:serial', async (req, res) => {
    const { customer_cpf, type } = req.body;
    if (!customer_cpf || !type)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    try {
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
