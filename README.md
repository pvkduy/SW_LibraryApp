# SW Library App — ShelfHelp

Ứng dụng quản lý thư viện (đồ án môn học). **Đặc tả kỹ thuật đầy đủ và có thẩm quyền nằm ở
[`specs/SHELFHELP_FULLSPEC.md`](src/speckit/specs/SHELFHELP_FULLSPEC.md)**; các spec đã tách theo
tính năng nằm trong [`src/speckit/specs/`](src/speckit/specs).

> **Stack chính thức: Supabase.** Xem quyết định ghi nhận tại [`docs/DECISIONS.md`](docs/DECISIONS.md)
> (DEC-LOG-01) và DEC-54 trong đặc tả.

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
| --- | --- | --- |
| Frontend | React 18+ + Vite + TypeScript | [`src/frontend/`](src/frontend) |
| Backend (logic nghiệp vụ) | Supabase Edge Functions (Deno, TypeScript) | `supabase/functions/` *(chưa tạo — milestone M0)* |
| Database | Supabase Postgres (RLS, triggers, `pg_cron`, `pgvector`, `pg_trgm`) | `supabase/migrations/` *(chưa tạo — M0)* |
| Auth | Supabase Auth (role trong `app_metadata.role`) | — |
| Files | Supabase Storage + bucket policies | — |

```
SW_LibraryApp/
├── src/
│   ├── frontend/       # React + Vite (giữ lại và chuyển sang supabase-js)
│   ├── backend/        # [ĐÃ NGỪNG DÙNG] Flask demo — xem DEC-LOG-01
│   ├── firebase/       # [ĐÃ NGỪNG DÙNG] Firestore rules — xem DEC-LOG-01
│   └── speckit/        # Đặc tả: specs/, .specify/, constitution
├── docs/               # Tài liệu đồ án + DECISIONS.md
└── README.md
```

> ⚠️ **`src/backend/` (Flask) và `src/firebase/` là scaffold demo đã ngừng dùng.** Chúng chỉ
> triển khai 2/107 yêu cầu chức năng và không chứa logic nghiệp vụ cần giữ. Không phát triển thêm;
> sẽ xoá sau khi có nền tảng Supabase (M0). Chi tiết: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Yêu cầu môi trường

- Node.js >= 20 (khuyến nghị >= 24.12)
- **Supabase CLI** (`npm i -g supabase`) + **Docker** (cho local stack)
- Không còn cần Python cho backend chính thức

## 1. Thiết lập Supabase dùng chung

Cả nhóm dùng **chung một project Supabase** để có cùng dữ liệu và người dùng.

1. Tạo project trên [Supabase Dashboard](https://supabase.com/dashboard) — region khuyến nghị
   `ap-southeast-1` (Singapore) theo đặc tả.
2. **Authentication** → bật provider **Email/Password**; bật xác thực email.
3. **SQL Editor** hoặc **CLI**: chạy migrations trong `supabase/migrations/` (sẽ có ở M0).
   RLS bật trên **mọi bảng**; bảng không có policy thì không đọc được.
4. Lấy **Project URL** và **anon key** ở *Project Settings → API* để điền vào
   `src/frontend/.env.local`.
5. `service_role` key và database URL **chỉ** đặt trong Edge Function secrets / CI — **không bao giờ**
   đưa vào client bundle.

> **Bảo mật:** không commit `.env`, `service_role` key, hay bất kỳ secret nào. Client chỉ giữ
> project URL và anon key.

## 2. Chạy local stack (khuyến nghị cho dev)

```bash
supabase start          # khởi động Postgres + Auth + Storage + Functions (cần Docker)
supabase db reset       # áp migrations + seed
supabase functions serve
```

## 3. Chạy Frontend (Vite + React)

```bash
cd src/frontend
node --version                  # cần >= 20 (khuyến nghị >= 24.12)
npm install
copy .env.example .env.local    # macOS/Linux: cp .env.example .env.local
# Điền các biến (lấy từ Supabase Dashboard > Project Settings > API):
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon-key>
npm run dev
```

Web chạy tại `http://localhost:5173`.

> **Lưu ý:**
> - Local stack (bước 2) phải đang chạy thì trang mới có dữ liệu.
> - Điền đúng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` thì mới đăng nhập được.
> - Sau khi sửa `.env.local` cần **tắt và chạy lại** `npm run dev`.

Các lệnh khác:
```bash
npm run lint      # kiểm tra lint (oxlint)
npm run build     # build production vào thư mục dist/
npm run preview   # xem thử bản build
```

> **Cần chuyển đổi:** `src/frontend/src/services/firebase.js` và `context/AuthContext.jsx` hiện dùng
> Firebase JS SDK. Phải chuyển sang `supabase-js` (Supabase Auth session) — xem DEC-LOG-01.

## Truy cập dữ liệu và API

Không còn REST API tự viết. Truy cập dữ liệu theo mô hình của đặc tả:

- **Đọc**: `supabase-js` qua PostgREST, bảo vệ bằng **Row Level Security**.
- **Ghi**: chỉ qua **Edge Functions** (một transaction Postgres mỗi thao tác, có idempotency key).
  Client **không** có quyền INSERT/UPDATE/DELETE trên bảng nghiệp vụ.
- **RPC đọc**: `search_books`, `server_time`, `get_dashboard_kpis`, `get_rankings`,
  `get_due_overdue_groups` (staff).
- **Lỗi**: contract chuẩn `{ "error": { "reason", "message", "details" } }` — xem đặc tả §12.5.

## Cấu trúc code chính

**Frontend** (`src/frontend/src/`) — giữ lại, cần chuyển sang Supabase
- `services/firebase.js` – *(cần thay)* → `services/supabase.js`
- `services/api.js` – *(cần thay)* → gọi `supabase-js` / Edge Functions
- `context/AuthContext.jsx` – *(cần thay)* → Supabase Auth session
- `App.jsx` – trang demo (đăng nhập + danh sách sách)

**Backend demo** (`src/backend/`) — **đã ngừng dùng**, không phát triển thêm

**Đặc tả** (`src/speckit/`)
- `specs/SHELFHELP_FULLSPEC.md` – SRS đầy đủ (nguồn có thẩm quyền)
- `specs/000-core/spec.md` – bối cảnh dùng chung (decisions, policies, domain model, NFRs)
- `specs/0NN*-.../spec.md` – spec theo tính năng (reader/admin đã tách)
- `.specify/memory/constitution.md` – hiến chương dự án

## Việc cần làm tiếp

- [ ] **M0**: tạo repo Supabase (dev/staging/prod) + local stack, migration pipeline, Edge Function
      hello-world, pgTAP RLS test, Playwright smoke test.
- [ ] Chuyển frontend từ Firebase SDK sang `supabase-js`.
- [ ] Xoá `src/backend/` (Flask) và `src/firebase/` sau khi M0 hoàn tất.
- [ ] Làm theo thứ tự milestone M1–M11 trong đặc tả §19.
- [ ] Viết test: Vitest, React Testing Library, Playwright, pgTAP.
