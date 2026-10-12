from functools import wraps

from flask import g, jsonify, request

from .firebase import verify_id_token


def require_auth(fn):
    """Decorator kiểm tra Firebase ID token trong header Authorization."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = header.split(" ", 1)[1]
        try:
            g.user = verify_id_token(token)
        except Exception:
            return jsonify({"error": "Invalid or expired token"}), 401

        return fn(*args, **kwargs)

    return wrapper
