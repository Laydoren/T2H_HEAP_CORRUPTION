from functools import wraps
from flask import session, redirect, url_for


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_login' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_login' not in session:
                return redirect(url_for('auth.login'))
            if session.get('user_role') not in roles:
                return redirect(url_for('schedule.index'))
            return f(*args, **kwargs)
        return decorated
    return decorator
