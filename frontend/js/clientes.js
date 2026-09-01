// Tela de Clientes — Pessoa Física (CPF) e Pessoa Jurídica (CNPJ).
let customers = [];
let sortDir = 1;
let editingId = null;

const doc = (c) => c.document_number || c.cpf || '—';
const tipoDoc = (c) => (c.document_type || 'CPF');

async function fetchClientes() {
  try {
    const res = await authFetch(`${API_URL}/customers?t=${Date.now()}`);
    if (!res.ok) return;
    customers = await res.json();
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${customers.length} cliente${customers.length !== 1 ? 's' : ''} cadastrado${customers.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os clientes.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty"><i class="fas fa-users"></i>
      <p>Nenhum cliente cadastrado ainda.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((c) => `
    <tr onclick="viewCliente('${c.id}')">
      <td><strong>${esc(c.name)}</strong>
        ${c.company_name ? `<br><span class="stat-lbl">${esc(c.company_name)}</span>` : ''}</td>
      <td class="td2 mono"><span class="badge badge-todo">${esc(tipoDoc(c))}</span> ${esc(doc(c))}</td>
      <td class="td2">${esc(c.phone)}</td>
      <td class="td2">${esc(c.email)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const data = customers.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    (c.company_name || '').toLowerCase().includes(q) ||
    String(doc(c)).includes(q) ||
    (c.phone || '').includes(q) ||
    (c.email || '').toLowerCase().includes(q));
  data.sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
  render(data);
}

function viewCliente(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  editingId = null;

  const endereco = [c.address, c.neighborhood, c.city, c.state, c.zip_code].filter(Boolean).join(', ');

  document.getElementById('drawer-title').textContent = c.name;
  document.getElementById('drawer-mode').textContent =
    tipoDoc(c) === 'CNPJ' ? 'Cliente Pessoa Jurídica' : 'Cliente Pessoa Física';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-id-card"></i> Identificação</div>
    <div class="d-field"><div class="d-lbl">${tipoDoc(c) === 'CNPJ' ? 'Contato / Nome fantasia' : 'Nome completo'}</div>
      <div class="d-val">${esc(c.name)}</div></div>
    ${c.company_name ? `<div class="d-field"><div class="d-lbl">Razão social</div><div class="d-val">${esc(c.company_name)}</div></div>` : ''}
    <div class="d-field"><div class="d-lbl">${esc(tipoDoc(c))}</div><div class="d-val mono">${esc(doc(c))}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-address-book"></i> Contato</div>
    <div class="d-field"><div class="d-lbl">Telefone</div><div class="d-val">${esc(c.phone)}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${esc(c.email)}</div></div>
    ${endereco ? `<div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-location-dot"></i> Endereço</div>
    <div class="d-field"><div class="d-lbl">Endereço</div><div class="d-val">${esc(endereco)}</div></div>` : ''}`;

  const acoes = [];
  if (canDelete()) acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteCliente('${c.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  if (can('customers')) acoes.push(`<button class="btn btn-ghost btn-sm" onclick="editCliente('${c.id}')"><i class="fas fa-edit"></i> Editar</button>`);
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();
}

function newCliente() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Novo Cliente';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = formHTML(null);
  bindDocumento();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editCliente(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = 'Editar Cliente';
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = formHTML(c);
  bindDocumento();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewCliente('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveCliente()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function formHTML(c) {
  const tipo = c ? tipoDoc(c) : 'CPF';
  const pj = tipo === 'CNPJ';
  return `
    <div class="d-section"><i class="fas fa-id-card"></i> Tipo do documento</div>
    <div class="fg">
      <div class="radio-row">
        <label class="radio-opt"><input type="radio" name="tipo-doc" value="CPF" ${pj ? '' : 'checked'} ${c ? 'disabled' : ''}> Pessoa Física (CPF)</label>
        <label class="radio-opt"><input type="radio" name="tipo-doc" value="CNPJ" ${pj ? 'checked' : ''} ${c ? 'disabled' : ''}> Pessoa Jurídica (CNPJ)</label>
      </div>
    </div>
    <div class="fg"><label id="lbl-doc">${pj ? 'CNPJ *' : 'CPF *'}</label>
      <div class="inline-row">
        <input type="text" class="fc" id="f-doc" data-mask="${pj ? 'cnpj' : 'cpf'}" maxlength="${pj ? 18 : 14}"
          value="${esc(c ? doc(c) : '')}" ${c ? 'disabled' : ''}
          placeholder="${pj ? '00.000.000/0000-00' : '000.000.000-00'}">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-consulta" ${c ? 'disabled' : ''}>
          <i class="fas fa-magnifying-glass"></i> Consultar</button>
      </div>
      <span class="stat-lbl" id="doc-hint">${pj ? 'A razão social e o endereço são preenchidos automaticamente pela Receita Federal.' : 'O nome do titular é preenchido automaticamente pela consulta do CPF.'}</span></div>

    <div class="fg" id="fg-razao" style="${pj ? '' : 'display:none;'}">
      <label for="f-razao">Razão social *</label>
      <input type="text" class="fc" id="f-razao" value="${esc(c ? (c.company_name || '') : '')}" placeholder="Razão social da empresa"></div>

    <div class="fg" id="fg-fantasia" style="${pj ? '' : 'display:none;'}">
      <label for="f-fantasia">Nome fantasia</label>
      <input type="text" class="fc" id="f-fantasia" value="${esc(c ? (c.trade_name || '') : '')}" placeholder="Nome fantasia"></div>




    <div class="grid-2" id="fg-receita">
      <div class="fg" id="fg-abertura" style="${pj ? '' : 'display:none;'}">
        <label for="f-abertura">Data de abertura</label>
        <input type="date" class="fc" id="f-abertura" value="${esc(c && c.opening_date ? String(c.opening_date).slice(0, 10) : '')}"></div>
    </div>
    <div class="fg" id="fg-cnae" style="${pj ? '' : 'display:none;'}">
      <label for="f-cnae">CNAE principal</label>
      <input type="text" class="fc" id="f-cnae" value="${esc(c ? (c.cnae || '') : '')}" placeholder="Atividade econômica principal"></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-user"></i> Contato</div>
    <div class="fg"><label id="lbl-nome">${pj ? 'Nome do contato / fantasia *' : 'Nome completo *'}</label>
      <input type="text" class="fc" id="f-nome" value="${esc(c ? c.name : '')}" placeholder="${pj ? 'Nome fantasia ou responsável' : 'Nome e sobrenome'}"></div>
    <div class="fg"><label>Telefone *</label>
      <input type="text" class="fc" id="f-tel" data-mask="phone" maxlength="15"
        value="${esc(c ? c.phone : '')}" placeholder="(00) 00000-0000"></div>
    <div class="fg"><label>E-mail *</label>
      <input type="email" class="fc" id="f-email" value="${esc(c ? c.email : '')}" placeholder="email@exemplo.com"></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-location-dot"></i> Endereço (opcional)</div>
    <div class="fg"><label>CEP</label>
      <input type="text" class="fc" id="f-cep" maxlength="9" value="${esc(c ? (c.zip_code || '') : '')}" placeholder="00000-000"></div>
    <div class="fg"><label>Rua</label>
      <input type="text" class="fc" id="f-rua" value="${esc(c ? (c.address || '') : '')}"></div>
    <div class="grid-2">
      <div class="fg"><label>Bairro</label>
        <input type="text" class="fc" id="f-bairro" value="${esc(c ? (c.neighborhood || '') : '')}"></div>
      <div class="fg"><label>Cidade</label>
        <input type="text" class="fc" id="f-cidade" value="${esc(c ? (c.city || '') : '')}"></div>
    </div>
    <div class="fg"><label>Estado</label>
      <input type="text" class="fc" id="f-estado" maxlength="2" value="${esc(c ? (c.state || '') : '')}"></div>`;
}

function tipoSelecionado() {
  const marcado = document.querySelector('input[name="tipo-doc"]:checked');
  return marcado ? marcado.value : 'CPF';
}

function bindDocumento() {
  document.querySelectorAll('input[name="tipo-doc"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const pj = tipoSelecionado() === 'CNPJ';
      const campo = document.getElementById('f-doc');
      campo.value = '';
      campo.dataset.mask = pj ? 'cnpj' : 'cpf';
      campo.maxLength = pj ? 18 : 14;
      campo.placeholder = pj ? '00.000.000/0000-00' : '000.000.000-00';
      document.getElementById('lbl-doc').textContent = pj ? 'CNPJ *' : 'CPF *';
      document.getElementById('lbl-nome').textContent = pj ? 'Nome do contato / fantasia *' : 'Nome completo *';
      document.getElementById('fg-razao').style.display = pj ? '' : 'none';
      document.getElementById('fg-fantasia').style.display = pj ? '' : 'none';
      document.getElementById('fg-cnae').style.display = pj ? '' : 'none';
      document.getElementById('fg-abertura').style.display = pj ? '' : 'none';
      document.getElementById('doc-hint').textContent = pj
        ? 'A razão social e o endereço são preenchidos automaticamente pela Receita Federal.'
        : 'O nome do titular é preenchido automaticamente pela consulta do CPF.';
    });
  });

  bindCEP('f-cep', {
    logradouro: 'f-rua', bairro: 'f-bairro', cidade: 'f-cidade', estado: 'f-estado',
  });

  // Consulta automática do documento assim que ele estiver completo.
  const campoDoc = document.getElementById('f-doc');
  if (campoDoc && !campoDoc.disabled) {
    let ultimoDoc = '';
    campoDoc.addEventListener('blur', () => {
      const digitos = onlyDigits(campoDoc.value);
      const completo = tipoSelecionado() === 'CNPJ' ? digitos.length === 14 : digitos.length === 11;
      if (!completo || digitos === ultimoDoc) return;
      ultimoDoc = digitos;
      consultarDocumento();
    });
  }

  const botao = document.getElementById('btn-consulta');
  if (botao) botao.addEventListener('click', () => runAction(botao, consultarDocumento, 'Consultando...'));
}

async function consultarDocumento() {
  const tipo = tipoSelecionado();
  const campo = document.getElementById('f-doc');
  const valor = campo.value;
  fieldHint(campo, 'Consultando os dados públicos...', 'loading');

  if (tipo === 'CPF') {
    if (!isValidCPF(valor)) { fieldHint(campo, 'CPF inválido: confira os dígitos verificadores.', 'err'); return toast('CPF inválido: confira os dígitos verificadores.', 'err'); }
    try {
      const r = await consultarCPF(valor);
      const d = r.data || {};
      const nome = document.getElementById('f-nome');
      if (d.nome) nome.value = d.nome;
      if (d.cidade && !document.getElementById('f-cidade').value) document.getElementById('f-cidade').value = d.cidade;
      if (d.estado && !document.getElementById('f-estado').value) document.getElementById('f-estado').value = d.estado;
      fieldHint(campo, d.nome ? 'CPF localizado. Confira os dados preenchidos.' : 'CPF válido. Complete os dados manualmente.', 'ok');
      return toast(d.nome ? 'CPF localizado.' : 'CPF válido. Complete os dados manualmente.');
    } catch (e) {
      fieldHint(campo, e.message || 'Não foi possível consultar o CPF.', 'err');
      return toast(e.message, 'err');
    }
  }

  if (!isValidCNPJ(valor)) { fieldHint(campo, 'CNPJ inválido: confira os dígitos verificadores.', 'err'); return toast('CNPJ inválido: confira os dígitos verificadores.', 'err'); }
  try {
    const r = await consultarCNPJ(valor);
    if (r.unavailable) { fieldHint(campo, 'Consulta à Receita indisponível agora. Preencha manualmente.', 'err'); return toast('CNPJ válido (consulta à Receita indisponível agora).'); }
    const d = r.data || {};
    document.getElementById('f-razao').value = d.razaoSocial || '';
    if (!document.getElementById('f-nome').value) document.getElementById('f-nome').value = d.nomeFantasia || d.razaoSocial || '';
    document.getElementById('f-cep').value = d.cep ? maskCEP(d.cep) : '';
    document.getElementById('f-rua').value = d.logradouro || '';
    document.getElementById('f-bairro').value = d.bairro || '';
    document.getElementById('f-cidade').value = d.cidade || '';
    document.getElementById('f-estado').value = d.estado || '';
    document.getElementById('f-fantasia').value = d.nomeFantasia || '';
    document.getElementById('f-cnae').value = d.cnae || '';
    if (d.dataAbertura) document.getElementById('f-abertura').value = String(d.dataAbertura).slice(0, 10);
    if (d.email && !document.getElementById('f-email').value) document.getElementById('f-email').value = d.email;
    if (d.telefone && !document.getElementById('f-tel').value) {
      document.getElementById('f-tel').value = maskPhone(d.telefone);
    }
    fieldHint(campo, 'Dados da Receita Federal preenchidos. Revise antes de salvar.', 'ok');
    toast('CNPJ localizado na Receita Federal.');
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function saveCliente() {
  const docField = document.getElementById('f-doc');
  const telField = document.getElementById('f-tel');
  const documentType = editingId
    ? (customers.find((x) => x.id === editingId) || {}).document_type || 'CPF'
    : tipoSelecionado();

  if (!docField.disabled) {
    docField.value = documentType === 'CNPJ' ? maskCNPJ(docField.value) : maskCPF(docField.value);
  }
  telField.value = maskPhone(telField.value);

  const documentNumber = docField.value.trim();
  const name = document.getElementById('f-nome').value.trim();
  const companyName = (document.getElementById('f-razao') || {}).value || '';
  const phone = telField.value.trim();
  const email = document.getElementById('f-email').value.trim();

  if (documentType === 'CPF') {
    if (!isValidName(name)) return toast('Informe o nome completo (nome e sobrenome).', 'err');
  } else if (name.length < 3) {
    return toast('Informe o nome do contato ou nome fantasia.', 'err');
  }
  if (!editingId && !isValidDocument(documentNumber, documentType)) {
    return toast(`${documentType} inválido: os dígitos verificadores não conferem.`, 'err');
  }
  if (!editingId && documentType === 'CNPJ' && companyName.trim().length < 3) {
    return toast('Informe (ou consulte) a razão social da empresa.', 'err');
  }
  if (!isValidPhone(phone)) return toast('Telefone inválido. Use (00) 00000-0000.', 'err');
  if (!isValidEmail(email)) return toast('E-mail inválido.', 'err');

  const payload = {
    documentType,
    documentNumber,
    companyName: companyName.trim() || null,
    name,
    phone,
    email,
    zipCode: document.getElementById('f-cep').value.trim(),
    address: document.getElementById('f-rua').value.trim(),
    neighborhood: document.getElementById('f-bairro').value.trim(),
    city: document.getElementById('f-cidade').value.trim(),
    state: document.getElementById('f-estado').value.trim().toUpperCase(),
    tradeName: (document.getElementById('f-fantasia') || {}).value || null,
    cnae: (document.getElementById('f-cnae') || {}).value || null,
    openingDate: (document.getElementById('f-abertura') || {}).value || null,
  };

  const url = editingId ? `${API_URL}/customers/${editingId}` : `${API_URL}/customers`;
  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Cliente salvo com sucesso!');
    closeDrawer();
    fetchClientes();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteCliente(id) {
  if (!confirm('Excluir este cliente? Ele deixará de aparecer nas listagens (o histórico é preservado).')) return;
  try {
    const res = await authFetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Cliente excluído.');
    closeDrawer();
    fetchClientes();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  fetchClientes();
  document.getElementById('btn-new').addEventListener('click', newCliente);
  document.getElementById('search-input').addEventListener('input', applyFilter);
  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === 1
      ? '<i class="fas fa-sort-alpha-down"></i> A–Z'
      : '<i class="fas fa-sort-alpha-up"></i> Z–A';
    applyFilter();
  });
});
