// ─────────────────────────────────────────────────────────────
// Auto-cadastro da empresa contratante (modelo SaaS).
// Ao informar um CNPJ válido, os dados públicos da Receita são
// buscados e preenchidos automaticamente para revisão do usuário.
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

// ── Busca automática pelo CNPJ ──
let ultimoCNPJ = '';

async function buscarEmpresaPorCNPJ() {
  const input = document.getElementById('document');
  const cnpj = onlyDigits(input.value);

  if (cnpj.length !== 14) {
    fieldHint(input, cnpj.length ? 'Informe os 14 números do CNPJ.' : '', cnpj.length ? 'err' : '');
    return;
  }
  if (!isValidCNPJ(cnpj)) {
    ultimoCNPJ = '';
    fieldHint(input, 'CNPJ inválido (dígitos verificadores).', 'err');
    return;
  }
  if (cnpj === ultimoCNPJ) return;
  ultimoCNPJ = cnpj;

  fieldHint(input, 'Consultando dados da empresa na Receita...', 'loading');
  try {
    const r = await consultarCNPJPublico(cnpj);
    if (r.unavailable) {
      fieldHint(input, r.reason || 'Consulta indisponível. Preencha os dados manualmente.', 'err');
      return;
    }
    const d = r.data || {};
    preencherCampo(document.getElementById('companyName'), d.razaoSocial || d.nomeFantasia);
    if (d.email) preencherCampo(document.getElementById('companyEmail'), d.email);
    if (d.telefone) preencherCampo(document.getElementById('phone'), maskPhone(d.telefone));

    // Endereço público da Receita Federal.
    preencherCampo(document.getElementById('zipCode'), d.cep ? maskCEP(d.cep) : '');
    preencherCampo(
      document.getElementById('address'),
      [d.logradouro, d.numero].filter(Boolean).join(', '),
    );
    preencherCampo(document.getElementById('neighborhood'), d.bairro);
    preencherCampo(document.getElementById('city'), d.cidade);
    preencherCampo(document.getElementById('state'), d.estado);

    const extras = [d.nomeFantasia && `Nome fantasia: ${d.nomeFantasia}`,
      d.situacao && `Situação: ${d.situacao}`,
      d.cidade && `${d.cidade}${d.estado ? '/' + d.estado : ''}`].filter(Boolean).join(' · ');
    fieldHint(input, `Dados encontrados. Revise antes de continuar.${extras ? ' ' + extras : ''}`, 'ok');
  } catch (e) {
    ultimoCNPJ = '';
    fieldHint(input, e.message || 'Não foi possível consultar o CNPJ agora.', 'err');
  }
}

// ── Envio do cadastro ──
async function cadastrarEmpresa() {
  const btn = document.getElementById('btn-criar');
  if (btn.disabled) return;

  const get = (id) => document.getElementById(id).value.trim();
  const payload = {
    companyName: get('companyName'),
    document: get('document'),
    companyEmail: get('companyEmail'),
    phone: get('phone'),
    adminName: get('adminName'),
    adminEmail: get('adminEmail'),
    password: document.getElementById('password').value,
    zipCode: get('zipCode'),
    address: get('address'),
    neighborhood: get('neighborhood'),
    city: get('city'),
    state: get('state').toUpperCase(),
  };

  const fail = (msg) => setMensagem(msg, 'err');
  if (!isNonEmptyText(payload.companyName, 3)) return fail('Informe a razão social (mínimo 3 caracteres).');
  if (!isValidCNPJ(payload.document)) return fail('CNPJ inválido. Informe os 14 números.');
  if (!isValidEmail(payload.companyEmail)) return fail('E-mail da empresa inválido.');
  if (payload.phone && !isValidPhone(payload.phone)) return fail('Telefone inválido. Use (00) 00000-0000.');
  if (!isValidName(payload.adminName)) return fail('Informe o nome completo do administrador.');
  if (!isValidEmail(payload.adminEmail)) return fail('E-mail do administrador inválido.');
  if (!isValidPassword(payload.password)) return fail('A senha deve ter ao menos 8 caracteres, com letras e números.');

  btn.disabled = true;
  mostrarOverlay(true);
  setMensagem('Criando sua conta...', 'info');

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dados = await res.json();
    if (!res.ok) {
      mostrarOverlay(false);
      btn.disabled = false;
      return fail(dados.error || 'Não foi possível concluir o cadastro.');
    }

    setSession(dados.token, dados.usuario);
    setMensagem('Empresa cadastrada! Redirecionando...', 'ok');
    window.location.href = homePageFor(dados.usuario.perfil);
  } catch (err) {
    console.error(err);
    mostrarOverlay(false);
    btn.disabled = false;
    fail('Não foi possível conectar ao servidor.');
  }
  return undefined;
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session) {
    window.location.href = homePageFor(session.usuario.perfil);
    return;
  }

  const doc = document.getElementById('document');
  doc.addEventListener('blur', buscarEmpresaPorCNPJ);
  doc.addEventListener('input', () => {
    if (onlyDigits(doc.value).length === 14) buscarEmpresaPorCNPJ();
  });

  document.getElementById('form-cadastro').addEventListener('submit', (e) => {
    e.preventDefault();
    cadastrarEmpresa();
  });

  const eye = document.getElementById('btn-eye');
  const senha = document.getElementById('password');
  eye.addEventListener('click', () => {
    const visivel = senha.type === 'text';
    senha.type = visivel ? 'password' : 'text';
    eye.setAttribute('aria-pressed', visivel ? 'false' : 'true');
    eye.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
    eye.innerHTML = `<i class="fas fa-${visivel ? 'eye' : 'eye-slash'}" aria-hidden="true"></i>`;
    senha.focus();
  });
});
