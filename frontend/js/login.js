async function fazerLogin() {
    const loginInput = document.getElementById('login').value.trim();
    const senhaInput = document.getElementById('senha').value;
    const mensagem   = document.getElementById('mensagem');

    mensagem.style.color = 'blue';
    mensagem.innerText   = 'Autenticando...';

    if (!loginInput || !senhaInput) {
        mensagem.style.color = 'red';
        mensagem.innerText   = 'Preencha todos os campos!';
        return;
    }

    try {
        const resposta = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginInput, senha: senhaInput })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagem.style.color = 'red';
            mensagem.innerText   = dados.error || 'Erro ao fazer login.';
            return;
        }

        localStorage.setItem('token',       dados.token);
        localStorage.setItem('tipoUsuario', dados.tipo);
        localStorage.setItem('nomeUsuario', dados.nome);
        if (dados.cpf) localStorage.setItem('cpfUsuario', dados.cpf);

        mensagem.style.color = 'green';
        mensagem.innerText   = 'Login realizado! Redirecionando...';

        setTimeout(() => {
            if (dados.tipo === 'admin') {
                window.location.href = '/html/index.html';
            } else {
                // Cliente vai direto pra lista das próprias O.S.
                window.location.href = '/html/os.html';
            }
        }, 600);
    } catch (err) {
        console.error('Erro na requisição:', err);
        mensagem.style.color = 'red';
        mensagem.innerText   = 'Não foi possível conectar ao servidor.';
    }
}
