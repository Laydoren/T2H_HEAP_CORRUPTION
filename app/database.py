import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'schedule.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def log_action(conn, actor_login, action, details=''):
    conn.execute(
        "INSERT INTO Logs (actor_login, action, details) VALUES (?,?,?)",
        (actor_login, action, details)
    )


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS Users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            login    TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Employees (
            login      TEXT NOT NULL UNIQUE,
            first_name TEXT NOT NULL,
            last_name  TEXT NOT NULL,
            patronymic TEXT NOT NULL,
            role       TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'employee')),
            FOREIGN KEY(login) REFERENCES Users(login)
        );

        -- Weekly repeating template: one row per weekday (0=Mon..6=Sun)
        CREATE TABLE IF NOT EXISTS WeeklyTemplate (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            login      TEXT NOT NULL,
            weekday    INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
            time_start TEXT NOT NULL,
            time_end   TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'pending'
                           CHECK(status IN ('pending','approved','rejected')),
            manager_note TEXT DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(login, weekday),
            FOREIGN KEY(login) REFERENCES Users(login)
        );

        -- Requests to change a specific date override (not the template)
        CREATE TABLE IF NOT EXISTS ChangeRequests (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            login        TEXT NOT NULL,
            target_date  TEXT NOT NULL,
            new_start    TEXT NOT NULL,
            new_end      TEXT NOT NULL,
            reason       TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending'
                             CHECK(status IN ('pending','approved','rejected')),
            manager_note TEXT DEFAULT '',
            created_at   TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(login) REFERENCES Users(login)
        );

        -- Date-specific overrides (set by admin or from approved ChangeRequest)
        CREATE TABLE IF NOT EXISTS ScheduleOverrides (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            login      TEXT NOT NULL,
            date       TEXT NOT NULL,
            time_start TEXT NOT NULL,
            time_end   TEXT NOT NULL,
            note       TEXT DEFAULT '',
            UNIQUE(login, date),
            FOREIGN KEY(login) REFERENCES Users(login)
        );

        -- Meetings created by managers
        CREATE TABLE IF NOT EXISTS Meetings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            description TEXT DEFAULT '',
            date        TEXT NOT NULL,
            time_start  TEXT NOT NULL,
            time_end    TEXT NOT NULL,
            created_by  TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(created_by) REFERENCES Users(login)
        );

        -- Meeting participants (empty = everyone sees it)
        CREATE TABLE IF NOT EXISTS MeetingParticipants (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id INTEGER NOT NULL,
            login      TEXT NOT NULL,
            UNIQUE(meeting_id, login),
            FOREIGN KEY(meeting_id) REFERENCES Meetings(id)
        );

        -- Audit log
        CREATE TABLE IF NOT EXISTS Logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_login TEXT NOT NULL,
            action      TEXT NOT NULL,
            details     TEXT DEFAULT '',
            ts          TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    _seed_demo_users(conn)
    conn.close()


def _seed_demo_users(conn):
    exists = conn.execute("SELECT COUNT(*) FROM Users").fetchone()[0]
    if exists:
        return

    demo = [
        ('admin',    'admin123',   'Иван',    'Администратов', 'Иванович',   'admin'),
        ('manager1', 'manager123', 'Мария',   'Руководова',    'Петровна',   'manager'),
        ('user1',    'user123',    'Алексей', 'Сотрудников',   'Сергеевич',  'employee'),
        ('user2',    'user123',    'Елена',   'Работова',      'Андреевна',  'employee'),
    ]

    for login, password, first_name, last_name, patronymic, role in demo:
        hashed = generate_password_hash(password)
        conn.execute("INSERT INTO Users (login, password) VALUES (?,?)", (login, hashed))
        conn.execute(
            "INSERT INTO Employees (login,first_name,last_name,patronymic,role) VALUES (?,?,?,?,?)",
            (login, first_name, last_name, patronymic, role)
        )

    # Seed a sample weekly template for user1 (approved)
    for wd in [0, 1, 2, 3, 4]:  # Mon-Fri
        conn.execute(
            "INSERT INTO WeeklyTemplate (login,weekday,time_start,time_end,status) VALUES (?,?,?,?,?)",
            ('user1', wd, '09:00', '18:00', 'approved')
        )
    conn.commit()
    log_action(conn, 'system', 'SEED', 'Demo users and sample schedule created')
    conn.commit()
