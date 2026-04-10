// ===== State =====
let weekOffset = 0;
let currentTemplate = [];

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ===== Init =====
document.getElementById('prev-week').addEventListener('click', () => { weekOffset--; loadSchedule(); });
document.getElementById('next-week').addEventListener('click', () => { weekOffset++; loadSchedule(); });

// Handle #requests anchor
if (location.hash === '#requests') {
  document.getElementById('requests').scrollIntoView();
}

loadSchedule();
loadMyRequests();

// ===== Schedule loader =====
async function loadSchedule() {
  const res  = await fetch(`/api/schedule?week_offset=${weekOffset}`);
  const data = await res.json();

  document.getElementById('week-label').textContent =
    formatDate(data.date_from) + ' — ' + formatDate(data.date_to);

  const hasPending = data.days.some(d => d.pending);
  document.getElementById('pending-notice').classList.toggle('hidden', !hasPending);

  renderGrid(data.days);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

// ===== Grid renderer =====
function renderGrid(days) {
  const grid = document.getElementById('sched-grid');
  grid.innerHTML = '';

  days.forEach(day => {
    const isToday = day.date === todayIso();
    const col = document.createElement('div');
    col.className = 'sched-day' + (isToday ? ' today' : '');

    const d = new Date(day.date + 'T00:00:00');
    const dayName  = DAYS[day.weekday];
    const dayNum   = d.getDate() + ' ' + d.toLocaleDateString('ru-RU', {month:'short'});

    col.innerHTML = `
      <div class="day-head">
        <div>
          <div class="day-name${isToday ? ' today-label' : ''}">${dayName}</div>
          <div class="day-date">${d.getDate()}</div>
        </div>
        <button class="btn-ghost btn-sm" style="padding:4px 8px;font-size:11px"
          onclick="prefillRequest('${day.date}')">+</button>
      </div>
      <div class="day-body" id="body-${day.date}"></div>
    `;
    grid.appendChild(col);

    const body = document.getElementById('body-' + day.date);

    // Approved / override shift
    if (day.shift) {
      const cls = day.override ? 'shift-override' : 'shift-approved';
      const lbl = day.override ? 'Изменено' : 'Одобрено';
      body.innerHTML += `
        <div class="shift-block ${cls}">
          <span class="shift-time">${day.shift.time_start.slice(0,5)} — ${day.shift.time_end.slice(0,5)}</span>
          <span class="shift-label">${lbl}</span>
        </div>`;
    }

    // Pending template day
    if (day.pending) {
      body.innerHTML += `
        <div class="shift-block shift-pending">
          <span class="shift-time">${day.pending.time_start.slice(0,5)} — ${day.pending.time_end.slice(0,5)}</span>
          <span class="shift-label">На рассмотрении</span>
        </div>`;
    }

    // Meetings — inserted into the timeline if overlapping with shift
    if (day.meetings.length) {
      day.meetings.forEach(m => {
        const overlap = day.shift &&
          m.time_start < day.shift.time_end && m.time_end > day.shift.time_start;
        body.innerHTML += `
          <div class="meeting-block">
            <strong>${m.title}</strong>
            ${m.time_start.slice(0,5)} — ${m.time_end.slice(0,5)}
            ${overlap ? '<span style="font-size:10px;opacity:0.7"> · в рабочее время</span>' : ''}
          </div>`;
      });
    }

    if (!day.shift && !day.pending && !day.meetings.length) {
      body.innerHTML += '<span class="day-off">Выходной</span>';
    }
  });
}

// ===== Template modal =====
async function openTemplateModal() {
  const res  = await fetch('/api/template');
  currentTemplate = await res.json();

  const map = {};
  currentTemplate.forEach(t => { map[t.weekday] = t; });

  const rows = document.getElementById('template-rows');
  rows.innerHTML = '';

  DAYS.forEach((name, wd) => {
    const t   = map[wd];
    const on  = !!t;
    const ts  = t ? t.time_start.slice(0,5) : '09:00';
    const te  = t ? t.time_end.slice(0,5)   : '18:00';
    const row = document.createElement('div');
    row.className = 'template-row';
    row.innerHTML = `
      <input type="checkbox" id="wd-${wd}" ${on ? 'checked' : ''} onchange="toggleDay(${wd})"/>
      <label class="template-day-label" for="wd-${wd}">${name}</label>
      <div class="form-group" style="margin:0">
        <input type="time" id="ts-${wd}" value="${ts}" ${!on ? 'disabled' : ''}/>
      </div>
      <div class="form-group" style="margin:0">
        <input type="time" id="te-${wd}" value="${te}" ${!on ? 'disabled' : ''}/>
      </div>
      <span style="font-size:11px;color:var(--muted)">${t ? statusLabel(t.status) : ''}</span>
    `;
    rows.appendChild(row);
  });

  openModal('template-modal');
}

function toggleDay(wd) {
  const on = document.getElementById('wd-' + wd).checked;
  document.getElementById('ts-' + wd).disabled = !on;
  document.getElementById('te-' + wd).disabled = !on;
}

function statusLabel(s) {
  return {pending:'⏳ Ожидание', approved:'✓ Одобрено', rejected:'✗ Отклонено'}[s] || s;
}

async function saveTemplate() {
  const entries = [];
  for (let wd = 0; wd < 7; wd++) {
    const cb = document.getElementById('wd-' + wd);
    if (cb && cb.checked) {
      entries.push({
        weekday:    wd,
        time_start: document.getElementById('ts-' + wd).value,
        time_end:   document.getElementById('te-' + wd).value,
      });
    }
  }

  const res = await fetch('/api/template', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(entries),
  });
  const data = await res.json();

  if (res.ok) {
    closeModal('template-modal');
    loadSchedule();
  } else {
    alert(data.error || 'Ошибка сохранения');
  }
}

// ===== Change request modal =====
function prefillRequest(date) {
  document.getElementById('req-date').value = date;
  openRequestModal();
}

function openRequestModal() {
  document.getElementById('req-error').classList.add('hidden');
  openModal('request-modal');
}

async function submitRequest() {
  const errEl = document.getElementById('req-error');
  const payload = {
    target_date: document.getElementById('req-date').value,
    new_start:   document.getElementById('req-start').value,
    new_end:     document.getElementById('req-end').value,
    reason:      document.getElementById('req-reason').value.trim(),
  };

  const res  = await fetch('/api/change-requests', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (res.ok) {
    closeModal('request-modal');
    document.getElementById('req-reason').value = '';
    loadMyRequests();
  } else {
    errEl.textContent = data.error || 'Ошибка';
    errEl.classList.remove('hidden');
  }
}

// ===== My requests =====
async function loadMyRequests() {
  const res  = await fetch('/api/change-requests');
  const list = await res.json();
  const el   = document.getElementById('requests-list');

  if (!list.length) {
    el.innerHTML = '<p class="muted-text">Нет запросов</p>';
    return;
  }

  const STATUS = {pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected'};
  const SL     = {pending:'Ожидание', approved:'Одобрено', rejected:'Отклонено'};

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Дата</th><th>Новое время</th><th>Причина</th><th>Статус</th><th>Примечание</th>
        </tr></thead>
        <tbody>
          ${list.map(r => `<tr>
            <td>${r.target_date}</td>
            <td>${r.new_start.slice(0,5)} — ${r.new_end.slice(0,5)}</td>
            <td>${r.reason}</td>
            <td><span class="badge ${STATUS[r.status]}">${SL[r.status]}</span></td>
            <td style="color:var(--muted)">${r.manager_note || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ===== Modal helpers =====
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
});
