// ─────────────────────────────────────────────────────────────
// Primeiro acesso: troca obrigatória da senha temporária.
// Enquanto a troca não acontecer, o back-end responde 423 em
// todas as demais rotas.
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
  const atual = document.getElementById('atual').value;
  const nova = document.getElementById('nova').value;
  const confirma = document.getElementById('confirma').value;

  if (!atual) return setMensagem('Informe a senha temporária recebida.', 'err');
  if (!senhaValida(nova)) {
    return setMensagem('A nova senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
  }
  if (nova === atual) return setMensagem('A nova senha deve ser diferente da temporária.', 'err');
  if (nova !== confirma) return setMensagem('As senhas não conferem.', 'err');

  btn.disabled = true;
  setMensagem('Salvando...', 'info');

  try {
    const res = await fetch(`${API_URL}/auth/password`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword: atual, newPassword: nova }),
    });
    const dados = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return setMensagem(dados.error || 'Não foi possível trocar a senha.', 'err');
    }

    // Atualiza a sessão local: o usuário deixa de estar em primeiro acesso.
    const sessao = getSession();
    if (sessao) setSession(sessao.token, { ...sessao.usuario, trocarSenha: false });

    setMensagem('Senha atualizada! Redirecionando para o seu painel...', 'ok');
    setTimeout(() => {
      window.location.href = homePageFor(sessao ? sessao.usuario.perfil : 'company_admin');
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
