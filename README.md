# HR Schedule HUB

Веб-приложение для планирования и учёта рабочих графиков сотрудников.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Backend | Python 3.11, Flask 3.0 |
| Шаблонизатор | Jinja2 (встроен во Flask) |
| База данных | SQLite (файл `schedule.db`) |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Экспорт | openpyxl (Excel .xlsx) |

---

## База данных

```
Users ──────────────────────────────────────────────
  id          INTEGER  PRIMARY KEY
  login       TEXT     UNIQUE
  password    TEXT     (bcrypt-хэш)

Employees ──────────────────────────────────────────
  login       TEXT  → Users.login
  first_name  TEXT
  last_name   TEXT
  patronymic  TEXT
  role        TEXT  CHECK IN ('admin', 'manager', 'employee')

WeeklyTemplate ─────────────────────────────────────  ← еженедельный шаблон сотрудника
  id          INTEGER  PRIMARY KEY
  login       TEXT  → Users.login
  weekday     INTEGER  0=Пн … 6=Вс
  time_start  TEXT     'HH:MM'
  time_end    TEXT     'HH:MM'
  status      TEXT  CHECK IN ('pending', 'approved', 'rejected')
  manager_note TEXT

ScheduleOverrides ──────────────────────────────────  ← переопределения на конкретную дату
  id          INTEGER  PRIMARY KEY
  login       TEXT  → Users.login
  date        TEXT     'YYYY-MM-DD'  UNIQUE per login
  time_start  TEXT
  time_end    TEXT
  note        TEXT

ChangeRequests ─────────────────────────────────────  ← запросы сотрудника на изменение
  id          INTEGER  PRIMARY KEY
  login       TEXT  → Users.login
  target_date TEXT
  new_start   TEXT
  new_end     TEXT
  reason      TEXT
  status      TEXT  CHECK IN ('pending', 'approved', 'rejected')
  manager_note TEXT
  created_at  TEXT

Meetings ───────────────────────────────────────────  ← собрания (создаёт менеджер)
  id          INTEGER  PRIMARY KEY
  title       TEXT
  description TEXT
  date        TEXT
  time_start  TEXT
  time_end    TEXT
  created_by  TEXT  → Users.login
  created_at  TEXT

MeetingParticipants ────────────────────────────────  ← участники собрания (пусто = все)
  id          INTEGER  PRIMARY KEY
  meeting_id  INTEGER  → Meetings.id
  login       TEXT  → Users.login

Logs ───────────────────────────────────────────────  ← журнал всех действий
  id          INTEGER  PRIMARY KEY
  actor_login TEXT
  action      TEXT
  details     TEXT
  ts          TEXT     (datetime)
```

---

## Роли и доступ

| Роль | Что может |
|------|-----------|
| **employee** | Составлять еженедельный шаблон, просматривать свой график, отправлять запросы на изменение |
| **manager** | Одобрять/отклонять шаблоны и запросы (с причиной), создавать собрания, выгружать расписание в Excel |
| **admin** | Всё выше + управление пользователями, принудительное изменение расписания, просмотр журнала логов |

---

## Демо-аккаунты

| Логин | Пароль | Роль |
|-------|--------|------|
| `admin` | `admin123` | Администратор |
| `manager1` | `manager123` | Менеджер |
| `user1` | `user123` | Сотрудник |
| `user2` | `user123` | Сотрудник |

---

## Запуск

```bash
# 1. Установить зависимости
pip install -r requirements.txt

# 2. Запустить сервер
python main.py

# Приложение доступно по адресу:
# http://localhost:5000
```

База данных `schedule.db` создаётся автоматически при первом запуске.
Демо-пользователи добавляются автоматически, если база пустая.
