// ─────────────────────────────────────────────────────────────
// Módulo Agenda Técnica — programação de atendimentos (plano Empresarial).
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

let tecnicos = [];

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function statusBadge(status) {
  return osBadge(status);
}

function equipamento(row) {
  return esc([row.device_type, row.device_brand, row.device_model].filter(Boolean).join(' '));
}

function rangeQuery() {
  const params = new URLSearchParams();
  if ($('f-from').value) params.set('from', $('f-from').value);
  if ($('f-to').value) params.set('to', $('f-to').value);
  return params.toString() ? `?${params}` : '';
}

async function loadTecnicos() {
  if (!can('schedule')) return;
  const res = await authFetch(`${API_URL}/users/technicians`);
  if (res.ok) tecnicos = await res.json();
}

async function load() {
  try {
    const res = await authFetch(`${API_URL}/schedule${rangeQuery()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || 'Não foi possível carregar a agenda.', 'err');
      return;
    }
    const d = await res.json();
    const editavel = can('schedule');

    $('sub-info').textContent =
      `${d.agendados.length} atendimento(s) entre ` +
      `${new Date(d.periodo.de + 'T00:00:00').toLocaleDateString('pt-BR')} e ` +
      `${new Date(d.periodo.ate + 'T00:00:00').toLocaleDateString('pt-BR')}`;

    $('t-agenda').innerHTML = d.agendados.length
      ? d.agendados
          .map(
            (r) => `<tr>
        <td><strong>${fmtDateTime(r.scheduled_at)}</strong></td>
        <td>#${r.number}</td>
        <td>${esc(r.customer_name)}</td>
        <td>${equipamento(r)}</td>
        <td>${esc(r.technician_name || 'Sem técnico')}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${editavel ? `<button class="btn btn-ghost btn-sm" data-edit="${r.id}"><i class="fas fa-pen"></i></button>` : ''}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-3)">Nenhum atendimento programado no período</td></tr>';

    $('t-pendentes').innerHTML = d.pendentes.length
      ? d.pendentes
          .map(
            (r) => `<tr>
        <td>#${r.number}</td>
        <td>${esc(r.customer_name)}</td>
        <td>${equipamento(r)}</td>
        <td>${esc(r.technician_name || 'Sem técnico')}</td>
        <td>${fmtDateTime(r.sla_due_at)}</td>
        <td>${editavel ? `<button class="btn btn-ghost btn-sm" data-edit="${r.id}"><i class="fas fa-calendar-plus"></i></button>` : ''}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-3)">Todas as O.S. abertas já estão programadas</td></tr>';

    if (d.carga && d.carga.length) {
      $('card-carga').style.display = '';
      $('t-carga').innerHTML = d.carga
        .map((r) => `<tr><td>${esc(r.technician_name)}</td><td>${r.total}</td></tr>`)
        .join('');
    } else {
      $('card-carga').style.display = 'none';
    }

    document.querySelectorAll('[data-edit]').forEach((btn) => {
      const row = [...d.agendados, ...d.pendentes].find((o) => o.id === btn.dataset.edit);
      btn.addEventListener('click', () => openForm(row));
    });
  } catch {
    toast('Falha de conexão com o servidor.', 'err');
  }
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openForm(order) {
  if (!order) return;

  $('drawer-title').textContent = `O.S. #${order.number}`;
  $('drawer-mode').textContent = 'Programação do atendimento';
  $('drawer-body').innerHTML = `
    <div class="d-section"><i class="fas fa-user"></i> Atendimento</div>
    <div class="d-field"><div class="d-lbl">Cliente</div><div class="d-val">${esc(order.customer_name)}</div></div>
    <div class="d-field"><div class="d-lbl">Equipamento</div><div class="d-val">${equipamento(order)}</div></div>
    <div class="d-field"><div class="d-lbl">Defeito relatado</div><div class="d-val pre-box">${esc(order.problem_description)}</div></div>
    <div class="d-divider"></div>
    <div class="d-section"><i class="fas fa-calendar-days"></i> Programação</div>
    <div class="fg">
      <label for="fld-when">Data e hora do atendimento</label>
      <input type="datetime-local" class="fc" id="fld-when"
        min="${toLocalInput(new Date(Date.now() + 60000))}"
        max="${toLocalInput(new Date(Date.now() + 30 * 86400000))}"
        value="${toLocalInput(order.scheduled_at) || toLocalInput(new Date(Date.now() + 60000))}">
      <span class="stat-lbl">Do próximo minuto até 1 mês à frente.</span>
    </div>
    <div class="fg">
      <label for="fld-tec">Técnico responsável</label>
      <select class="fc" id="fld-tec">
        <option value="">Manter atual (${esc(order.technician_name || 'sem técnico')})</option>
        ${tecnicos.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
      </select>
    </div>`;

  $('drawer-ft').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="btn-clear"><i class="fas fa-calendar-xmark"></i> Desmarcar</button>
    <button class="btn btn-primary btn-sm" id="btn-save"><i class="fas fa-check"></i> Salvar</button>`;

  $('btn-save').addEventListener('click', () => save(order.id, $('fld-when').value, $('fld-tec').value));
  $('btn-clear').addEventListener('click', () => save(order.id, '', ''));

  openDrawer();
}

async function save(id, scheduledAt, technicianId) {
  if (scheduledAt === '' && technicianId === '') {
    // desmarcar exige confirmação
    if (!confirm('Remover a programação deste atendimento?')) return;
  } else if (!scheduledAt) {
    return toast('Informe a data e a hora do atendimento.', 'err');
  } else {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return toast('Data do atendimento inválida.', 'err');
    if (when <= new Date()) return toast('O agendamento deve ser para, no mínimo, o próximo minuto.', 'err');
    if (when > new Date(Date.now() + 30 * 86400000)) {
      return toast('O agendamento deve ser para, no máximo, 1 mês à frente.', 'err');
    }
  }

  const res = await authFetch(`${API_URL}/schedule/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt, technicianId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return toast(data.error || 'Não foi possível salvar a programação.', 'err');

  closeDrawer();
  toast('Agenda atualizada.');
  load();
}

document.addEventListener('DOMContentLoaded', async () => {
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = localDate(new Date());
  $('f-from').value = today;
  $('f-to').value = today;

  $('btn-filter').addEventListener('click', load);
  $('btn-today').addEventListener('click', () => {
    $('f-from').value = today;
    $('f-to').value = today;
    load();
  });
  $('btn-week').addEventListener('click', () => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    $('f-from').value = today;
    $('f-to').value = localDate(end);
    load();
  });

  await loadTecnicos();
  load();
});
