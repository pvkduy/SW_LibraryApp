from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .routes.auth import auth_bp
from .routes.books import books_bp
from .routes.health import health_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(books_bp, url_prefix="/api/books")

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "Internal server error"}), 500

    return app
