// ─────────────────────────────────────────────────────────────
// Primeiro acesso: troca obrigatória da senha temporária.
// O usuário já entrou com a senha temporária, então ela NÃO é
// solicitada novamente: pedimos apenas a nova senha e a confirmação.
// Enquanto a troca não acontecer, o back-end responde 423 nas
// demais rotas.
// ─────────────────────────────────────────────────────────────

function setMensagem(texto, tipo = '') {
  const el = document.getElementById('mensagem');
  el.className = `au-msg ${tipo}`;
  el.textContent = texto;
}

function senhaValida(senha) {
  return senha.length >= 8 && /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha);
}

async function salvar() {
  const btn = document.getElementById('btn-salvar');
  const nova = document.getElementById('nova').value;
  const confirma = document.getElementById('confirma').value;

  if (!senhaValida(nova)) {
    return setMensagem('A nova senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
  }
  if (nova !== confirma) return setMensagem('As senhas não conferem.', 'err');

  btn.disabled = true;
  setMensagem('Salvando...', 'info');

  try {
    const res = await fetch(`${API_URL}/auth/password`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ newPassword: nova }),
    });
    const dados = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return setMensagem(dados.error || 'Não foi possível trocar a senha.', 'err');
    }

    // Atualiza a sessão local: o usuário deixa de estar em primeiro acesso.
    const sessao = getSession();
    const perfil = dados.usuario ? dados.usuario.perfil : (sessao && sessao.usuario.perfil) || 'company_admin';
    if (dados.token && dados.usuario) {
      setSession(dados.token, dados.usuario);
    } else if (sessao) {
      setSession(sessao.token, { ...sessao.usuario, trocarSenha: false });
    }

    setMensagem('Senha atualizada! Redirecionando para o seu painel...', 'ok');
    setTimeout(() => {
      window.location.href = homePageFor(perfil);
    }, 1200);
  } catch {
    btn.disabled = false;
    setMensagem('Não foi possível conectar ao servidor. Tente novamente.', 'err');
  }
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('btn-sair').addEventListener('click', () => logout());
  document.getElementById('form-troca').addEventListener('submit', (e) => {
    e.preventDefault();
    salvar();
  });
});
