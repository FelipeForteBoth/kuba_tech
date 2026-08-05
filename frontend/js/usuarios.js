// Tela de Usuários — gestão da equipe pelo Administrador da Empresa.
let users = [];
let rolesRef = [];
let sortDir = 1;
let editingId = null;

async function fetchDados() {
  try {
    const [uRes, rRes] = await Promise.all([
      authFetch(`${API_URL}/users?t=${Date.now()}`),
      authFetch(`${API_URL}/users/roles?t=${Date.now()}`),
    ]);
    if (!uRes.ok) return;
    users = await uRes.json();
    rolesRef = rRes.ok ? await rRes.json() : [];
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${users.length} usuário${users.length !== 1 ? 's' : ''} na equipe`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os usuários.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty"><i class="fas fa-user-shield"></i>
      <p>Nenhum usuário encontrado.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((u) => `
    <tr onclick="viewUsuario('${u.id}')">
      <td><strong>${esc(u.name)}</strong></td>
      <td class="td2">${esc(u.email)}</td>
      <td class="td2">${esc(ROLE_LABELS[u.role] || u.role)}</td>
      <td>${u.active ? '<span class="badge badge-done">Ativo</span>' : '<span class="badge badge-del">Inativo</span>'}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`).join('');
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const data = users.filter((u) =>
    [u.name, u.email, ROLE_LABELS[u.role]].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  data.sort((a, b) => sortDir * a.name.localeCompare(b.name, 'pt-BR'));
  render(data);
}

function viewUsuario(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  editingId = null;

  document.getElementById('drawer-title').textContent = u.name;
  document.getElementById('drawer-mode').textContent = 'Detalhes do Usuário';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user-shield"></i> Acesso</div>
    <div class="d-field"><div class="d-lbl">Nome</div><div class="d-val">${esc(u.name)}</div></div>
    <div class="d-field"><div class="d-lbl">E-mail</div><div class="d-val">${esc(u.email)}</div></div>
    <div class="d-field"><div class="d-lbl">Perfil</div><div class="d-val">${esc(ROLE_LABELS[u.role] || u.role)}</div></div>
    <div class="d-field"><div class="d-lbl">Situação</div><div class="d-val">${u.active ? 'Ativo' : 'Inativo'}</div></div>
    <div class="d-field"><div class="d-lbl">Último acesso</div><div class="d-val">${u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : 'Nunca acessou'}</div></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-del btn-sm" onclick="deleteUsuario('${u.id}')"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-ghost btn-sm" onclick="senhaUsuario('${u.id}')"><i class="fas fa-key"></i> Senha</button>
    <button class="btn btn-primary btn-sm" onclick="editUsuario('${u.id}')"><i class="fas fa-edit"></i> Editar</button>`;
  openDrawer();
}

function roleOptions(selected) {
  return rolesRef.map((r) => `<option value="${r.value}" ${r.value === selected ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
}

function newUsuario() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Novo Usuário';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user-shield"></i> Dados de Acesso</div>
    <div class="fg"><label>Nome Completo *</label><input type="text" class="fc" id="f-nome" placeholder="Nome e sobrenome"></div>
    <div class="fg"><label>E-mail *</label><input type="email" class="fc" id="f-email" placeholder="email@empresa.com"></div>
    <div class="fg"><label>Senha provisória *</label><input type="password" class="fc" id="f-senha" placeholder="Mínimo 8 caracteres, com letras e números"></div>
    <div class="fg"><label>Perfil de acesso *</label><select class="fc" id="f-perfil">${roleOptions('attendant')}</select></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveUsuario()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editUsuario(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = 'Editar Usuário';
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user-shield"></i> Dados de Acesso</div>
    <div class="fg"><label>Nome Completo *</label><input type="text" class="fc" id="f-nome" value="${esc(u.name)}"></div>
    <div class="fg"><label>E-mail</label><input type="email" class="fc" value="${esc(u.email)}" disabled></div>
    <div class="fg"><label>Perfil de acesso *</label><select class="fc" id="f-perfil">${roleOptions(u.role)}</select></div>
    <div class="fg"><label>Situação *</label>
      <select class="fc" id="f-ativo">
        <option value="true" ${u.active ? 'selected' : ''}>Ativo</option>
        <option value="false" ${!u.active ? 'selected' : ''}>Inativo</option>
      </select></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewUsuario('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveUsuario()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function saveUsuario() {
  const name = document.getElementById('f-nome').value.trim();
  const role = document.getElementById('f-perfil').value;
  if (!isValidName(name)) return toast('Informe o nome completo do usuário.', 'err');

  let url = `${API_URL}/users`;
  let body = { name, role };

  if (editingId) {
    url = `${API_URL}/users/${editingId}`;
    body.active = document.getElementById('f-ativo').value === 'true';
  } else {
    const email = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-senha').value;
    if (!isValidEmail(email)) return toast('E-mail inválido.', 'err');
    if (!isValidPassword(password)) return toast('A senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
    body = { ...body, email, password };
  }

  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Usuário salvo com sucesso!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

function senhaUsuario(id) {
  document.getElementById('drawer-mode').textContent = 'Redefinir senha';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-key"></i> Nova Senha</div>
    <div class="fg"><label>Senha *</label><input type="password" class="fc" id="f-nova" placeholder="Mínimo 8 caracteres, com letras e números"></div>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewUsuario('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveSenha('${id}')"><i class="fas fa-save"></i> Redefinir</button>`;
  openDrawer();
}

async function saveSenha(id) {
  const password = document.getElementById('f-nova').value;
  if (!isValidPassword(password)) return toast('A senha deve ter ao menos 8 caracteres, com letras e números.', 'err');
  try {
    const res = await authFetch(`${API_URL}/users/${id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao redefinir.', 'err');
    toast('Senha redefinida com sucesso.');
    closeDrawer();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteUsuario(id) {
  if (!confirm('Excluir este usuário?')) return;
  try {
    const res = await authFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Usuário excluído.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;
  fetchDados();
  document.getElementById('btn-new').addEventListener('click', newUsuario);
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
