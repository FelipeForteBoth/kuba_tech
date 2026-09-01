// ─────────────────────────────────────────────────────────────
// Recuperação de senha — envio da solicitação para aprovação.
// A resposta é sempre genérica: o sistema não revela se um
// e-mail está ou não cadastrado.
// ─────────────────────────────────────────────────────────────

function setMensagem(texto, tipo = '') {
  const el = document.getElementById('mensagem');
  el.className = `au-msg ${tipo}`;
  el.textContent = texto;
}

async function solicitar() {
  const btn = document.getElementById('btn-enviar');
  const email = document.getElementById('email').value.trim();
  const reason = document.getElementById('motivo').value.trim();

  if (!isValidEmail(email)) return setMensagem('Informe um e-mail válido.', 'err');

  btn.disabled = true;
  setMensagem('Enviando solicitação...', 'info');

  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason }),
    });
    const dados = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return setMensagem(dados.error || 'Não foi possível enviar a solicitação.', 'err');
    }
    setMensagem(dados.message, 'ok');
    document.getElementById('form-recuperar').reset();
  } catch (err) {
    console.error('Erro na requisição:', err);
    setMensagem('Não foi possível conectar ao servidor. Tente novamente.', 'err');
  }
  btn.disabled = false;
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-recuperar').addEventListener('submit', (e) => {
    e.preventDefault();
    solicitar();
  });
});
