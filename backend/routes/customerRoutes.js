const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

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
    const { cpf, name, phone, email } = req.body;
    if (!cpf || !name || !phone || !email)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
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
    const { name, phone, email } = req.body;
    if (!name || !phone || !email)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
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
