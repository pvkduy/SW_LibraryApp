# SW Library App

Ứng dụng quản lý thư viện (đồ án môn học). Kiến trúc gồm 3 phần:

| Thành phần | Công nghệ | Thư mục |
| --- | --- | --- |
| Frontend | Vite + React (JSX) | [`src/frontend/`](src/frontend) |
| Backend API | Flask (Python) | [`src/backend/`](src/backend) |
| Auth + Database | Google Firebase (Authentication + Firestore) | [`src/firebase/`](src/firebase) |

```
SW_LibraryApp/
├── src/
│   ├── frontend/    # Vite + React
│   ├── backend/     # Flask API
│   └── firebase/    # Firestore rules
├── docs/            # Tài liệu đồ án (requirements, design, test...)
└── README.md
```

## Yêu cầu môi trường

- Node.js >= 20 (khuyến nghị >= 24.12 để dùng Firebase JS SDK mới nhất)
- Python >= 3.10
- Một project Firebase dùng chung cho cả nhóm

## 1. Thiết lập Firebase dùng chung

Cả nhóm dùng **chung một project Firebase** để có cùng dữ liệu và người dùng.

1. Vào [Firebase Console](https://console.firebase.google.com/) → **Add project** → đặt tên (ví dụ `sw-library-app`).
2. **Authentication** → *Get started* → bật provider **Email/Password** và **Google**.
3. **Firestore Database** → *Create database* (chọn chế độ production) → dán rules trong [`src/firebase/firestore.rules`](src/firebase/firestore.rules).
4. Lấy cấu hình web: **Project settings** → *Your apps* → thêm **Web app** → copy các giá trị `apiKey`, `authDomain`, `projectId`... để điền vào `src/frontend/.env.local`.
5. Lấy khóa server: **Project settings** → *Service accounts* → **Generate new private key** → tải file JSON về, đổi tên thành `serviceAccountKey.json` và đặt trong `src/backend/`.

> **Lưu ý:** file `serviceAccountKey.json` là bí mật, **KHÔNG commit lên Git**. Chia sẻ file này cho các thành viên trong nhóm qua kênh riêng (Drive nội bộ, chat...).

## 2. Chạy Backend (Flask API)

```bash
cd src/backend
python --version                # cần >= 3.10 (có thể là python3 trên macOS/Linux)
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
# Sửa các biến trong .env:
#   FIREBASE_SERVICE_ACCOUNT=serviceAccountKey.json   (phải khớp tên file thật)
#   FIREBASE_PROJECT_ID=<project-id-Firebase>
#   CORS_ORIGINS=http://localhost:5173
#   PORT=5000
# Copy file serviceAccountKey.json vào thư mục src/backend/

python run.py
```

API chạy tại `http://localhost:5000`. Kiểm tra nhanh: `http://localhost:5000/api/health` → `{"status":"ok"}`.

> **Lưu ý:** `/api/health` chạy được ngay cả khi chưa có `serviceAccountKey.json`. Nhưng các API dùng Firestore (`/api/books`...) **bắt buộc** phải có `serviceAccountKey.json` và đã bật Firestore trong Firebase. Nếu thiếu, các API này sẽ trả lỗi 500.

## 3. Chạy Frontend (Vite + React)

```bash
cd src/frontend
node --version                  # cần >= 20 (khuyến nghị >= 24.12)
npm install
copy .env.example .env.local    # macOS/Linux: cp .env.example .env.local
# Sửa các biến trong .env.local (lấy từ Firebase Console > Project settings > Web app):
#   VITE_FIREBASE_API_KEY=...
#   VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
#   VITE_FIREBASE_PROJECT_ID=<project-id>
#   VITE_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
#   VITE_FIREBASE_MESSAGING_SENDER_ID=...
#   VITE_FIREBASE_APP_ID=...
#   VITE_API_BASE_URL=http://localhost:5000
npm run dev
```

Web chạy tại `http://localhost:5173`.

> **Lưu ý:**
> - Backend phải đang chạy trước (bước 2) thì trang mới load được danh sách sách.
> - Origin `http://localhost:5173` phải có trong `CORS_ORIGINS` của `src/backend/.env`, nếu không trình duyệt sẽ chặn request.
> - Điền đúng các biến `VITE_FIREBASE_*` thì mới đăng nhập được; sai/thiếu sẽ báo lỗi khi gọi Firebase.
> - Sau khi sửa `.env.local` cần **tắt và chạy lại** `npm run dev` để Vite nạp biến mới.

Các lệnh khác:
```bash
npm run lint      # kiểm tra lint (oxlint)
npm run build     # build production vào thư mục dist/
npm run preview   # xem thử bản build
```

## API Endpoints

| Method | Endpoint | Auth | Mô tả |
| --- | --- | --- | --- |
| GET | `/api/health` | - | Kiểm tra server |
| GET | `/api/books` | - | Danh sách sách |
| GET | `/api/books/<id>` | - | Chi tiết một sách |
| POST | `/api/books` | ✅ | Thêm sách |
| PUT | `/api/books/<id>` | ✅ | Cập nhật sách |
| DELETE | `/api/books/<id>` | ✅ | Xóa sách |
| GET | `/api/auth/me` | ✅ | Thông tin user đang đăng nhập |
| POST | `/api/auth/sync` | ✅ | Đồng bộ user vào Firestore |

- Auth dùng Firebase ID token: gửi header `Authorization: Bearer <idToken>`. Frontend tự lấy token qua `src/services/api.js`.

## Cấu trúc code chính

**Frontend** (`src/frontend/src/`)
- `services/firebase.js` – khởi tạo Firebase (auth + firestore).
- `services/api.js` – gọi Flask API kèm token.
- `context/AuthContext.jsx` – trạng thái đăng nhập + các hàm auth.
- `App.jsx` – trang demo (đăng nhập + danh sách sách).

**Backend** (`src/backend/`)
- `run.py` – điểm khởi chạy.
- `app/__init__.py` – app factory, CORS, đăng ký routes.
- `app/config.py` – đọc biến môi trường.
- `app/firebase.py` – khởi tạo Firebase Admin, Firestore client.
- `app/auth.py` – decorator `require_auth` xác thực ID token.
- `app/routes/` – các blueprint: `health`, `books`, `auth`.

## Việc cần làm tiếp

- [ ] Tạo project Firebase và chia sẻ config cho nhóm.
- [ ] Thiết kế đầy đủ collection trong Firestore (books, users, borrows...).
- [ ] Thêm UI đăng nhập/đăng ký, quản lý sách, mượn/trả.
- [ ] Viết test (pytest cho backend, Vitest cho frontend).
