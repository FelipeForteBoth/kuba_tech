// No seu arquivo de rotas (ex: backend/routes/authRoutes.js)
router.post('/register-client', async (req, res) => {
    const { nome, cpf, phone, email, login } = req.body;

    // Regra de negócio: 5 primeiros números + último número do CPF
    // Remove pontos e traços do CPF para não errar a conta dos caracteres
    const cleanCPF = cpf.replace(/\D/g, ''); 
    const senhaBase = cleanCPF.slice(0, 5) + cleanCPF.slice(-1);

    try {
        const bcrypt = require('bcryptjs');
        const senhaHash = await bcrypt.hash(senhaBase, 10);

        // 1. Inserir na tabela de clientes (dados de contato)
        const sqlCustomer = `INSERT INTO customers (cpf, nome, phone, email) VALUES (?, ?, ?, ?)`;
        
        db.query(sqlCustomer, [cpf, nome, phone, email], (err, result) => {
            if (err) return res.status(500).json({ error: 'Erro ao salvar cliente', details: err });

            // 2. Inserir na tabela de usuários (dados de acesso)
            const sqlUser = `INSERT INTO users (nome, cpf, login, senha, tipo) VALUES (?, ?, ?, ?, 'cliente')`;
            
            db.query(sqlUser, [nome, cpf, login, senhaHash], (errUser, resultUser) => {
                if (errUser) return res.status(500).json({ error: 'Erro ao criar usuário do cliente', details: errUser });

                // Retorna sucesso e mostra a senha gerada para o Admin passar pro cliente
                res.json({
                    message: 'Cliente e Usuário cadastrados com sucesso!',
                    senhaInicial: senhaBase
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});