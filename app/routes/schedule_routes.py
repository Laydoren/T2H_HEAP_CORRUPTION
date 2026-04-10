from flask import Blueprint, render_template, request, session, jsonify
from app.database import get_db, log_action
from app.auth import login_required
from datetime import date, timedelta

schedule = Blueprint('schedule', __name__)


def _get_meetings_for_user(db, login, date_from, date_to):
    rows = db.execute("""
        SELECT m.* FROM Meetings m
        WHERE m.date BETWEEN ? AND ?
          AND (
            NOT EXISTS (SELECT 1 FROM MeetingParticipants mp WHERE mp.meeting_id = m.id)
            OR EXISTS (SELECT 1 FROM MeetingParticipants mp WHERE mp.meeting_id = m.id AND mp.login = ?)
          )
        ORDER BY m.date, m.time_start
    """, (date_from, date_to, login)).fetchall()
    return [dict(r) for r in rows]


@schedule.route('/')
@login_required
def index():
    return render_template('schedule.html',
                           full_name=session['user_full_name'],
                           role=session['user_role'])


# ── Weekly template ──────────────────────────────────────────────────────────

@schedule.route('/api/template', methods=['GET'])
@login_required
def get_template():
    login = session['user_login']
    db    = get_db()
    rows  = db.execute(
        "SELECT * FROM WeeklyTemplate WHERE login=? ORDER BY weekday", (login,)
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@schedule.route('/api/template', methods=['POST'])
@login_required
def save_template():
    login = session['user_login']
    data  = request.get_json()  # list of {weekday, time_start, time_end}

    db = get_db()
    submitted_weekdays = []
    for entry in data:
        wd = int(entry['weekday'])
        ts = entry['time_start']
        te = entry['time_end']
        submitted_weekdays.append(wd)
        if ts >= te:
            db.close()
            return jsonify({'error': f'День {wd}: начало должно быть раньше конца'}), 400

        existing = db.execute(
            "SELECT id, status FROM WeeklyTemplate WHERE login=? AND weekday=?", (login, wd)
        ).fetchone()

        if existing:
            new_status = 'pending' if existing['status'] == 'approved' else existing['status']
            db.execute(
                "UPDATE WeeklyTemplate SET time_start=?,time_end=?,status=?,"
                "manager_note='',updated_at=datetime('now') WHERE login=? AND weekday=?",
                (ts, te, new_status, login, wd)
            )
        else:
            db.execute(
                "INSERT INTO WeeklyTemplate (login,weekday,time_start,time_end) VALUES (?,?,?,?)",
                (login, wd, ts, te)
            )

    for wd in range(7):
        if wd not in submitted_weekdays:
            db.execute("DELETE FROM WeeklyTemplate WHERE login=? AND weekday=?", (login, wd))

    log_action(db, login, 'TEMPLATE_UPDATE', f"weekdays={submitted_weekdays}")
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── Computed schedule view ────────────────────────────────────────────────────

@schedule.route('/api/schedule')
@login_required
def get_schedule():
    login       = session['user_login']
    week_offset = int(request.args.get('week_offset', 0))

    today    = date.today()
    monday   = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
    sunday   = monday + timedelta(days=6)
    date_from = monday.isoformat()
    date_to   = sunday.isoformat()

    db = get_db()
    template = {r['weekday']: dict(r) for r in db.execute(
        "SELECT * FROM WeeklyTemplate WHERE login=? AND status='approved'", (login,)
    )}
    pending = {r['weekday']: dict(r) for r in db.execute(
        "SELECT * FROM WeeklyTemplate WHERE login=? AND status!='approved'", (login,)
    )}
    overrides = {r['date']: dict(r) for r in db.execute(
        "SELECT * FROM ScheduleOverrides WHERE login=? AND date BETWEEN ? AND ?",
        (login, date_from, date_to)
    )}
    meetings = _get_meetings_for_user(db, login, date_from, date_to)
    db.close()

    days = []
    cur  = monday
    while cur <= sunday:
        iso = cur.isoformat()
        wd  = cur.weekday()
        day = {'date': iso, 'weekday': wd, 'shift': None,
               'override': False, 'pending': None, 'meetings': []}

        if iso in overrides:
            day['shift']    = overrides[iso]
            day['override'] = True
        elif wd in template:
            day['shift'] = template[wd]

        if wd in pending:
            day['pending'] = pending[wd]

        day['meetings'] = [m for m in meetings if m['date'] == iso]
        days.append(day)
        cur += timedelta(days=1)

    return jsonify({'days': days, 'date_from': date_from, 'date_to': date_to})


# ── Change requests ───────────────────────────────────────────────────────────

@schedule.route('/api/change-requests', methods=['GET'])
@login_required
def list_change_requests():
    login = session['user_login']
    db    = get_db()
    rows  = db.execute(
        "SELECT * FROM ChangeRequests WHERE login=? ORDER BY created_at DESC", (login,)
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@schedule.route('/api/change-requests', methods=['POST'])
@login_required
def create_change_request():
    login = session['user_login']
    data  = request.get_json()
    target_date = data.get('target_date', '').strip()
    new_start   = data.get('new_start', '').strip()
    new_end     = data.get('new_end', '').strip()
    reason      = data.get('reason', '').strip()

    if not all([target_date, new_start, new_end, reason]):
        return jsonify({'error': 'Заполните все поля и укажите причину'}), 400
    if new_start >= new_end:
        return jsonify({'error': 'Время начала должно быть раньше конца'}), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO ChangeRequests (login,target_date,new_start,new_end,reason) VALUES (?,?,?,?,?)",
        (login, target_date, new_start, new_end, reason)
    )
    log_action(db, login, 'CHANGE_REQUEST', f"date={target_date} {new_start}-{new_end}")
    db.commit()
    row = db.execute("SELECT * FROM ChangeRequests WHERE id=?", (cur.lastrowid,)).fetchone()
    db.close()
    return jsonify(dict(row)), 201
