from flask import Flask
from app.database import init_db


def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.secret_key = 'hackathon-t2-secret-key-change-in-production'

    init_db()

    from app.routes.auth_routes     import auth
    from app.routes.schedule_routes import schedule
    from app.routes.manager_routes  import manager

    app.register_blueprint(auth)
    app.register_blueprint(schedule)
    app.register_blueprint(manager)

    return app
