const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const auth    = require('../middleware/auth');
const { isValidCPF, isValidSerial, isNonEmptyText, isValidPastOrTodayDate, normalizeCPF, formatCPF } = require('../utils/validators');

// Helper: deixa só dígitos
function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
}

// Todas as rotas de O.S. exigem login
router.use(auth);

// Bloqueia escrita para clientes
function adminOnly(req, res, next) {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Apenas o administrador pode executar esta ação.' });
    }
    next();
}

// Listar
// - admin  -> vê todas
// - cliente-> vê apenas as suas (comparando o CPF do token com customer_cpf)
router.get('/', async (req, res) => {
    try {
        let rows;
        if (req.user.tipo === 'cliente') {
            const cpfDigits = onlyDigits(req.user.cpf);
            [rows] = await db.query(
                `SELECT * FROM service_orders
                  WHERE REPLACE(REPLACE(customer_cpf, '.', ''), '-', '') = ?
                  ORDER BY id DESC`,
                [cpfDigits]
            );
        } else {
            [rows] = await db.query('SELECT * FROM service_orders ORDER BY id DESC');
        }
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar uma (cliente só pode ver a própria)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM service_orders WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'O.S. não encontrada.' });

        const os = rows[0];
        if (req.user.tipo === 'cliente') {
            if (onlyDigits(os.customer_cpf) !== onlyDigits(req.user.cpf)) {
                return res.status(403).json({ error: 'Acesso negado.' });
            }
        }
        res.json(os);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar (apenas admin)
router.post('/', adminOnly, async (req, res) => {
    const customer_cpf        = String(req.body.customer_cpf || '').trim();
    const device_serial       = String(req.body.device_serial || '').trim();
    const technician           = String(req.body.technician || '').trim();
    const opening_date         = String(req.body.opening_date || '').trim();
    const problem_description = String(req.body.problem_description || '').trim();
    const status               = req.body.status;

    if (!customer_cpf || !device_serial || !technician || !opening_date || !problem_description)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isValidCPF(customer_cpf))
        return res.status(400).json({ error: 'CPF do cliente inválido. Use o formato 000.000.000-00.' });
    if (!isValidSerial(device_serial))
        return res.status(400).json({ error: 'Serial do dispositivo inválido.' });
    if (!isNonEmptyText(technician, 3))
        return res.status(400).json({ error: 'Informe o nome do técnico responsável (ao menos 3 caracteres).' });
    if (!isValidPastOrTodayDate(opening_date))
        return res.status(400).json({ error: 'Data de abertura inválida. Não pode ser uma data futura.' });
    if (!isNonEmptyText(problem_description, 10))
        return res.status(400).json({ error: 'Descreva o problema com pelo menos 10 caracteres.' });

    const normalizedCpf = formatCPF(normalizeCPF(customer_cpf));

    try {
        const [cliente] = await db.query('SELECT cpf FROM customers WHERE cpf = ?', [normalizedCpf]);
        if (!cliente.length)
            return res.status(400).json({ error: 'Cliente com este CPF não encontrado.' });

        const [dispositivo] = await db.query('SELECT serial_number FROM devices WHERE serial_number = ?', [device_serial]);
        if (!dispositivo.length)
            return res.status(400).json({ error: 'Dispositivo com este serial não encontrado.' });

        await db.query(
            'INSERT INTO service_orders (customer_cpf, device_serial, technician, opening_date, problem_description, status) VALUES (?, ?, ?, ?, ?, ?)',
            [normalizedCpf, device_serial, technician, opening_date, problem_description, status || 'A Realizar']
        );
        res.status(201).json({ message: 'O.S. criada!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar (apenas admin)
router.put('/:id', adminOnly, async (req, res) => {
    const technician           = String(req.body.technician || '').trim();
    const opening_date         = String(req.body.opening_date || '').trim();
    const status                = req.body.status;
    const problem_description = String(req.body.problem_description || '').trim();

    const VALID_STATUS = ['A Realizar', 'Em Andamento', 'Finalizada'];

    if (!technician || !opening_date || !status || !problem_description)
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    if (!isNonEmptyText(technician, 3))
        return res.status(400).json({ error: 'Informe o nome do técnico responsável (ao menos 3 caracteres).' });
    if (!isValidPastOrTodayDate(opening_date))
        return res.status(400).json({ error: 'Data de abertura inválida. Não pode ser uma data futura.' });
    if (!VALID_STATUS.includes(status))
        return res.status(400).json({ error: 'Status inválido.' });
    if (!isNonEmptyText(problem_description, 10))
        return res.status(400).json({ error: 'Descreva o problema com pelo menos 10 caracteres.' });

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

// Deletar (apenas admin)
router.delete('/:id', adminOnly, async (req, res) => {
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
