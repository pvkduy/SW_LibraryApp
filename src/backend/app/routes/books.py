from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..firebase import get_db

books_bp = Blueprint("books", __name__)

COLLECTION = "books"


@books_bp.get("")
def list_books():
    db = get_db()
    docs = db.collection(COLLECTION).stream()
    books = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    return jsonify({"books": books})


@books_bp.get("/<book_id>")
def get_book(book_id):
    db = get_db()
    doc = db.collection(COLLECTION).document(book_id).get()
    if not doc.exists:
        return jsonify({"error": "Book not found"}), 404
    return jsonify({"id": doc.id, **doc.to_dict()})


@books_bp.post("")
@require_auth
def create_book():
    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return jsonify({"error": "title is required"}), 400

    db = get_db()
    _, doc_ref = db.collection(COLLECTION).add(
        {
            "title": data["title"],
            "author": data.get("author", ""),
            "isbn": data.get("isbn", ""),
            "quantity": data.get("quantity", 1),
        }
    )
    return jsonify({"id": doc_ref.id}), 201


@books_bp.put("/<book_id>")
@require_auth
def update_book(book_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    doc_ref = db.collection(COLLECTION).document(book_id)
    if not doc_ref.get().exists:
        return jsonify({"error": "Book not found"}), 404
    doc_ref.update(data)
    return jsonify({"id": book_id})


@books_bp.delete("/<book_id>")
@require_auth
def delete_book(book_id):
    db = get_db()
    doc_ref = db.collection(COLLECTION).document(book_id)
    if not doc_ref.get().exists:
        return jsonify({"error": "Book not found"}), 404
    doc_ref.delete()
    return jsonify({"id": book_id})
