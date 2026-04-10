from flask import Blueprint, render_template, request, session, redirect, url_for, flash
from werkzeug.security import check_password_hash
from app.database import get_db, log_action

auth = Blueprint('auth', __name__)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_login' in session:
        role = session.get('user_role')
        if role == 'admin':    return redirect(url_for('admin.index'))
        if role == 'manager':  return redirect(url_for('manager.index'))
        return redirect(url_for('schedule.index'))

    if request.method == 'POST':
        login_val = request.form.get('login', '').strip()
        password  = request.form.get('password', '')

        db   = get_db()
        user = db.execute(
            "SELECT u.login, u.password, e.role, e.first_name, e.last_name "
            "FROM Users u JOIN Employees e ON u.login = e.login "
            "WHERE u.login = ?", (login_val,)
        ).fetchone()

        if user and check_password_hash(user['password'], password):
            session['user_login']     = user['login']
            session['user_role']      = user['role']
            session['user_full_name'] = f"{user['last_name']} {user['first_name']}"
            log_action(db, user['login'], 'LOGIN', f"role={user['role']}")
            db.commit()
            db.close()
            if user['role'] == 'admin':    return redirect(url_for('admin.index'))
            if user['role'] == 'manager':  return redirect(url_for('manager.index'))
            return redirect(url_for('schedule.index'))

        db.close()
        flash('Неверный логин или пароль')

    return render_template('login.html')


@auth.route('/logout')
def logout():
    if 'user_login' in session:
        db = get_db()
        log_action(db, session['user_login'], 'LOGOUT', '')
        db.commit()
        db.close()
    session.clear()
    return redirect(url_for('auth.login'))
