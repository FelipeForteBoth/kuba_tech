// ─────────────────────────────────────────────────────────────
// Tela de login — autenticação por e-mail e senha (JWT + bcrypt).
// Inclui alternância de visibilidade da senha e overlay de estado.
// ─────────────────────────────────────────────────────────────

function setMensagem(texto, tipo = '') {
  const el = document.getElementById('mensagem');
  el.className = `au-msg ${tipo}`;
  el.textContent = texto;
}

function mostrarOverlay(ativo) {
  const ov = document.getElementById('overlay-auth');
  ov.classList.toggle('on', ativo);
  ov.setAttribute('aria-hidden', ativo ? 'false' : 'true');
}

async function fazerLogin() {
  const btn = document.getElementById('btn-entrar');
  if (btn.disabled) return; // evita múltiplos cliques

  const email = document.getElementById('login').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) return setMensagem('Preencha e-mail e senha.', 'err');
  if (!isValidEmail(email)) return setMensagem('Informe um e-mail válido.', 'err');

  btn.disabled = true;
  mostrarOverlay(true);
  setMensagem('Autenticando...', 'info');

  try {
    const resposta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarOverlay(false);
      btn.disabled = false;
      return setMensagem(dados.error || 'E-mail ou senha incorretos.', 'err');
    }

    setSession(dados.token, dados.usuario);

    // Primeiro acesso com senha temporária: troca obrigatória.
    if (dados.usuario.trocarSenha) {
      setMensagem('Primeiro acesso: cadastre uma nova senha.', 'ok');
      window.location.href = 'trocar-senha.html';
      return undefined;
    }

    setMensagem('Login realizado! Redirecionando...', 'ok');
    window.location.href = homePageFor(dados.usuario.perfil);
  } catch (err) {
    console.error('Erro na requisição:', err);
    mostrarOverlay(false);
    btn.disabled = false;
    setMensagem('Não foi possível conectar ao servidor. Tente novamente.', 'err');
  }
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  // Sessão ativa: vai direto para a área do perfil.
  const session = getSession();
  if (session) {
    window.location.href = session.usuario.trocarSenha
      ? 'trocar-senha.html'
      : homePageFor(session.usuario.perfil);
    return;
  }

  // Aviso de sessão encerrada por inatividade (10 minutos).
  if (new URLSearchParams(window.location.search).get('motivo') === 'inatividade') {
    setMensagem('Sua sessão foi encerrada por inatividade. Entre novamente.', 'err');
  }

  document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    fazerLogin();
  });

  // Ícone de "olho": mostra ou oculta a senha digitada.
  const eye = document.getElementById('btn-eye');
  const senha = document.getElementById('senha');
  eye.addEventListener('click', () => {
    const visivel = senha.type === 'text';
    senha.type = visivel ? 'password' : 'text';
    eye.setAttribute('aria-pressed', visivel ? 'false' : 'true');
    eye.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
    eye.title = visivel ? 'Mostrar senha' : 'Ocultar senha';
    eye.innerHTML = `<i class="fas fa-${visivel ? 'eye' : 'eye-slash'}" aria-hidden="true"></i>`;
    senha.focus();
  });
});
