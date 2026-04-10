import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'schedule.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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

        CREATE TABLE IF NOT EXISTS Schedule (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            login      TEXT NOT NULL,
            date       TEXT NOT NULL,
            time_start TEXT NOT NULL,
            time_end   TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'planned'
                           CHECK(status IN ('planned','confirmed','cancelled')),
            FOREIGN KEY(login) REFERENCES Users(login)
        );
    """)
    conn.commit()
    _seed_demo_users(conn)
    conn.close()


def _seed_demo_users(conn):
    """Создаёт демо-пользователей, если таблица Users пуста."""
    exists = conn.execute("SELECT COUNT(*) FROM Users").fetchone()[0]
    if exists:
        return

    demo = [
        # (login, password, first_name, last_name, patronymic, role)
        ('admin',    'admin123',    'Иван',   'Администратов', 'Иванович',  'admin'),
        ('manager1', 'manager123',  'Мария',  'Руководова',    'Петровна',  'manager'),
        ('user1',    'user123',     'Алексей','Сотрудников',   'Сергеевич', 'employee'),
        ('user2',    'user123',     'Елена',  'Работова',      'Андреевна', 'employee'),
    ]

    for login, password, first_name, last_name, patronymic, role in demo:
        hashed = generate_password_hash(password)
        conn.execute("INSERT INTO Users (login, password) VALUES (?, ?)", (login, hashed))
        conn.execute(
            "INSERT INTO Employees (login, first_name, last_name, patronymic, role) VALUES (?,?,?,?,?)",
            (login, first_name, last_name, patronymic, role)
        )
    conn.commit()
