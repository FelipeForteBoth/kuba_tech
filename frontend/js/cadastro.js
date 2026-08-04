// Auto-cadastro da empresa contratante (modelo SaaS).
async function cadastrarEmpresa() {
    const mensagem = document.getElementById('mensagem');
    const get = (id) => document.getElementById(id).value.trim();
  
    const payload = {
      companyName: get('companyName'),
      document: get('document'),
      companyEmail: get('companyEmail'),
      phone: get('phone'),
      adminName: get('adminName'),
      adminEmail: get('adminEmail'),
      password: document.getElementById('password').value,
    };
  
    if (!isNonEmptyText(payload.companyName, 3)) return fail('Informe a razão social (mínimo 3 caracteres).');
    if (!isValidCNPJ(payload.document)) return fail('CNPJ inválido. Informe os 14 números.');
    if (!isValidEmail(payload.companyEmail)) return fail('E-mail da empresa inválido.');
    if (payload.phone && !isValidPhone(payload.phone)) return fail('Telefone inválido. Use (00) 00000-0000.');
    if (!isValidName(payload.adminName)) return fail('Informe o nome completo do administrador.');
    if (!isValidEmail(payload.adminEmail)) return fail('E-mail do administrador inválido.');
    if (!isValidPassword(payload.password)) return fail('A senha deve ter ao menos 8 caracteres, com letras e números.');
  
    mensagem.style.color = 'blue';
    mensagem.innerText = 'Criando sua conta...';
  
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const dados = await res.json();
      if (!res.ok) return fail(dados.error || 'Não foi possível concluir o cadastro.');
  
      setSession(dados.token, dados.usuario);
      mensagem.style.color = 'green';
      mensagem.innerText = 'Empresa cadastrada! Redirecionando...';
      setTimeout(() => { window.location.href = homePageFor(dados.usuario.perfil); }, 600);
    } catch (err) {
      console.error(err);
      fail('Não foi possível conectar ao servidor.');
    }
  
    function fail(msg) {
      mensagem.style.color = 'red';
      mensagem.innerText = msg;
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    if (session) window.location.href = homePageFor(session.usuario.perfil);
  });
  