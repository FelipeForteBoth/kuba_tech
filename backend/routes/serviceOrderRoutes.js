const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

// Listar todas
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM service_orders ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar uma
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM service_orders WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'O.S. não encontrada.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar
router.post('/', async (req, res) => {
    const { customer_cpf, device_serial, technician, opening_date, problem_description, status } = req.body;
    if (!customer_cpf || !device_serial || !technician || !opening_date || !problem_description)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    try {
        await db.query(
            'INSERT INTO service_orders (customer_cpf, device_serial, technician, opening_date, problem_description, status) VALUES (?, ?, ?, ?, ?, ?)',
            [customer_cpf, device_serial, technician, opening_date, problem_description, status || 'A Realizar']
        );
        res.status(201).json({ message: 'O.S. criada!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar (inclui opening_date e todos os campos editáveis)
router.put('/:id', async (req, res) => {
    const { technician, opening_date, status, problem_description } = req.body;
    if (!technician || !opening_date || !status || !problem_description)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    try {
        const [result] = await db.query(
            'UPDATE service_orders SET technician=?, opening_date=?, status=?, problem_description=? WHERE id=?',
            [technician, opening_date, status, problem_description, req.params.id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'O.S. não encontrada.' });
        res.json({ message: 'O.S. atualizada!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM service_orders WHERE id=?', [req.params.id]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'O.S. não encontrada.' });
        res.json({ message: 'O.S. deletada!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
