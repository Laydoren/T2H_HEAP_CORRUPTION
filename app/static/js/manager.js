// ===== Tab system =====
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// Init export date range to current 2 weeks
(function initExportDates() {
  const today  = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() || 7) - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 13);
  const toISO = d => d.toISOString().split('T')[0];
  const fromEl = document.getElementById('export-from');
  const toEl   = document.getElementById('export-to');
  if (fromEl) fromEl.value = toISO(monday);
  if (toEl)   toEl.value   = toISO(sunday);
})();

document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');

    if (btn.dataset.tab === 'overview')  loadOverview();
    if (btn.dataset.tab === 'approvals') loadPending();
    if (btn.dataset.tab === 'requests')  loadChangeRequests();
    if (btn.dataset.tab === 'meetings')  loadMeetings();
  });
});

// Handle hash anchor
if (location.hash === '#meetings') {
  document.querySelector('[data-tab="meetings"]').click();
} else {
  loadOverview();
}

// ===== Overview =====
async function loadOverview() {
  const [empRes, ovrRes] = await Promise.all([
    fetch('/manager/api/employees'),
    fetch('/manager/api/overview'),
  ]);
  const employees = await empRes.json();
  const shifts    = await ovrRes.json();

  const el = document.getElementById('overview-content');
  if (!employees.length) { el.innerHTML = '<p class="muted-text">Нет сотрудников</p>'; return; }

  // Build map: login -> weekday -> shift
  const map = {};
  shifts.forEach(s => {
    if (!map[s.login]) map[s.login] = {};
    map[s.login][s.weekday] = s;
  });

  const days = `<th>Сотрудник</th>` + DAYS.map(d => `<th>${d}</th>`).join('');

  const rows = employees.map(emp => {
    const cells = Array.from({length:7}, (_, wd) => {
      const s = map[emp.login]?.[wd];
      return `<td>${s
        ? `<span class="ov-shift">${s.time_start.slice(0,5)}–${s.time_end.slice(0,5)}</span>`
        : `<span class="ov-off">—</span>`}</td>`;
    }).join('');
    return `<tr><td><strong>${emp.last_name} ${emp.first_name}</strong><br>
      <span class="badge badge-${emp.role}">${emp.role}</span></td>${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="overview-table-wrap">
      <table class="overview-table">
        <thead><tr>${days}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ===== Pending templates =====
async function loadPending() {
  const res   = await fetch('/manager/api/pending-templates');
  const items = await res.json();
  const el    = document.getElementById('approvals-content');

  if (!items.length) { el.innerHTML = '<p class="muted-text">Нет ожидающих одобрения</p>'; return; }

  // Group by employee
  const grouped = {};
  items.forEach(i => {
    if (!grouped[i.login]) grouped[i.login] = { name: `${i.last_name} ${i.first_name}`, days: [] };
    grouped[i.login].days.push(i);
  });

  const STATUS = {pending:'badge-pending', rejected:'badge-rejected'};
  const SL     = {pending:'Ожидание', rejected:'Отклонено'};

  const rows = Object.entries(grouped).map(([login, g]) => {
    const dayRows = g.days.map(d => `
      <tr>
        <td>${g.name}</td>
        <td>${DAYS[d.weekday]}</td>
        <td>${d.time_start.slice(0,5)} — ${d.time_end.slice(0,5)}</td>
        <td><span class="badge ${STATUS[d.status]}">${SL[d.status]}</span></td>
        <td style="color:var(--muted)">${d.manager_note || '—'}</td>
        <td>
          <div class="action-row">
            <button class="btn-primary btn-sm" onclick="approveTemplate(${d.id})">Одобрить</button>
            <button class="btn-danger btn-sm" onclick="openReject('template',${d.id})">Отклонить</button>
          </div>
        </td>
      </tr>`).join('');
    return dayRows;
  }).join('');

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Сотрудник</th><th>День</th><th>Время</th><th>Статус</th><th>Примечание</th><th>Действие</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function approveTemplate(id) {
  const res = await fetch(`/manager/api/templates/${id}/approve`, {method:'POST'});
  if (res.ok) loadPending();
  else { const d = await res.json(); alert(d.error); }
}

// ===== Change requests =====
async function loadChangeRequests() {
  const res   = await fetch('/manager/api/change-requests');
  const items = await res.json();
  const el    = document.getElementById('requests-content');

  if (!items.length) { el.innerHTML = '<p class="muted-text">Нет запросов</p>'; return; }

  const STATUS = {pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected'};
  const SL     = {pending:'Ожидание', approved:'Одобрено', rejected:'Отклонено'};

  const rows = items.map(r => `
    <tr>
      <td>${r.last_name} ${r.first_name}</td>
      <td>${r.target_date}</td>
      <td>${r.new_start.slice(0,5)} — ${r.new_end.slice(0,5)}</td>
      <td>${r.reason}</td>
      <td><span class="badge ${STATUS[r.status]}">${SL[r.status]}</span></td>
      <td style="color:var(--muted)">${r.manager_note || '—'}</td>
      <td>${r.status === 'pending' ? `
        <div class="action-row">
          <button class="btn-primary btn-sm" onclick="approveChangeReq(${r.id})">Одобрить</button>
          <button class="btn-danger btn-sm" onclick="openReject('changereq',${r.id})">Отклонить</button>
        </div>` : '—'}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Сотрудник</th><th>Дата</th><th>Новое время</th><th>Причина</th><th>Статус</th><th>Примечание</th><th>Действие</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function approveChangeReq(id) {
  const res = await fetch(`/manager/api/change-requests/${id}/approve`, {method:'POST'});
  if (res.ok) loadChangeRequests();
  else { const d = await res.json(); alert(d.error); }
}

// ===== Reject modal =====
let _rejectType = null;
let _rejectId   = null;

function openReject(type, id) {
  _rejectType = type;
  _rejectId   = id;
  document.getElementById('reject-reason').value = '';
  document.getElementById('reject-error').classList.add('hidden');
  openModal('reject-modal');
}

async function submitReject() {
  const note  = document.getElementById('reject-reason').value.trim();
  const errEl = document.getElementById('reject-error');
  if (!note) { errEl.textContent = 'Укажите причину'; errEl.classList.remove('hidden'); return; }

  const url = _rejectType === 'template'
    ? `/manager/api/templates/${_rejectId}/reject`
    : `/manager/api/change-requests/${_rejectId}/reject`;

  const res = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({note}),
  });

  if (res.ok) {
    closeModal('reject-modal');
    if (_rejectType === 'template')   loadPending();
    else                              loadChangeRequests();
  } else {
    const d = await res.json();
    errEl.textContent = d.error || 'Ошибка';
    errEl.classList.remove('hidden');
  }
}

// ===== Meetings =====
let _allEmployees = [];

async function loadMeetings() {
  const res   = await fetch('/manager/api/meetings');
  const items = await res.json();
  const el    = document.getElementById('meetings-content');

  if (!items.length) { el.innerHTML = '<p class="muted-text">Нет собраний</p>'; return; }

  const rows = items.map(m => `
    <tr>
      <td><strong>${m.title}</strong>${m.description ? `<br><span style="color:var(--muted);font-size:12px">${m.description}</span>` : ''}</td>
      <td>${m.date}</td>
      <td>${m.time_start.slice(0,5)} — ${m.time_end.slice(0,5)}</td>
      <td>${m.participants.length ? m.participants.join(', ') : '<span style="color:var(--muted)">Все</span>'}</td>
      <td><button class="btn-danger btn-sm" onclick="deleteMeeting(${m.id})">Удалить</button></td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Название</th><th>Дата</th><th>Время</th><th>Участники</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function openMeetingModal() {
  if (!_allEmployees.length) {
    const res    = await fetch('/manager/api/employees');
    _allEmployees = await res.json();
  }

  const container = document.getElementById('participants-list');
  container.innerHTML = _allEmployees.map(e => `
    <label>
      <input type="checkbox" value="${e.login}" />
      ${e.last_name} ${e.first_name} (${e.login})
    </label>`).join('');

  document.getElementById('meeting-error').classList.add('hidden');
  openModal('meeting-modal');
}

async function submitMeeting() {
  const errEl = document.getElementById('meeting-error');
  const checked = [...document.querySelectorAll('#participants-list input:checked')]
    .map(c => c.value);

  const payload = {
    title:       document.getElementById('m-title').value.trim(),
    description: document.getElementById('m-desc').value.trim(),
    date:        document.getElementById('m-date').value,
    time_start:  document.getElementById('m-start').value,
    time_end:    document.getElementById('m-end').value,
    participants: checked,
  };

  const res  = await fetch('/manager/api/meetings', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (res.ok) {
    closeModal('meeting-modal');
    document.getElementById('m-title').value = '';
    document.getElementById('m-desc').value  = '';
    loadMeetings();
  } else {
    errEl.textContent = data.error || 'Ошибка';
    errEl.classList.remove('hidden');
  }
}

async function deleteMeeting(id) {
  if (!confirm('Удалить собрание?')) return;
  const res = await fetch(`/manager/api/meetings/${id}`, {method:'DELETE'});
  if (res.ok) loadMeetings();
}

// ===== Excel export =====
function exportExcel() {
  const from = document.getElementById('export-from').value;
  const to   = document.getElementById('export-to').value;
  if (!from || !to) { alert('Выберите период для выгрузки'); return; }
  if (from > to)    { alert('Дата начала не может быть позже даты конца'); return; }
  window.location.href = `/manager/api/export-excel?date_from=${from}&date_to=${to}`;
}

// ===== Modal helpers =====
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
});
