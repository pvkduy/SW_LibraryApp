from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..firebase import get_db

auth_bp = Blueprint("auth", __name__)

COLLECTION = "users"


@auth_bp.get("/me")
@require_auth
def me():
    """Trả về thông tin user đang đăng nhập (từ Firebase token)."""
    return jsonify(
        {
            "uid": g.user.get("uid"),
            "email": g.user.get("email"),
            "name": g.user.get("name"),
            "picture": g.user.get("picture"),
        }
    )


@auth_bp.post("/sync")
@require_auth
def sync_user():
    """Tạo/cập nhật document user trong Firestore sau khi đăng nhập."""
    db = get_db()
    uid = g.user["uid"]
    data = request.get_json(silent=True) or {}

    profile = {
        "email": g.user.get("email", ""),
        "name": data.get("name") or g.user.get("name", ""),
        "role": data.get("role", "reader"),
    }

    doc_ref = db.collection(COLLECTION).document(uid)
    doc_ref.set(profile, merge=True)
    return jsonify({"uid": uid, **profile})
