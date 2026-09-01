// ─────────────────────────────────────────────────────────────
// Conclusão da recuperação: valida o link de uso único e grava
// a nova senha escolhida pelo usuário.
// ─────────────────────────────────────────────────────────────

const TOKEN = new URLSearchParams(window.location.search).get('token') || '';

function setMensagem(texto, tipo = '') {
  const el = document.getElementById('mensagem');
  el.className = `au-msg ${tipo}`;
  el.textContent = texto;
}

function senhaValida(senha) {
  return senha.length >= 8 && /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha);
}

async function validarLink() {
  const sub = document.getElementById('au-sub');
  if (!TOKEN) {
    sub.textContent = 'Link inválido. Solicite a recuperação novamente.';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/auth/reset-password/${encodeURIComponent(TOKEN)}`);
    const dados = await res.json();
    if (!res.ok) {
      sub.textContent = dados.error || 'Link inválido ou expirado.';
      return;
    }
    sub.textContent = `Olá, ${dados.nome}. Escolha a sua nova senha de acesso.`;
    document.getElementById('form-senha').hidden = false;
  } catch {
    sub.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
  }
}

async function salvar() {
  const btn = document.getElementById('btn-salvar');
  const senha = document.getElementById('senha').value;
  const confirma = document.getElementById('confirma').value;

  if (!senhaValida(senha)) {
    return setMensagem('A senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
  }
  if (senha !== confirma) return setMensagem('As senhas não conferem.', 'err');

  btn.disabled = true;
  setMensagem('Salvando...', 'info');

  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, password: senha }),
    });
    const dados = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return setMensagem(dados.error || 'Não foi possível redefinir a senha.', 'err');
    }
    setMensagem(`${dados.message} Redirecionando...`, 'ok');
    setTimeout(() => { window.location.href = 'login.html'; }, 1800);
  } catch {
    btn.disabled = false;
    setMensagem('Não foi possível conectar ao servidor. Tente novamente.', 'err');
  }
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  validarLink();
  document.getElementById('form-senha').addEventListener('submit', (e) => {
    e.preventDefault();
    salvar();
  });
});
