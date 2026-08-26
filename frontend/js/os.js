// ─────────────────────────────────────────────────────────────
// Tela de Ordens de Serviço — ciclo de vida completo (v2).
// Atendimento interno/externo, geolocalização, evidências
// fotográficas, assinatura digital e auditoria.
// ─────────────────────────────────────────────────────────────
let orders = [];
let customersRef = [];
let devicesRef = [];
let techniciansRef = [];
let sortDir = -1;
let editingId = null;
let slaPadrao = 48;

const STATUS = OS_STATUS;
const SLA_ENCERRADAS = OS_CLOSED;
const FOTOS_MIN = 2;
const FOTOS_MAX = 15;

// Transições permitidas (espelham o backend).
const TRANSICOES = {
  Aberto: ['Cancelado'],
  Agendado: ['Em deslocamento', 'Em execução', 'Aguardando cliente', 'Cancelado'],
  'Em deslocamento': ['No local', 'Aguardando cliente', 'Cancelado'],
  'No local': ['Em execução', 'Aguardando cliente', 'Cancelado'],
  'Em execução': ['Aguardando cliente', 'Finalizado', 'Cancelado'],
  'Aguardando cliente': ['Em execução', 'Finalizado', 'Cancelado'],
  Finalizado: ['Entregue'],
  Entregue: [],
  Cancelado: [],
};

const temFotos = () => hasModule('service-order-photos');
const temAssinatura = () => hasModule('digital-signature');
const temGeo = () => hasModule('geolocation');

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

/** Situação do prazo: dentro do SLA, próximo do vencimento ou atrasada. */
function slaInfo(o) {
  const kind = o.sla_kind || 'servico';
  const horas = kind === 'agendamento' ? Number(o.scheduling_sla_hours) || 24 : Number(o.sla_hours) || slaPadrao;
  const rotulo = kind === 'agendamento' ? 'SLA de agendamento' : 'SLA de serviço';

  if (o.status === 'Agendado') {
    return { horas, rotulo: 'Agendado', texto: `Agendado ${fmtDateTime(o.scheduled_at)}`, cls: 'badge-prog' };
  }
  if (SLA_ENCERRADAS.includes(o.status)) return { horas, rotulo, texto: 'Encerrada', cls: 'badge-done' };
  if (!o.sla_due_at) return { horas, rotulo, texto: `${horas}h`, cls: 'badge-todo' };

  const restante = (new Date(o.sla_due_at) - new Date()) / 3600000;
  if (restante < 0) return { horas, rotulo, texto: `Atrasada ${Math.abs(Math.round(restante))}h`, cls: 'badge-del' };
  if (restante <= 8) return { horas, rotulo, texto: `Vence em ${Math.round(restante)}h`, cls: 'badge-prog' };
  return { horas, rotulo, texto: `${Math.round(restante)}h restantes`, cls: 'badge-todo' };
}

const badgeStatus = (s) => osBadge(s);

async function fetchDados() {
  try {
    const requests = [
      authFetch(`${API_URL}/service-orders?t=${Date.now()}`),
      authFetch(`${API_URL}/company/settings?t=${Date.now()}`),
    ];
    if (can('orders')) {
      requests.push(
        authFetch(`${API_URL}/customers?t=${Date.now()}`),
        authFetch(`${API_URL}/devices?t=${Date.now()}`),
        authFetch(`${API_URL}/users/technicians?t=${Date.now()}`),
      );
    }
    const responses = await Promise.all(requests);
    if (!responses[0].ok) return;
    orders = await responses[0].json();
    if (responses[1] && responses[1].ok) {
      const cfg = await responses[1].json();
      slaPadrao = Number(cfg.sla_hours) || 48;
    }
    if (responses.length > 2) {
      customersRef = responses[2].ok ? await responses[2].json() : [];
      devicesRef = responses[3].ok ? await responses[3].json() : [];
      techniciansRef = responses[4].ok ? await responses[4].json() : [];
    }
    applyFilter();
    document.getElementById('sub-count').textContent =
      `${orders.length} ordem${orders.length !== 1 ? 'ns' : ''} de serviço`;
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar as ordens de serviço.', 'err');
  }
}

function render(data) {
  const tbody = document.getElementById('tbody');
  const cards = document.getElementById('cards');

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty"><i class="fas fa-file-invoice"></i>
      <p>Nenhuma ordem de serviço encontrada.</p></div></td></tr>`;
    if (cards) {
      cards.innerHTML = `<div class="empty"><i class="fas fa-file-invoice"></i>
        <p>Nenhuma ordem de serviço encontrada.</p></div>`;
    }
    return;
  }

  tbody.innerHTML = data.map((o) => {
    const sla = slaInfo(o);
    return `
    <tr onclick="viewOS('${o.id}')">
      <td><strong>#${esc(o.number)}</strong><br>
        <span class="stat-lbl">${o.service_type === 'externo' ? 'Externo' : 'Interno'}</span></td>
      <td class="td2">${esc(o.customer_name)}<br><span class="mono">${esc(o.customer_cpf || '')}</span></td>
      <td class="td2">${esc(o.device_type)} — ${esc(o.serial_number)}</td>
      <td class="td2">${esc(o.technician_name || 'Não atribuído')}</td>
      <td class="td2">${fmtDate(o.opening_date)}</td>
      <td class="td2"><span class="badge ${sla.cls}">${esc(sla.texto)}</span><br>
        <span class="stat-lbl">${esc(sla.rotulo)}${o.sla_due_at ? ` — ${fmtDateTime(o.sla_due_at)}` : ''}</span></td>
      <td>${badgeStatus(o.status)}</td>
      <td><i class="fas fa-chevron-right rarrow"></i></td>
    </tr>`;
  }).join('');

  // Versão em cards (celular) — leitura e ação com o mínimo de toques.
  if (cards) {
    cards.innerHTML = data.map((o) => {
      const sla = slaInfo(o);
      return `
      <article class="os-card" onclick="viewOS('${o.id}')">
        <div class="os-card-hd">
          <strong>#${esc(o.number)}</strong>
          ${badgeStatus(o.status)}
        </div>
        <div class="os-card-line"><span>Cliente</span> ${esc(o.customer_name)}</div>
        <div class="os-card-line"><span>Equipamento</span> ${esc(o.device_type)} — ${esc(o.serial_number)}</div>
        <div class="os-card-line"><span>Técnico</span> ${esc(o.technician_name || 'Não atribuído')}</div>
        <div class="os-card-line"><span>Data</span> ${fmtDate(o.opening_date)}</div>
        <div class="os-card-line"><span>${esc(sla.rotulo)}</span>
          <span class="badge ${sla.cls}">${esc(sla.texto)}</span></div>
        <button class="btn btn-primary os-card-btn" onclick="event.stopPropagation();viewOS('${o.id}')">Abrir</button>
      </article>`;
    }).join('');
  }
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const data = orders.filter((o) => {
    const texto = [o.number, o.customer_name, o.customer_cpf, o.serial_number, o.device_type,
      o.technician_name, o.problem_description, o.city]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    return texto && (!status || o.status === status);
  });
  data.sort((a, b) => sortDir * (a.number - b.number));
  render(data);
}

function enderecoTexto(o) {
  return [
    [o.address, o.address_number].filter(Boolean).join(', '),
    o.neighborhood, o.city, o.state, o.zip_code,
  ].filter(Boolean).join(' - ');
}

function mapsUrl(o) {
  if (o.latitude && o.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoTexto(o))}`;
}

// ── Detalhes ──
async function viewOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  editingId = null;
  fecharModal();
  const sla = slaInfo(o);

  document.getElementById('drawer-title').textContent = `O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent =
    o.service_type === 'externo' ? 'Atendimento externo' : 'Atendimento interno';

  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user"></i> Cliente</div>
    <div class="d-field"><div class="d-lbl">Nome</div><div class="d-val">${esc(o.customer_name)}</div></div>
    ${o.customer_company_name ? `<div class="d-field"><div class="d-lbl">Razão social</div><div class="d-val">${esc(o.customer_company_name)}</div></div>` : ''}
    <div class="d-field"><div class="d-lbl">${esc(o.customer_document_type || 'CPF')}</div><div class="d-val mono">${esc(o.customer_cpf || '—')}</div></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-laptop-medical"></i> Equipamento</div>
    <div class="d-field"><div class="d-lbl">Tipo</div><div class="d-val">${esc(o.device_type)}</div></div>
    <div class="d-field"><div class="d-lbl">Marca / Modelo</div><div class="d-val">${esc(o.device_brand || '—')} ${esc(o.device_model || '')}</div></div>
    <div class="d-field"><div class="d-lbl">Série</div><div class="d-val mono">${esc(o.serial_number)}</div></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-stethoscope"></i> Diagnóstico e serviço</div>
    <div class="d-field"><div class="d-lbl">Diagnóstico</div><div class="d-val">${esc(o.diagnosis || 'Não informado')}</div></div>
    <div class="d-field"><div class="d-lbl">Defeito relatado</div><div class="d-val pre-box">${esc(o.problem_description)}</div></div>
    <div class="d-field"><div class="d-lbl">Solução aplicada</div><div class="d-val pre-box">${esc(o.solution || 'Ainda não informada.')}</div></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-bolt"></i> Status</div>
    <div class="d-field"><div class="d-lbl">Status atual</div><div class="d-val">${badgeStatus(o.status)}</div></div>
    ${statusChips(o)}

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-info-circle"></i> Informações</div>
    <div class="d-field"><div class="d-lbl">Abertura</div><div class="d-val">${fmtDate(o.opening_date)}</div></div>
    <div class="d-field"><div class="d-lbl">Agendamento</div>
      <div class="d-val">${o.scheduled_at ? fmtDateTime(o.scheduled_at) : 'Ainda não agendada'}</div></div>
    <div class="d-field"><div class="d-lbl">Prazo vigente</div>
      <div class="d-val">${esc(sla.rotulo)}: ${o.sla_due_at ? fmtDateTime(o.sla_due_at) : '—'}
        <span class="badge ${sla.cls}">${esc(sla.texto)}</span></div></div>
    <div class="d-field"><div class="d-lbl">Técnico Responsável</div><div class="d-val">${esc(o.technician_name || 'Não atribuído')}</div></div>
    <div class="d-field"><div class="d-lbl">Aberta por</div><div class="d-val">${esc(o.created_by_name || '—')}</div></div>

    ${o.service_type === 'externo' ? `
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-location-dot"></i> Local do atendimento</div>
    <div class="d-field"><div class="d-lbl">Endereço</div><div class="d-val">${esc(enderecoTexto(o) || '—')}</div></div>
    <div class="d-field"><div class="d-lbl">Coordenadas</div>
      <div class="d-val mono">${o.latitude ? `${o.latitude}, ${o.longitude}` : 'Não geocodificado'}</div></div>
    <div class="d-field"><div class="d-lbl">Deslocamento</div><div class="d-val">${fmtDateTime(o.departure_date)}</div></div>
    <div class="d-field"><div class="d-lbl">Chegada</div><div class="d-val">${fmtDateTime(o.arrival_date)}</div></div>
    <div class="d-field"><div class="d-lbl">Início da execução</div><div class="d-val">${fmtDateTime(o.execution_start_date)}</div></div>
    <a class="btn btn-primary btn-maps" target="_blank" rel="noopener" href="${mapsUrl(o)}">
      <i class="fas fa-map-location-dot"></i> Abrir no Google Maps</a>` : ''}

    ${SLA_ENCERRADAS.includes(o.status) && temFotos() ? `
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-camera"></i> Evidências fotográficas</div>
    <div id="galeria" class="foto-grid"><span class="stat-lbl">Carregando fotos...</span></div>` : ''}

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-clock-rotate-left"></i> Histórico</div>
    <div id="historico"><span class="stat-lbl">Carregando histórico...</span></div>`;

  const acoes = [];
  if (canDelete()) acoes.push(`<button class="btn btn-del btn-sm" onclick="deleteOS('${o.id}')"><i class="fas fa-trash"></i> Excluir</button>`);
  if (can('orders')) acoes.push(`<button class="btn btn-ghost btn-sm" onclick="editOS('${o.id}')"><i class="fas fa-edit"></i> Editar</button>`);
  if (can('orderStatus') && (TRANSICOES[o.status] || []).includes('Finalizado')) {
    acoes.push(`<button class="btn btn-primary btn-sm" onclick="abrirFinalizacao('${o.id}')"><i class="fas fa-check"></i> Finalizar O.S.</button>`);
  }
  document.getElementById('drawer-ft').innerHTML = acoes.join('');
  openDrawer();

  if (document.getElementById('galeria')) carregarFotos(o.id);
  carregarHistorico(o.id);
}

// ── Evidências fotográficas ──
async function carregarFotos(id) {
  const box = document.getElementById('galeria');
  if (!box) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/photos`);
    if (!res.ok) { box.innerHTML = '<span class="stat-lbl">Módulo indisponível no plano.</span>'; return; }
    const dados = await res.json();
    const fotos = dados.fotos || [];
    const contador = document.getElementById('foto-contador');
    if (contador) contador.textContent = `(${fotos.length}/${FOTOS_MAX})`;

    box.innerHTML = fotos.length
      ? fotos.map((f) => `
        <figure class="foto-item">
          <img src="${esc(f.image_url)}" alt="Evidência da O.S." loading="lazy" onclick="ampliarFoto('${esc(f.image_url)}')">
          ${can('photos') ? `<button class="foto-x" title="Excluir" onclick="removerFoto('${id}','${f.id}')">×</button>` : ''}
        </figure>`).join('')
      : '<span class="stat-lbl">Nenhuma evidência registrada.</span>';
  } catch {
    box.innerHTML = '<span class="stat-lbl">Não foi possível carregar as fotos.</span>';
  }
}

function ampliarFoto(url) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${esc(url)}" alt="Evidência ampliada">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

async function enviarFotos(id) {
  const input = document.getElementById('f-fotos');
  const arquivos = Array.from(input.files || []);
  if (!arquivos.length) return toast('Selecione ao menos uma foto.', 'err');
  if (arquivos.length > FOTOS_MAX) return toast(`Máximo de ${FOTOS_MAX} fotos por envio.`, 'err');

  toast('Enviando fotos...');
  try {
    const images = [];
    for (const arquivo of arquivos) images.push(await comprimirImagem(arquivo));
    const res = await authFetch(`${API_URL}/service-orders/${id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao enviar as fotos.', 'err');
    input.value = '';
    toast('Evidências registradas!');
    carregarFotos(id);
    fetchDados();
  } catch (e) {
    toast(e.message || 'Erro ao processar a imagem.', 'err');
  }
}

async function removerFoto(id, imageId) {
  if (!confirm('Excluir esta evidência?')) return;
  const res = await authFetch(`${API_URL}/service-orders/${id}/photos/${imageId}`, { method: 'DELETE' });
  const dados = await res.json();
  if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
  toast('Foto removida.');
  carregarFotos(id);
}

// ── Assinatura digital ──
async function carregarAssinatura(id) {
  const box = document.getElementById('assinatura-box');
  if (!box) return;
  const o = orders.find((x) => x.id === id) || {};
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/signature`);
    if (!res.ok) { box.innerHTML = '<span class="stat-lbl">Módulo indisponível no plano.</span>'; return; }
    const { assinatura } = await res.json();

    if (assinatura) {
      box.innerHTML = `
        <img class="assinatura-img" src="${esc(assinatura.signature_url)}" alt="Assinatura do cliente">
        <div class="stat-lbl">Assinado por ${esc(assinatura.signer_name || '—')} em ${fmtDateTime(assinatura.signed_at)}</div>
        ${can('signature') && !['Entregue', 'Cancelado'].includes(o.status)
          ? `<button class="btn btn-ghost btn-sm" onclick="abrirAssinatura('${id}')"><i class="fas fa-pen"></i> Assinar novamente</button>` : ''}`;
      return;
    }

    box.innerHTML = `
      <span class="stat-lbl">${o.service_type === 'externo'
        ? 'Assinatura obrigatória para finalizar o atendimento externo.'
        : 'Assinatura opcional para o atendimento interno.'}</span><br>
      ${can('signature') && !['Entregue', 'Cancelado'].includes(o.status)
        ? `<button class="btn btn-ghost btn-sm" onclick="abrirAssinatura('${id}')"><i class="fas fa-signature"></i> Capturar assinatura</button>` : ''}`;
  } catch {
    box.innerHTML = '<span class="stat-lbl">Não foi possível carregar a assinatura.</span>';
  }
}

function abrirAssinatura(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  document.getElementById('drawer-title').textContent = `O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Assinatura do cliente';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-signature"></i> Assine no quadro abaixo</div>
    <div class="fg"><label>Nome de quem assina</label>
      <input type="text" class="fc" id="f-assinante" value="${esc(o.customer_name)}"></div>
    <canvas id="canvas-assinatura" class="assinatura-canvas" width="600" height="220"></canvas>
    <span class="stat-lbl">Use o dedo (celular) ou o mouse para assinar.</span>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="limparAssinatura()"><i class="fas fa-eraser"></i> Limpar</button>
    <button class="btn btn-ghost btn-sm" onclick="viewOS('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="salvarAssinatura('${id}')"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
  iniciarCanvas();
}

let canvasVazio = true;

function iniciarCanvas() {
  const canvas = document.getElementById('canvas-assinatura');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  canvasVazio = true;

  let desenhando = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
  };
  const inicio = (e) => { e.preventDefault(); desenhando = true; canvasVazio = false; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const mover = (e) => { if (!desenhando) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
  const fim = () => { desenhando = false; };

  ['mousedown', 'touchstart'].forEach((ev) => canvas.addEventListener(ev, inicio, { passive: false }));
  ['mousemove', 'touchmove'].forEach((ev) => canvas.addEventListener(ev, mover, { passive: false }));
  ['mouseup', 'mouseleave', 'touchend'].forEach((ev) => canvas.addEventListener(ev, fim));
}

function limparAssinatura() {
  iniciarCanvas();
}

async function salvarAssinatura(id, silencioso = false) {
  const canvas = document.getElementById('canvas-assinatura');
  if (!canvas || canvasVazio) { toast('Assine antes de salvar.', 'err'); return false; }
  const signature = canvas.toDataURL('image/png');
  const campoNome = document.getElementById('f-assinante');
  const signerName = campoNome ? campoNome.value.trim() : '';

  const res = await authFetch(`${API_URL}/service-orders/${id}/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature, signerName }),
  });
  const dados = await res.json();
  if (!res.ok) { toast(dados.error || 'Erro ao salvar a assinatura.', 'err'); return false; }
  if (silencioso) return true;
  toast('Assinatura registrada!');
  await fetchDados();
  viewOS(id);
  return true;
}

// ── Auditoria ──
async function carregarHistorico(id) {
  const box = document.getElementById('historico');
  if (!box) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/history`);
    if (!res.ok) { box.innerHTML = '<span class="stat-lbl">Histórico indisponível.</span>'; return; }
    const itens = await res.json();
    box.innerHTML = itens.length
      ? `<ul class="timeline">${itens.map((h) => `
          <li><strong>${esc(h.description || h.action)}</strong>
            <span class="stat-lbl">${fmtDateTime(h.created_at)} · ${esc(h.user_name || 'Sistema')}</span></li>`).join('')}</ul>`
      : '<span class="stat-lbl">Sem registros.</span>';
  } catch {
    box.innerHTML = '<span class="stat-lbl">Não foi possível carregar o histórico.</span>';
  }
}

// ── Andamento rápido (chips direto no painel da O.S.) ──
function statusChips(o) {
  if (!can('orderStatus')) return '';
  const opcoes = TRANSICOES[o.status] || [];
  const podeAgendar = !SLA_ENCERRADAS.includes(o.status);
  const chips = [];

  if (podeAgendar) {
    chips.push(`<button class="chip chip-alt" onclick="agendarOS('${o.id}')">
      <i class="fas fa-calendar-plus"></i> ${o.scheduled_at ? 'Reagendar' : 'Agendar'}</button>`);
  }
  opcoes.forEach((s) => {
    const destaque = s === 'Finalizado' ? 'chip-ok' : (s === 'Cancelado' ? 'chip-del' : '');
    chips.push(`<button class="chip ${destaque}" onclick="quickStatus('${o.id}','${s}')">${esc(s)}</button>`);
  });

  if (!chips.length) return '<p class="stat-lbl">Esta ordem de serviço já está encerrada.</p>';
  return `<div class="status-flow">${chips.join('')}</div>
    <span class="stat-lbl">Toque no próximo passo para atualizar o andamento em um clique.</span>`;
}

async function quickStatus(id, status) {
  if (status === 'Finalizado') return abrirFinalizacao(id);
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao atualizar.', 'err');
    toast(`Status: ${status}`);
    await fetchDados();
    viewOS(id);
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── Finalização da O.S. (fotos e assinatura só aqui) ──
function fecharModal() {
  const m = document.getElementById('modal-final');
  if (m) m.remove();
}

/** A assinatura só é exigida em atendimento externo que não seja encerramento interno. */
function assinaturaObrigatoria(o, diag) {
  return o.service_type === 'externo' && diag !== 'Encerramento Interno';
}

function corpoEvidencias(o, diag) {
  const precisaFotos = temFotos() && diag === 'Serviço Completo';
  const precisaAss = temAssinatura();
  if (!precisaFotos && !precisaAss) {
    return '<p class="stat-lbl">Nenhuma evidência é necessária para este diagnóstico.</p>';
  }
  const obrigatoria = assinaturaObrigatoria(o, diag);
  return `
    ${precisaFotos ? `
      <div class="d-divider"></div>
      <div class="d-section"><i class="fas fa-camera"></i> Fotos
        <span id="foto-contador" class="stat-lbl">(0/${FOTOS_MAX})</span></div>
      <div class="fg">
        <input type="file" id="f-fotos" accept="image/*" capture="environment" multiple class="fc">
        <button class="btn btn-ghost" onclick="enviarFotos('${o.id}')"><i class="fas fa-upload"></i> Adicionar fotos</button>
        <span class="stat-lbl">Obrigatório de ${FOTOS_MIN} a ${FOTOS_MAX} fotos.</span>
      </div>
      <div id="galeria" class="foto-grid"><span class="stat-lbl">Carregando fotos...</span></div>` : ''}
    ${precisaAss ? `
      <div class="d-divider"></div>
      <div class="d-section"><i class="fas fa-signature"></i> Assinatura do cliente
        <span class="stat-lbl">${obrigatoria ? '(obrigatória)' : '(opcional)'}</span></div>
      <div id="assinatura-atual"></div>
      <button class="btn btn-ghost btn-sm" type="button" id="btn-assinar" onclick="abrirQuadroAssinatura()">
        <i class="fas fa-signature"></i> Assinar
      </button>
      <div id="quadro-assinatura" hidden>
        <div class="fg"><label for="f-assinante">Nome de quem assina</label>
          <input type="text" class="fc" id="f-assinante" value="${esc(o.customer_name || '')}"></div>
        <canvas id="canvas-assinatura" class="assinatura-canvas" width="600" height="220"></canvas>
        <button class="btn btn-ghost btn-sm" type="button" onclick="limparAssinatura()"><i class="fas fa-eraser"></i> Limpar</button>
      </div>` : ''}`;
}

/** O quadro de assinatura só aparece quando o usuário clica em "Assinar". */
function abrirQuadroAssinatura() {
  const box = document.getElementById('quadro-assinatura');
  if (!box) return;
  box.hidden = false;
  const btn = document.getElementById('btn-assinar');
  if (btn) btn.hidden = true;
  iniciarCanvas();
}

function renderEvidencias(id) {
  const o = orders.find((x) => x.id === id) || {};
  const diag = document.getElementById('f-diagnostico').value || o.diagnosis || '';
  const box = document.getElementById('bloco-evidencias');
  box.innerHTML = corpoEvidencias(o, diag);
  if (document.getElementById('galeria')) carregarFotos(id);
  if (document.getElementById('assinatura-atual')) marcarAssinaturaExistente(id);
}

async function marcarAssinaturaExistente(id) {
  const box = document.getElementById('assinatura-atual');
  if (!box) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/signature`);
    if (!res.ok) return;
    const { assinatura } = await res.json();
    if (assinatura) {
      box.innerHTML = `<img class="assinatura-img" src="${esc(assinatura.signature_url)}" alt="Assinatura registrada">
        <div class="stat-lbl">Assinatura já registrada — assine novamente apenas se quiser substituir.</div>`;
    }
  } catch { /* silencioso */ }
}

function abrirFinalizacao(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  fecharModal();

  const modal = document.createElement('div');
  modal.className = 'modal-ov';
  modal.id = 'modal-final';
  modal.innerHTML = `
    <div class="modal-box" role="dialog" aria-label="Finalizar ordem de serviço">
      <div class="modal-hd">
        <strong>Finalizar O.S. #${esc(o.number)}</strong>
        <button class="drawer-x" onclick="fecharModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="fg"><label>Diagnóstico *</label>
          <select class="fc" id="f-diagnostico">
            <option value="">Selecione</option>
            <option value="Serviço Completo" ${o.diagnosis === 'Serviço Completo' ? 'selected' : ''}>Serviço Completo (exige fotos)</option>
            <option value="Encerramento Interno" ${o.diagnosis === 'Encerramento Interno' ? 'selected' : ''}>Encerramento Interno (sem evidências)</option>
          </select></div>
        <div class="fg"><label>Solução aplicada *</label>
          <textarea class="fc" id="f-solucao-final" rows="4" placeholder="Descreva o serviço executado...">${esc(o.solution || '')}</textarea></div>
        <div id="bloco-evidencias"></div>
      </div>
      <div class="modal-ft">
        <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmarFinalizacao('${o.id}')"><i class="fas fa-check"></i> Finalizar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('f-diagnostico').addEventListener('change', () => renderEvidencias(id));
  renderEvidencias(id);
}

async function confirmarFinalizacao(id) {
  const o = orders.find((x) => x.id === id) || {};
  const diagnosis = document.getElementById('f-diagnostico').value || o.diagnosis || '';
  const solution = document.getElementById('f-solucao-final').value.trim();

  if (!diagnosis) return toast('Selecione o diagnóstico.', 'err');
  if (solution.length < 5) return toast('Descreva o serviço executado.', 'err');

  // Fotos: obrigatórias apenas no diagnóstico "Serviço Completo".
  if (temFotos() && diagnosis === 'Serviço Completo') {
    const total = document.querySelectorAll('#galeria .foto-item').length;
    if (total < FOTOS_MIN) return toast(`Envie de ${FOTOS_MIN} a ${FOTOS_MAX} fotos antes de finalizar.`, 'err');
    if (total > FOTOS_MAX) return toast(`Máximo de ${FOTOS_MAX} fotos.`, 'err');
  }

  // Assinatura: obrigatória no atendimento externo, exceto no encerramento interno.
  if (temAssinatura()) {
    const canvas = document.getElementById('canvas-assinatura');
    if (canvas && !canvasVazio) {
      const ok = await salvarAssinatura(id, true);
      if (!ok) return;
    } else if (assinaturaObrigatoria(o, diagnosis) && !(o.signature_count > 0)
      && !document.querySelector('#assinatura-atual img')) {
      return toast('Clique em "Assinar" e capture a assinatura do cliente para finalizar o atendimento externo.', 'err');
    }
  }

  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Finalizado', solution, diagnosis }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao finalizar.', 'err');
    toast('Ordem de serviço finalizada!');
    fecharModal();
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── Cadastro / edição completa ──
function newOS() {
  editingId = null;
  document.getElementById('drawer-title').textContent = 'Nova Ordem de Serviço';
  document.getElementById('drawer-mode').textContent = 'Cadastro';
  document.getElementById('drawer-body').innerHTML = formHTML(null);
  bindFormulario();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function editOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  editingId = id;
  document.getElementById('drawer-title').textContent = `Editar O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Edição';
  document.getElementById('drawer-body').innerHTML = formHTML(o);
  bindFormulario();
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewOS('${id}')">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="saveOS()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

function deviceOptions(customerId, selected) {
  const list = devicesRef.filter((d) => !customerId || d.customer_id === customerId);
  if (!list.length) return '<option value="">Nenhum equipamento para este cliente</option>';
  return ['<option value="">Selecione o equipamento</option>']
    .concat(list.map((d) =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(d.type)} — ${esc(d.serial_number)}</option>`))
    .join('');
}

function bindFormulario() {
  const cli = document.getElementById('f-cliente');
  if (cli) {
    cli.addEventListener('change', () => {
      document.getElementById('f-device').innerHTML = deviceOptions(cli.value, '');
    });
  }

  document.querySelectorAll('input[name="tipo-atend"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const externo = radio.value === 'externo' && radio.checked;
      document.getElementById('bloco-endereco').style.display = externo ? '' : 'none';
    });
  });

  const cep = document.getElementById('f-cep');
  if (cep) {
    cep.addEventListener('input', () => { cep.value = maskCEP(cep.value); });
    cep.addEventListener('blur', async () => {
      if (onlyDigits(cep.value).length !== 8) return;
      try {
        const r = await consultarCEP(cep.value);
        if (r.data) {
          document.getElementById('f-rua').value = r.data.logradouro || '';
          document.getElementById('f-bairro').value = r.data.bairro || '';
          document.getElementById('f-cidade').value = r.data.cidade || '';
          document.getElementById('f-estado').value = r.data.estado || '';
          document.getElementById('f-numero').focus();
        }
      } catch (e) { toast(e.message, 'err'); }
    });
  }
}

function formHTML(o) {
  const hoje = hojeLocal();
  const externo = o ? o.service_type === 'externo' : false;
  const clienteLabel = (c) => `${c.name} — ${c.document_number || c.cpf || ''}`;

  return `
    <div class="d-section"><i class="fas fa-user"></i> Cliente e Equipamento</div>
    <div class="fg"><label>Cliente *</label>
      <select class="fc" id="f-cliente">
        <option value="">Selecione o cliente</option>
        ${customersRef.map((c) => `<option value="${c.id}" ${o && o.customer_id === c.id ? 'selected' : ''}>${esc(clienteLabel(c))}</option>`).join('')}
      </select></div>
    <div class="fg"><label>Equipamento *</label>
      <select class="fc" id="f-device">${deviceOptions(o ? o.customer_id : '', o ? o.device_id : '')}</select></div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-route"></i> Tipo do atendimento</div>
    <div class="fg">
      <div class="radio-row">
        <label class="radio-opt"><input type="radio" name="tipo-atend" value="interno" ${externo ? '' : 'checked'}> Interno</label>
        <label class="radio-opt"><input type="radio" name="tipo-atend" value="externo" ${externo ? 'checked' : ''} ${temGeo() ? '' : 'disabled'}> Externo</label>
      </div>
      ${temGeo() ? '' : '<span class="stat-lbl">O atendimento externo faz parte do módulo Geolocalização.</span>'}
    </div>

    <div id="bloco-endereco" style="${externo ? '' : 'display:none;'}">
      <div class="fg"><label>CEP *</label>
        <input type="text" class="fc" id="f-cep" maxlength="9" value="${esc(o ? (o.zip_code || '') : '')}" placeholder="00000-000">
        <span class="stat-lbl">Rua, bairro, cidade e estado são preenchidos automaticamente (ViaCEP).</span></div>
      <div class="fg"><label>Rua *</label>
        <input type="text" class="fc" id="f-rua" value="${esc(o ? (o.address || '') : '')}"></div>
      <div class="grid-2">
        <div class="fg"><label>Número</label>
          <input type="text" class="fc" id="f-numero" value="${esc(o ? (o.address_number || '') : '')}"></div>
        <div class="fg"><label>Bairro</label>
          <input type="text" class="fc" id="f-bairro" value="${esc(o ? (o.neighborhood || '') : '')}"></div>
      </div>
      <div class="grid-2">
        <div class="fg"><label>Cidade *</label>
          <input type="text" class="fc" id="f-cidade" value="${esc(o ? (o.city || '') : '')}"></div>
        <div class="fg"><label>Estado *</label>
          <input type="text" class="fc" id="f-estado" maxlength="2" value="${esc(o ? (o.state || '') : '')}"></div>
      </div>
    </div>

    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-clipboard-list"></i> Atendimento</div>
    <div class="fg"><label>Data de abertura *</label>
      <input type="date" class="fc" id="f-data" max="${hoje}" value="${o ? String(o.opening_date).slice(0, 10) : hoje}"></div>
    <div class="fg"><label>Técnico responsável</label>
      <select class="fc" id="f-tecnico">
        <option value="">Atribuir depois</option>
        ${techniciansRef.map((t) => `<option value="${t.id}" ${o && o.technician_id === t.id ? 'selected' : ''}>${esc(t.name)}${t.active === false ? ' (inativo)' : ''}</option>`).join('')}
      </select></div>
    ${o
      ? `<div class="fg"><label>Status *</label>
      <select class="fc" id="f-status">
        ${STATUS.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>`
      : `<div class="fg"><label>Status</label>
      <input type="text" class="fc" value="Aberto" disabled>
      <span class="stat-lbl">A O.S. nasce Aberta (SLA de agendamento de 24 horas) e só avança após ser agendada.</span></div>`}
    <div class="fg"><label>Prazo de serviço — SLA (horas)</label>
      <input type="number" class="fc" id="f-sla" min="1" max="8760"
        value="${o && o.sla_hours ? o.sla_hours : slaPadrao}"
        ${can('companySettings') ? '' : 'disabled'}>
      ${can('companySettings') ? '' : '<span class="stat-lbl">Somente o Administrador da Empresa altera o prazo.</span>'}</div>
    <div class="fg"><label>Defeito relatado * (mínimo 10 caracteres)</label>
      <textarea class="fc" id="f-defeito" rows="4" placeholder="Descreva o problema informado pelo cliente...">${esc(o ? o.problem_description : '')}</textarea></div>
    <div class="fg"><label>Solução aplicada</label>
      <textarea class="fc" id="f-solucao" rows="4" placeholder="Preenchida durante o atendimento...">${esc(o && o.solution ? o.solution : '')}</textarea></div>`;
}

async function saveOS() {
  const customerId = document.getElementById('f-cliente').value;
  const deviceId = document.getElementById('f-device').value;
  const openingDate = document.getElementById('f-data').value;
  const technicianId = document.getElementById('f-tecnico').value;
  const statusField = document.getElementById('f-status');
  const status = statusField ? statusField.value : undefined;
  const problemDescription = document.getElementById('f-defeito').value.trim();
  const solution = document.getElementById('f-solucao').value.trim();
  const slaField = document.getElementById('f-sla');
  const slaHours = slaField && !slaField.disabled ? Number(slaField.value) : undefined;
  const serviceType = (document.querySelector('input[name="tipo-atend"]:checked') || {}).value || 'interno';

  if (slaHours !== undefined && (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 8760)) {
    return toast('Informe o SLA em horas (entre 1 e 8760).', 'err');
  }
  if (!customerId) return toast('Selecione o cliente.', 'err');
  if (!deviceId) return toast('Selecione o equipamento.', 'err');
  if (!isValidPastOrTodayDate(openingDate)) return toast('Data de abertura inválida (não pode ser futura).', 'err');
  if (problemDescription.length < 10) return toast('Descreva o defeito com ao menos 10 caracteres.', 'err');

  const payload = {
    customerId, deviceId, openingDate, technicianId, status,
    problemDescription, solution, slaHours, serviceType,
  };

  if (serviceType === 'externo') {
    payload.zipCode = document.getElementById('f-cep').value.trim();
    payload.address = document.getElementById('f-rua').value.trim();
    payload.addressNumber = document.getElementById('f-numero').value.trim();
    payload.neighborhood = document.getElementById('f-bairro').value.trim();
    payload.city = document.getElementById('f-cidade').value.trim();
    payload.state = document.getElementById('f-estado').value.trim().toUpperCase();

    if (onlyDigits(payload.zipCode).length !== 8) return toast('Informe o CEP do atendimento.', 'err');
    if (!payload.address || !payload.city || !payload.state) return toast('Informe rua, cidade e estado do atendimento.', 'err');
  }

  const url = editingId ? `${API_URL}/service-orders/${editingId}` : `${API_URL}/service-orders`;
  try {
    const res = await authFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    toast('Ordem de serviço salva!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function deleteOS(id) {
  if (!confirm('Excluir esta ordem de serviço? O registro é arquivado e sai das listagens.')) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}`, { method: 'DELETE' });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao excluir.', 'err');
    toast('Ordem de serviço excluída.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── Agendamento do atendimento ──
function agendarOS(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;

  const min = new Date(Date.now() + 60000);
  const max = new Date(Date.now() + 30 * 86400000);

  document.getElementById('drawer-title').textContent = `O.S. #${o.number}`;
  document.getElementById('drawer-mode').textContent = 'Programação do atendimento';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-calendar-days"></i> Agendamento</div>
    <p class="stat-lbl">Escolha um horário entre o próximo minuto e 1 mês à frente.
      Depois de agendada, a O.S. fica sem SLA até a hora marcada.</p>
    <div class="fg"><label>Data e hora do atendimento *</label>
      <input type="datetime-local" class="fc" id="f-agenda"
        min="${paraInputDateTime(min)}" max="${paraInputDateTime(max)}"
        value="${o.scheduled_at ? paraInputDateTime(new Date(o.scheduled_at)) : paraInputDateTime(min)}"></div>
    <div class="fg"><label>Técnico responsável</label>
      <select class="fc" id="f-agenda-tec">
        <option value="">Manter atual (${esc(o.technician_name || 'sem técnico')})</option>
        ${techniciansRef.map((t) => `<option value="${t.id}" ${o.technician_id === t.id ? 'selected' : ''}>${esc(t.name)}${t.active === false ? ' (inativo)' : ''}</option>`).join('')}
      </select></div>`;

  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="viewOS('${id}')">Cancelar</button>
    ${o.scheduled_at ? `<button class="btn btn-del btn-sm" onclick="desagendarOS('${id}')"><i class="fas fa-calendar-xmark"></i> Desmarcar</button>` : ''}
    <button class="btn btn-primary btn-sm" onclick="salvarAgenda('${id}')"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function salvarAgenda(id) {
  const valor = document.getElementById('f-agenda').value;
  if (!valor) return toast('Informe a data e a hora do atendimento.', 'err');
  const quando = new Date(valor);
  if (quando <= new Date()) return toast('O agendamento deve ser para o futuro.', 'err');
  if (quando > new Date(Date.now() + 30 * 86400000)) return toast('O agendamento deve ser para, no máximo, 1 mês à frente.', 'err');

  const technicianId = document.getElementById('f-agenda-tec').value || null;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: quando.toISOString(), technicianId }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao agendar.', 'err');
    toast('Atendimento agendado!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

async function desagendarOS(id) {
  if (!confirm('Desmarcar o atendimento? A O.S. volta para a fila de agendamento.')) return;
  try {
    const res = await authFetch(`${API_URL}/service-orders/${id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: null, clear: true }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao desmarcar.', 'err');
    toast('Agendamento removido.');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

// ── SLA padrão da empresa ──
function abrirSlaPadrao() {
  document.getElementById('drawer-title').textContent = 'SLA padrão da empresa';
  document.getElementById('drawer-mode').textContent = 'Configuração';
  document.getElementById('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-stopwatch"></i> Prazo padrão das novas O.S.</div>
    <div class="fg"><label>Horas *</label>
      <input type="number" class="fc" id="f-sla-padrao" min="1" max="8760" value="${slaPadrao}"></div>
    <span class="stat-lbl">O prazo vale para as novas ordens de serviço. As existentes mantêm o prazo já definido.</span>`;
  document.getElementById('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cancelar</button>
    <button class="btn btn-primary btn-sm" onclick="salvarSlaPadrao()"><i class="fas fa-save"></i> Salvar</button>`;
  openDrawer();
}

async function salvarSlaPadrao() {
  const slaHours = Number(document.getElementById('f-sla-padrao').value);
  if (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 8760) {
    return toast('Informe o SLA em horas (entre 1 e 8760).', 'err');
  }
  try {
    const res = await authFetch(`${API_URL}/company/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slaHours }),
    });
    const dados = await res.json();
    if (!res.ok) return toast(dados.error || 'Erro ao salvar.', 'err');
    slaPadrao = slaHours;
    toast('SLA padrão atualizado!');
    closeDrawer();
    fetchDados();
  } catch {
    toast('Erro de conexão.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession()) return;

  const filtro = document.getElementById('filter-status');
  if (filtro) {
    filtro.innerHTML = '<option value="">Todos os status</option>'
      + STATUS.map((s) => `<option value="${s}">${s}</option>`).join('');
  }

  fetchDados();
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', newOS);
  const btnSla = document.getElementById('btn-sla');
  if (btnSla) btnSla.addEventListener('click', abrirSlaPadrao);
  document.getElementById('search-input').addEventListener('input', applyFilter);
  document.getElementById('filter-status').addEventListener('change', applyFilter);
  document.getElementById('btn-sort').addEventListener('click', () => {
    sortDir *= -1;
    const btn = document.getElementById('btn-sort');
    btn.classList.toggle('on');
    btn.innerHTML = sortDir === -1
      ? '<i class="fas fa-sort-numeric-down"></i> Mais recentes'
      : '<i class="fas fa-sort-numeric-up"></i> Mais antigas';
    applyFilter();
  });
});
