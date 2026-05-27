from flask import Blueprint, render_template, request, session, jsonify
from werkzeug.security import generate_password_hash
from app.database import get_db, log_action
from app.auth import role_required

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/')
@role_required('admin')
def index():
    return render_template('admin.html',
                           full_name=session['user_full_name'],
                           role=session['user_role'])


# ── Users ─────────────────────────────────────────────────────────────────────

@admin_bp.route('/api/users', methods=['GET'])
@role_required('admin')
def list_users():
    db   = get_db()
    rows = db.execute(
        "SELECT e.login, e.first_name, e.last_name, e.patronymic, e.role "
        "FROM Employees e ORDER BY e.last_name"
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@admin_bp.route('/api/users', methods=['POST'])
@role_required('admin')
def create_user():
    data       = request.get_json() or {}
    login      = (data.get('login') or '').strip()
    password   = (data.get('password') or '').strip()
    first_name = (data.get('first_name') or '').strip()
    last_name  = (data.get('last_name') or '').strip()
    patronymic = (data.get('patronymic') or '').strip()
    role       = (data.get('role') or 'employee').strip()

    if not all([login, password, first_name, last_name, patronymic]):
        return jsonify({'error': 'Заполните все поля'}), 400
    if role not in ('admin', 'manager', 'employee'):
        return jsonify({'error': 'Недопустимая роль'}), 400

    db = get_db()
    if db.execute("SELECT id FROM Users WHERE login=?", (login,)).fetchone():
        db.close()
        return jsonify({'error': 'Логин уже занят'}), 409

    hashed = generate_password_hash(password)
    db.execute("INSERT INTO Users (login,password) VALUES (?,?)", (login, hashed))
    db.execute(
        "INSERT INTO Employees (login,first_name,last_name,patronymic,role) VALUES (?,?,?,?,?)",
        (login, first_name, last_name, patronymic, role)
    )
    log_action(db, session['user_login'], 'USER_CREATE',
               f"login={login} role={role}")
    db.commit()
    db.close()
    return jsonify({'ok': True, 'login': login}), 201


@admin_bp.route('/api/users/<ulogin>/role', methods=['PATCH'])
@role_required('admin')
def change_role(ulogin):
    new_role = ((request.get_json() or {}).get('role') or '').strip()
    if new_role not in ('admin', 'manager', 'employee'):
        return jsonify({'error': 'Недопустимая роль'}), 400

    db = get_db()
    if not db.execute("SELECT login FROM Employees WHERE login=?", (ulogin,)).fetchone():
        db.close()
        return jsonify({'error': 'Пользователь не найден'}), 404
    db.execute("UPDATE Employees SET role=? WHERE login=?", (new_role, ulogin))
    log_action(db, session['user_login'], 'USER_ROLE_CHANGE',
               f"login={ulogin} new_role={new_role}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


@admin_bp.route('/api/users/<ulogin>', methods=['DELETE'])
@role_required('admin')
def delete_user(ulogin):
    if ulogin == session['user_login']:
        return jsonify({'error': 'Нельзя удалить себя'}), 400
    db = get_db()
    if not db.execute("SELECT login FROM Users WHERE login=?", (ulogin,)).fetchone():
        db.close()
        return jsonify({'error': 'Не найдено'}), 404
    db.execute("DELETE FROM MeetingParticipants WHERE login=?", (ulogin,))
    db.execute("DELETE FROM ChangeRequests WHERE login=?", (ulogin,))
    db.execute("DELETE FROM ScheduleOverrides WHERE login=?", (ulogin,))
    db.execute("DELETE FROM WeeklyTemplate WHERE login=?", (ulogin,))
    db.execute("DELETE FROM Employees WHERE login=?", (ulogin,))
    db.execute("DELETE FROM Users WHERE login=?", (ulogin,))
    log_action(db, session['user_login'], 'USER_DELETE', f"login={ulogin}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


@admin_bp.route('/api/users/<ulogin>/password', methods=['PATCH'])
@role_required('admin')
def reset_password(ulogin):
    new_pw = ((request.get_json() or {}).get('password') or '').strip()
    if not new_pw or len(new_pw) < 4:
        return jsonify({'error': 'Пароль должен быть не менее 4 символов'}), 400
    db = get_db()
    db.execute("UPDATE Users SET password=? WHERE login=?",
               (generate_password_hash(new_pw), ulogin))
    log_action(db, session['user_login'], 'USER_PASSWORD_RESET', f"login={ulogin}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── Force override schedule ───────────────────────────────────────────────────

@admin_bp.route('/api/users/<ulogin>/schedule', methods=['GET'])
@role_required('admin')
def get_user_schedule(ulogin):
    db   = get_db()
    tmpl = db.execute(
        "SELECT * FROM WeeklyTemplate WHERE login=? ORDER BY weekday", (ulogin,)
    ).fetchall()
    ovrd = db.execute(
        "SELECT * FROM ScheduleOverrides WHERE login=? ORDER BY date", (ulogin,)
    ).fetchall()
    db.close()
    return jsonify({'template': [dict(r) for r in tmpl],
                    'overrides': [dict(r) for r in ovrd]})


@admin_bp.route('/api/users/<ulogin>/override', methods=['POST'])
@role_required('admin')
def force_override(ulogin):
    data  = request.get_json() or {}
    date  = (data.get('date') or '').strip()
    ts    = (data.get('time_start') or '').strip()
    te    = (data.get('time_end') or '').strip()
    note  = (data.get('note') or '').strip()

    if not all([date, ts, te]):
        return jsonify({'error': 'Укажите дату и время'}), 400
    if ts >= te:
        return jsonify({'error': 'Начало должно быть раньше конца'}), 400

    db = get_db()
    db.execute("""
        INSERT INTO ScheduleOverrides (login, date, time_start, time_end, note)
        VALUES (?,?,?,?,?)
        ON CONFLICT(login, date) DO UPDATE SET
          time_start=excluded.time_start, time_end=excluded.time_end, note=excluded.note
    """, (ulogin, date, ts, te, note or 'Принудительное изменение (admin)'))
    log_action(db, session['user_login'], 'ADMIN_FORCE_OVERRIDE',
               f"login={ulogin} date={date} {ts}-{te}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


@admin_bp.route('/api/users/<ulogin>/override/<date>', methods=['DELETE'])
@role_required('admin')
def delete_override(ulogin, date):
    db = get_db()
    db.execute("DELETE FROM ScheduleOverrides WHERE login=? AND date=?", (ulogin, date))
    log_action(db, session['user_login'], 'ADMIN_DELETE_OVERRIDE',
               f"login={ulogin} date={date}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── Logs ──────────────────────────────────────────────────────────────────────

@admin_bp.route('/api/logs', methods=['GET'])
@role_required('admin')
def get_logs():
    limit  = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    db     = get_db()
    rows   = db.execute(
        "SELECT * FROM Logs ORDER BY ts DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    total = db.execute("SELECT COUNT(*) FROM Logs").fetchone()[0]
    db.close()
    return jsonify({'logs': [dict(r) for r in rows], 'total': total})
