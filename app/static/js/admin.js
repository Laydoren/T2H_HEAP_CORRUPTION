// ===== Tab system =====
document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'users')     loadUsers();
    if (btn.dataset.tab === 'schedules') loadScheduleUsers();
    if (btn.dataset.tab === 'logs')      loadLogs();
  });
});

// Handle hash anchor
if (location.hash === '#logs') {
  document.querySelector('[data-tab="logs"]').click();
} else {
  loadUsers();
}

// ===== Users =====
async function loadUsers() {
  const res   = await fetch('/admin/api/users');
  const users = await res.json();
  const el    = document.getElementById('users-content');

  const rows = users.map(u => `
    <tr>
      <td><strong>${u.last_name} ${u.first_name}</strong><br>
          <span style="color:var(--muted);font-size:12px">${u.patronymic}</span></td>
      <td style="color:var(--cyan);font-family:monospace">${u.login}</td>
      <td><span class="badge badge-${u.role}">${u.role}</span></td>
      <td>
        <div class="action-row">
          <button class="btn-ghost btn-sm" onclick="openRoleModal('${u.login}','${u.role}','${u.last_name} ${u.first_name}')">Роль</button>
          <button class="btn-ghost btn-sm" onclick="openPwModal('${u.login}','${u.last_name} ${u.first_name}')">Пароль</button>
          <button class="btn-danger btn-sm" onclick="deleteUser('${u.login}','${u.last_name} ${u.first_name}')">Удалить</button>
        </div>
      </td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Действия</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ===== Create user =====
function openCreateUserModal() {
  document.getElementById('cu-error').classList.add('hidden');
  ['cu-last','cu-first','cu-patronymic','cu-login','cu-password'].forEach(id => {
    document.getElementById(id).value = '';
  });
  openModal('create-user-modal');
}

async function createUser() {
  const errEl = document.getElementById('cu-error');
  const payload = {
    last_name:  document.getElementById('cu-last').value.trim(),
    first_name: document.getElementById('cu-first').value.trim(),
    patronymic: document.getElementById('cu-patronymic').value.trim() || '—',
    login:      document.getElementById('cu-login').value.trim(),
    password:   document.getElementById('cu-password').value,
    role:       document.getElementById('cu-role').value,
  };

  const res  = await fetch('/admin/api/users', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (res.ok) {
    closeModal('create-user-modal');
    loadUsers();
  } else {
    errEl.textContent = data.error || 'Ошибка';
    errEl.classList.remove('hidden');
  }
}

// ===== Role modal =====
let _roleLogin = null;

function openRoleModal(login, currentRole, name) {
  _roleLogin = login;
  document.getElementById('role-modal-user').textContent = `Пользователь: ${name} (${login})`;
  document.getElementById('role-select').value = currentRole;
  openModal('role-modal');
}

async function submitRoleChange() {
  const role = document.getElementById('role-select').value;
  const res  = await fetch(`/admin/api/users/${_roleLogin}/role`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({role}),
  });
  if (res.ok) { closeModal('role-modal'); loadUsers(); }
  else        { const d = await res.json(); alert(d.error); }
}

// ===== Delete user =====
async function deleteUser(login, name) {
  if (!confirm(`Удалить пользователя "${name}" (${login})? Это действие необратимо.`)) return;
  const res = await fetch(`/admin/api/users/${login}`, {method:'DELETE'});
  if (res.ok) loadUsers();
  else { const d = await res.json(); alert(d.error); }
}

// ===== Password reset =====
let _pwLogin = null;

function openPwModal(login, name) {
  _pwLogin = login;
  document.getElementById('pw-error').classList.add('hidden');
  document.getElementById('pw-user').textContent = `Пользователь: ${name} (${login})`;
  document.getElementById('pw-new').value = '';
  openModal('pw-modal');
}

async function submitPasswordReset() {
  const pw    = document.getElementById('pw-new').value;
  const errEl = document.getElementById('pw-error');
  const res   = await fetch(`/admin/api/users/${_pwLogin}/password`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({password: pw}),
  });
  if (res.ok) { closeModal('pw-modal'); }
  else { const d = await res.json(); errEl.textContent = d.error; errEl.classList.remove('hidden'); }
}

// ===== Schedule admin =====
let _ovLogin = null;

async function loadScheduleUsers() {
  const res   = await fetch('/admin/api/users');
  const users = await res.json();
  const sel   = document.getElementById('sched-user-select');
  sel.innerHTML = '<option value="">— Выберите —</option>' +
    users.map(u => `<option value="${u.login}">${u.last_name} ${u.first_name}</option>`).join('');
}

async function loadUserSchedule() {
  const login = document.getElementById('sched-user-select').value;
  if (!login) return;

  const res  = await fetch(`/admin/api/users/${login}/schedule`);
  const data = await res.json();
  const el   = document.getElementById('schedule-admin-content');

  const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const STATUS = {approved:'badge-approved', pending:'badge-pending', rejected:'badge-rejected'};
  const SL     = {approved:'Одобрено', pending:'Ожидание', rejected:'Отклонено'};

  const tmplRows = data.template.length
    ? data.template.map(t => `<tr>
        <td>${DAYS[t.weekday]}</td>
        <td>${t.time_start.slice(0,5)} — ${t.time_end.slice(0,5)}</td>
        <td><span class="badge ${STATUS[t.status]}">${SL[t.status]}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="color:var(--muted)">Нет шаблона</td></tr>';

  const ovRows = data.overrides.length
    ? data.overrides.map(o => `
        <div class="override-item">
          <span class="ov-date">${o.date}</span>
          <span class="ov-time">${o.time_start.slice(0,5)} — ${o.time_end.slice(0,5)}</span>
          <span class="ov-note">${o.note || ''}</span>
          <button class="btn-danger btn-sm" onclick="deleteOverride('${login}','${o.date}')">×</button>
        </div>`).join('')
    : '<p class="muted-text" style="padding:8px 0">Нет переопределений</p>';

  el.innerHTML = `
    <div class="data-table-wrap" style="margin-bottom:20px">
      <table class="data-table">
        <thead><tr><th>День</th><th>Время</th><th>Статус</th></tr></thead>
        <tbody>${tmplRows}</tbody>
      </table>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h3 style="font-size:15px;font-weight:700">Переопределения на даты</h3>
      <button class="btn-primary btn-sm" onclick="openOverrideModal('${login}')">+ Добавить</button>
    </div>
    <div class="override-list">${ovRows}</div>`;
}

function openOverrideModal(login) {
  _ovLogin = login;
  document.getElementById('ov-error').classList.add('hidden');
  document.getElementById('ov-user').textContent =
    `Сотрудник: ${document.getElementById('sched-user-select').selectedOptions[0].text}`;
  openModal('override-modal');
}

async function submitOverride() {
  const errEl = document.getElementById('ov-error');
  const payload = {
    date:       document.getElementById('ov-date').value,
    time_start: document.getElementById('ov-start').value,
    time_end:   document.getElementById('ov-end').value,
    note:       document.getElementById('ov-note').value.trim(),
  };
  const res  = await fetch(`/admin/api/users/${_ovLogin}/override`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (res.ok) { closeModal('override-modal'); loadUserSchedule(); }
  else { errEl.textContent = data.error; errEl.classList.remove('hidden'); }
}

async function deleteOverride(login, date) {
  if (!confirm(`Удалить переопределение на ${date}?`)) return;
  await fetch(`/admin/api/users/${login}/override/${date}`, {method:'DELETE'});
  loadUserSchedule();
}

// ===== Logs =====
async function loadLogs() {
  const res  = await fetch('/admin/api/logs?limit=200');
  const data = await res.json();
  const el   = document.getElementById('logs-content');

  if (!data.logs.length) { el.innerHTML = '<p class="muted-text">Нет записей</p>'; return; }

  const rows = data.logs.map(l => `
    <div class="log-entry">
      <span class="log-ts">${l.ts}</span>
      <span class="log-actor">${l.actor_login}</span>
      <span class="log-action">${l.action}</span>
      <span class="log-detail">${l.details || ''}</span>
    </div>`).join('');

  el.innerHTML = `
    <div class="logs-wrap">
      <div class="logs-header">
        <span>Время</span><span>Пользователь</span><span>Действие</span><span>Детали</span>
      </div>
      ${rows}
    </div>
    <p style="margin-top:10px;color:var(--muted);font-size:12px">Показано ${data.logs.length} из ${data.total}</p>`;
}

// ===== Modal helpers =====
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
});
