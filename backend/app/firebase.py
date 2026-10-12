import os

import firebase_admin
from firebase_admin import auth, credentials, firestore

from .config import Config

_app = None


def init_firebase():
    """Khởi tạo Firebase Admin SDK (chỉ chạy một lần)."""
    global _app
    if _app is not None:
        return _app

    options = {}
    if Config.FIREBASE_PROJECT_ID:
        options["projectId"] = Config.FIREBASE_PROJECT_ID

    key_path = Config.FIREBASE_SERVICE_ACCOUNT
    if key_path and os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        _app = firebase_admin.initialize_app(cred, options)
    else:
        # Fallback sang Application Default Credentials (khi deploy Cloud Run...)
        _app = firebase_admin.initialize_app(options=options or None)

    return _app


def get_db():
    init_firebase()
    return firestore.client()


def verify_id_token(token):
    init_firebase()
    return auth.verify_id_token(token)
