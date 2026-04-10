# HR Schedule Hub
Приложение предназначено для:
- сбора индивидуального графика работы сотрудников;
- автоматизации процесса планирования и учета рабочего графика сотрудников.

## Структура
### Авторизация:
- Авторизация сотрудников, руководителей и менеджеров.
### Роли пользователей:
#### Администратор
- Добавление новых пользователей
- Изменение ролей пользователей (менеджер / пользователь)
#### Менеджер
- Подтверждение или отклонение графиков работы сотрудников
- Указание причины отклонения графика
- Создание собраний
- Управление изменениями графика
#### Сотрудник
- Составление индивидуального графика работы
- Отправка графика на подтверждение менеджеру
- Отправка запроса на изменение графика с указанием причины

## Работа с графиком
- График синхронизируется с базой данных
- Все изменения сохраняются и отслеживаются
- Поддержка запросов на изменение расписания

## Собрания
- Менеджер может создавать собрания
- Можно указать, кто низ сотрудников должен быть на собрании
- Уведомления о времени и участии в собрании

## Технологии
- Frontend: Vanilla JS, HTML5, CSS3
- Backend: Python 3.11, Flask 3.0
- Шаблонизатор | Jinja2 (встроен во Flask) 
- База данных | SQLite

## Основные функции приложения
- Управление пользователями и ролями
- Планирование и согласование графиков
- Интеграция собраний в расписание
- Хранение данных в базе данных

# Структура
main.py                        ← точка входа, запуск: python main.py

├── requirements.txt               ← зависимости: flask, werkzeug, openpyxl

├── schedule.db                    ← SQLite база (создаётся автоматически)

│
└── app/                           ← пакет приложения

    │
    ├── __init__.py                ← фабрика create_app(), регистрация Blueprint-ов

    ├── auth.py                    ← декораторы @login_required, @role_required

    ├── database.py                ← init_db(), get_db(), log_action(), seed-данные

    │
    ├── routes/                    ← маршруты (Blueprint-ы)

    │   ├── auth_routes.py         ← GET/POST /login, /logout

    │   ├── schedule_routes.py     ← /, /api/template, /api/schedule, /api/change-requests

    │   ├── manager_routes.py      ← /manager/*, /manager/api/export-excel

    │   └── admin_routes.py        ← /admin/*, /admin/api/users, /admin/api/logs

    │

    ├── templates/                 ← Jinja2 HTML-шаблоны

    │   ├── base.html              ← базовый шаблон (подключает CSS)

    │   ├── app_shell.html         ← шаблон с боковым меню (расширяют все страницы приложения)

    │   ├── login.html             ← страница входа

    │   ├── schedule.html          ← личный график сотрудника

    │   ├── manager.html           ← панель руководителя

    │   └── admin.html             ← панель администратора

    │

    └── static/                    ← статические файлы

        ├── css/

        │   ├── style.css          ← глобальные стили, страница входа, модальные окна

        │   └── app.css            ← стили приложения: sidebar, таблицы, сетка графика

        └── js/

            ├── schedule.js        ← логика страницы сотрудника (календарь, шаблон, запросы)

            ├── manager.js         ← логика панели менеджера (одобрения, собрания, экспорт)

            └── admin.js           ← логика панели админа (пользователи, расписание, логи)
            
# База данных
## Users
  id          INTEGER  PRIMARY KEY

  login       TEXT     UNIQUE

  password    TEXT     (bcrypt-хэш)


## Employees
  login       TEXT   Users.login

  first_name  TEXT

  last_name   TEXT

  patronymic  TEXT

  role        TEXT  CHECK IN ('admin', 'manager', 'employee')

## WeeklyTemplate  ← еженедельный шаблон сотрудника
  id          INTEGER  PRIMARY KEY

  login       TEXT  → Users.login

  weekday     INTEGER  0=Пн … 6=Вс

  time_start  TEXT     'HH:MM'

  time_end    TEXT     'HH:MM'

  status      TEXT  CHECK IN ('pending', 'approved', 'rejected')

  manager_note TEXT

## ScheduleOverrides  переопределения на конкретную дату

  id          INTEGER  PRIMARY KEY

  login       TEXT   Users.login

  date        TEXT     'YYYY-MM-DD'  UNIQUE per login

  time_start  TEXT

  time_end    TEXT

  note        TEXT

## ChangeRequests   запросы сотрудника на изменение
  id          INTEGER  PRIMARY KEY

  login       TEXT   Users.login

  target_date TEXT

  new_start   TEXT

  new_end     TEXT

  reason      TEXT

  status      TEXT  CHECK IN ('pending', 'approved', 'rejected')

  manager_note TEXT

  created_at  TEXT

## Meetings  собрания (создаёт менеджер)
  id          INTEGER  PRIMARY KEY

  title       TEXT

  description TEXT

  date        TEXT

  time_start  TEXT

  time_end    TEXT

  created_by  TEXT  Users.login

  created_at  TEXT

## MeetingParticipants участники собрания (пусто = все)

  id          INTEGER  PRIMARY KEY

  meeting_id  INTEGER  → Meetings.id

  login       TEXT  → Users.login

## Logs журнал всех действий

  id          INTEGER  PRIMARY KEY

  actor_login TEXT

  action      TEXT

  details     TEXT

  ts          TEXT     (datetime)
