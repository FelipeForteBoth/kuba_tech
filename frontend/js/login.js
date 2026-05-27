async function fazerLogin() {
    // 1. Pegar os dados digitados nos inputs do HTML
    const loginInput = document.getElementById('login').value;
    const senhaInput = document.getElementById('senha').value;
    const mensagemErro = document.getElementById('mensagem');

    // Limpa mensagens anteriores e avisa que está carregando
    mensagemErro.innerText = "";
    mensagemErro.style.color = "blue";
    mensagemErro.innerText = "Autenticando...";

    // Validação simples para não enviar campos vazios
    if (!loginInput || !senhaInput) {
        mensagemErro.style.color = "red";
        mensagemErro.innerText = "Preencha todos os campos!";
        return;
    }

    try {
        // 2. Fazer a requisição para a rota de login do seu backend
        const resposta = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login: loginInput,
                senha: senhaInput
            })
        });

        const dados = await resposta.json();

        // 3. Se o login falhar...
        if (!resposta.ok) {
            mensagemErro.style.color = "red";
            mensagemErro.innerText = dados.error || "Erro ao fazer login.";
            return;
        }

        // 4. Se der certo, salva o Token, o Tipo e o Nome no navegador
        localStorage.setItem('token', dados.token);
        localStorage.setItem('tipoUsuario', dados.tipo); // 'admin' ou 'cliente'
        localStorage.setItem('nomeUsuario', dados.nome);

        mensagemErro.style.color = "green";
        mensagemErro.innerText = "Login realizado com sucesso! Redirecionando...";

        // 5. Redireciona dependendo de QUEM logou
        setTimeout(() => {
            if (dados.tipo === 'admin') {
                // Mude aqui para o nome real da sua página de painel do Administrador
                window.location.href = '../html/dashboard.html'; 
            } else {
                // Mude aqui para a página onde o cliente vê as ordens de serviço dele
                window.location.href = '../html/painel-cliente.html'; 
            }
        }, 1500);

    } catch (error) {
        console.error("Erro na requisição:", error);
        mensagemErro.style.color = "red";
        mensagemErro.innerText = "Não foi possível conectar ao servidor.";
    }
}