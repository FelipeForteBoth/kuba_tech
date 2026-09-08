// Primeiro acesso: troca obrigatória da senha temporária.
// No primeiro acesso, o usuário já foi autenticado pela senha temporária
// e informa somente a nova senha.

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
  const sessaoAtual = getSession();
  const primeiroAcesso = Boolean(sessaoAtual && sessaoAtual.usuario && sessaoAtual.usuario.trocarSenha);

  if (!senhaValida(nova)) {
    return setMensagem('A nova senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
  }
  if (!primeiroAcesso && !atual) return setMensagem('Informe a senha atual.', 'err');
  if (!primeiroAcesso && nova === atual) return setMensagem('A nova senha deve ser diferente da senha atual.', 'err');
  if (nova !== confirma) return setMensagem('As senhas não conferem.', 'err');

  btn.disabled = true;
  setMensagem('Salvando...', 'info');

  try {
    const body = { newPassword: nova };
    if (!primeiroAcesso) body.currentPassword = atual;

    const res = await fetch(`${API_URL}/auth/password`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const dados = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return setMensagem(dados.error || 'Não foi possível trocar a senha.', 'err');
    }

    if (sessaoAtual) setSession(sessaoAtual.token, { ...sessaoAtual.usuario, trocarSenha: false });
    setMensagem('Senha atualizada! Redirecionando para o seu painel...', 'ok');
    setTimeout(() => {
      window.location.href = homePageFor(sessaoAtual ? sessaoAtual.usuario.perfil : 'company_admin');
    }, 1200);
  } catch {
    btn.disabled = false;
    setMensagem('Não foi possível conectar ao servidor. Tente novamente.', 'err');
  }
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  const sessao = getSession();
  if (!sessao) {
    window.location.href = 'login.html';
    return;
  }

  const primeiroAcesso = Boolean(sessao.usuario && sessao.usuario.trocarSenha);
  const campoAtual = document.getElementById('campo-senha-atual');
  if (campoAtual) campoAtual.hidden = primeiroAcesso;

  document.getElementById('btn-sair').addEventListener('click', () => logout());
  document.getElementById('form-troca').addEventListener('submit', (e) => {
    e.preventDefault();
    salvar();
  });
});
