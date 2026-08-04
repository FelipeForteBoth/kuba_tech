// Tela de login — autenticação por e-mail e senha (JWT + bcrypt no back-end).
async function fazerLogin() {
    const email = document.getElementById('login').value.trim();
    const senha = document.getElementById('senha').value;
    const mensagem = document.getElementById('mensagem');
  
    if (!email || !senha) {
      mensagem.style.color = 'red';
      mensagem.innerText = 'Preencha e-mail e senha.';
      return;
    }
  
    mensagem.style.color = 'blue';
    mensagem.innerText = 'Autenticando...';
  
    try {
      const resposta = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha }),
      });
      const dados = await resposta.json();
  
      if (!resposta.ok) {
        mensagem.style.color = 'red';
        mensagem.innerText = dados.error || 'Erro ao fazer login.';
        return;
      }
  
      setSession(dados.token, dados.usuario);
      mensagem.style.color = 'green';
      mensagem.innerText = 'Login realizado! Redirecionando...';
      setTimeout(() => {
        window.location.href = homePageFor(dados.usuario.perfil);
      }, 500);
    } catch (err) {
      console.error('Erro na requisição:', err);
      mensagem.style.color = 'red';
      mensagem.innerText = 'Não foi possível conectar ao servidor.';
    }
  }
  
  // Se já existe sessão válida, vai direto para a área do perfil.
  document.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    if (session) window.location.href = homePageFor(session.usuario.perfil);
  
    document.getElementById('senha').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  });
  