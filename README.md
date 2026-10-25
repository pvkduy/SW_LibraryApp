# SW Library App — ShelfHelp

Ứng dụng quản lý thư viện (đồ án môn học). **Đặc tả kỹ thuật đầy đủ và có thẩm quyền nằm ở
[`src/speckit/specs/SHELFHELP_FULLSPEC.md`](src/speckit/specs/SHELFHELP_FULLSPEC.md)**; các spec đã
tách theo tính năng nằm trong [`src/speckit/specs/`](src/speckit/specs).

> **Stack chính thức: Supabase.** Xem [`docs/DECISIONS.md`](docs/DECISIONS.md) (DEC-LOG-01) và
> DEC-54 trong đặc tả.

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
| --- | --- | --- |
| Frontend | React 19 + Vite + JavaScript | [`src/frontend/`](src/frontend) |
| Backend (logic nghiệp vụ) | Supabase Edge Functions (Deno, TypeScript) | [`src/supabase/functions/`](src/supabase/functions) |
| Database | Supabase Postgres (RLS, triggers, `pg_cron`, `pgvector`, `pg_trgm`) | [`src/supabase/migrations/`](src/supabase/migrations) |
| Auth | Supabase Auth (`app_metadata.role`) | `src/frontend/src/features/auth/` |
| Files | Supabase Storage + bucket policies | `src/supabase/config.toml` |
| Code dùng chung | `@shelfhelp/shared` (types, reason codes, settings, clock) | [`src/shared/`](src/shared) |

```
SW_LibraryApp/
├── src/
│   ├── frontend/       # React + Vite, dùng supabase-js
│   ├── supabase/       # config.toml, migrations/, functions/, tests/, seed.sql
│   ├── shared/         # @shelfhelp/shared
│   ├── e2e/            # Playwright
│   ├── scripts/        # spec-matrix
│   └── speckit/        # Đặc tả: specs/, .specify/, constitution
├── docs/               # Tài liệu đồ án + DECISIONS.md
├── package.json        # npm workspaces (src/frontend, src/shared, src/e2e)
└── README.md
```

> **Mọi thứ thuộc app nằm trong `/src`** (DEC-LOG-02). Supabase project ở `src/supabase/`.
> Scaffold Flask + Firebase cũ đã được xoá hoàn toàn.

---

## Bắt đầu phát triển (làm theo thứ tự)

### Bước 0 — Yêu cầu môi trường

| Công cụ | Phiên bản | Kiểm tra |
| --- | --- | --- |
| Node.js | >= 20 (khuyến nghị 24) | `node --version` |
| npm | >= 10 | `npm --version` |
| **Docker Desktop** | mới nhất, **đang chạy** | `docker info` |
| Git | bất kỳ | `git --version` |

**Docker phải đang chạy** (mở Docker Desktop, đợi icon chuyển sang trạng thái running) trước khi làm
bước 2. Nếu `docker` không có trong PATH (Windows cài per-user), thêm thư mục sau vào PATH:

```
C:\Users\<tên-bạn>\AppData\Local\Programs\DockerDesktop\resources\bin
```

### Bước 1 — Cài dependencies

```bash
# Từ thư mục gốc repo
npm install
```

Repo dùng **npm workspaces**: dependencies được cài ở `node_modules/` gốc và chia sẻ cho
`src/frontend` + `src/shared`. Vì vậy `src/frontend/node_modules` sẽ **gần như rỗng** — đó là bình
thường, không phải lỗi.

### Bước 2 — Bật Supabase local stack

Mỗi thành viên chạy **local stack riêng** trên máy mình (không dùng chung database cloud khi dev).

```bash
# Từ thư mục gốc repo
npx supabase start --workdir src
```

Lần đầu sẽ tải Docker image (~2 GB), mất vài phút. Khi xong, CLI in ra `API_URL`, `PUBLISHABLE_KEY`...

Áp migrations + seed (chỉ cần lần đầu, hoặc khi muốn reset sạch):

```bash
npx supabase db reset --workdir src
```

> **`--workdir src` là bắt buộc** vì project Supabase nằm ở `src/supabase/`, không phải `./supabase/`
> (DEC-LOG-02). Nếu quên, CLI không tìm thấy migration và database sẽ rỗng.
>
> Muốn khỏi gõ cờ mỗi lần:
> ```bash
> export SUPABASE_WORKDIR=src      # macOS/Linux/Git Bash
> set SUPABASE_WORKDIR=src         # Windows CMD
> $env:SUPABASE_WORKDIR="src"      # Windows PowerShell
> ```

Kiểm tra stack đang chạy:

```bash
npx supabase status --workdir src
```

### Bước 3 — Tạo file biến môi trường cho frontend

```bash
cd src/frontend
cp .env.example .env.local       # macOS/Linux: cp
# Windows CMD: copy .env.example .env.local
```

Mở `src/frontend/.env.local` và điền **đúng 3 dòng** sau (đây là key **local**, giống hệt nhau trên
máy mọi người — không phải secret, không cần xin ai):

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_PAYMENT_SIMULATOR_CONTROLS=true
```

<details>
<summary><strong>Tại sao key này giống nhau cho tất cả mọi người?</strong></summary>

`supabase start` tạo ra local stack với **cặp key cố định do Supabase CLI sinh sẵn** — không phải
ngẫu nhiên theo project. Vì vậy mọi máy đều có cùng `PUBLISHABLE_KEY` như trên.

Key này chỉ dùng được với `http://127.0.0.1:54321` (localhost của chính bạn). Nó **không** truy cập
được project cloud nào, nên để trong README là an toàn.

⚠️ **Đừng** dán key lấy từ Supabase Dashboard vào đây. Key đó thuộc project **cloud** của bạn, không
khớp với local URL → app sẽ lỗi `401` hoặc báo thiếu cấu hình.
</details>

> **Sau khi sửa `.env.local` phải tắt và chạy lại** `npm run dev`. Vite chỉ đọc biến môi trường lúc
> khởi động, không hot-reload.

### Bước 4 — Chạy frontend

```bash
cd src/frontend
npm run dev
```

Mở http://localhost:5173. Trang demo hiển thị danh sách sách lấy từ local database.

> **Chưa thấy sách?** Nguyên nhân thường gặp:
> 1. Chưa chạy `npx supabase db reset --workdir src` → database rỗng.
> 2. Stack chưa chạy (`npx supabase status --workdir src`).
> 3. Bảng `books` chỉ trả dữ liệu cho user **đã đăng nhập** (RLS). Chưa đăng nhập thì danh sách rỗng
>    là đúng — xem mục "Kiểm tra nhanh" bên dưới.

---

## Kiểm tra nhanh (smoke check)

Xác nhận schema + seed + RLS hoạt động mà không cần mở app:

```bash
# Đếm sách trong DB (bỏ qua RLS, chạy bằng postgres superuser)
docker exec supabase_db_shelfhelp psql -U postgres -d postgres -tAc "select count(*) from books;"
# → phải ra 4
```

```bash
# Kiểm tra tìm kiếm tiếng Việt không phân biệt dấu (POL-17)
docker exec supabase_db_shelfhelp psql -U postgres -d postgres -tAc \
  "select title from books where search_vector @@ plainto_tsquery('simple', immutable_unaccent('hoa')) order by title;"
# → phải ra: Hóa học đại cương / Họa tiết dân tộc / Hoa văn Việt Nam
```

Nếu hai lệnh trên ra kết quả đúng, database đã sẵn sàng.

---

## Các lệnh thường dùng

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | (trong `src/frontend`) chạy Vite dev server |
| `npm run build` | build production |
| `npm run lint` | lint (oxlint) |
| `npm run typecheck` | typecheck `src/shared` |
| `npm run spec-matrix` | kiểm tra mọi FR đều có test scenario (CI gate) |
| `npx supabase status --workdir src` | xem trạng thái stack + key local |
| `npx supabase db reset --workdir src` | reset DB + áp lại migrations + seed |
| `npx supabase stop --workdir src` | tắt stack (giữ dữ liệu) |
| `npx supabase stop --no-backup --workdir src` | tắt + xoá sạch dữ liệu |

### Địa chỉ local stack

| Dịch vụ | URL |
| --- | --- |
| API (REST / Auth / Functions) | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (xem bảng, sửa dữ liệu) | http://localhost:54323 |
| Mailpit (xem email test) | http://localhost:54324 |

> **Đăng nhập test:** provider Email/Password bật xác thực email, nên user mới đăng ký chưa đăng nhập
> được ngay. Mở **Mailpit** (http://localhost:54324) để lấy link xác thực, hoặc xác nhận thủ công:
> ```bash
> docker exec supabase_db_shelfhelp psql -U postgres -d postgres -c \
>   "update auth.users set email_confirmed_at = now() where email = 'ban@student.edu.vn';"
> ```

---

## Truy cập dữ liệu và API

Không có REST API tự viết. Truy cập dữ liệu theo mô hình của đặc tả:

- **Đọc**: `supabase-js` qua PostgREST, bảo vệ bằng **Row Level Security**. Bảng bật RLS mà không có
  policy thì **không đọc được** — đây là chủ ý.
- **Ghi**: chỉ qua **Edge Functions** (một transaction Postgres mỗi thao tác, có idempotency key).
  Client **không** có quyền INSERT/UPDATE/DELETE trên bảng nghiệp vụ.
- **Lỗi**: contract chuẩn `{ "error": { "reason", "message", "details" } }` — xem đặc tả §12.5.

### Bảo mật

- `.env.local` **không** commit (đã nằm trong `.gitignore`).
- Client chỉ giữ `VITE_SUPABASE_URL` + publishable key. **`service_role` / secret key không bao giờ**
  được đưa vào frontend (NFR-06) — chỉ dùng trong Edge Functions / CI.

---

## Cấu trúc code chính

**Frontend** (`src/frontend/src/`)
- `lib/supabase.js` – browser client (publishable key, PKCE)
- `lib/api.js` – gọi Edge Functions, bóc contract lỗi §12.5
- `features/auth/AuthContext.jsx` – Supabase Auth session + bảng `profiles`
- `app/App.jsx`, `app/main.jsx` – trang demo

**Supabase** (`src/supabase/`)
- `config.toml` – cấu hình local stack, storage buckets
- `migrations/0001_init.sql` – nền tảng M0: extensions, `app_now()`, `profiles`/`books`/`copies`, RLS
- `functions/hello/` – Edge Function hello-world
- `seed.sql`, `tests/` – dữ liệu mẫu, pgTAP (sẽ bổ sung)

**Shared** (`src/shared/src/`) – `@shelfhelp/shared`: types, reason codes, settings defaults, clock

**Đặc tả** (`src/speckit/`)
- `specs/SHELFHELP_FULLSPEC.md` – SRS đầy đủ (nguồn có thẩm quyền)
- `specs/000-core/spec.md` – bối cảnh dùng chung
- `specs/M0-PLAN.md` – kế hoạch milestone M0

---

## Làm việc với hosted database (deploy lên cloud)

Các bước trên chỉ dùng cho **local development**. Khi cần thay đổi database **hosted** (project cloud
dùng chung cho cả nhóm), làm theo quy trình dưới đây.

> **Nguyên tắc: KHÔNG bao giờ sửa database hosted bằng tay** (SQL Editor, dashboard, Table Editor).
> Mọi thay đổi schema phải là một file migration trong `src/supabase/migrations/`. File migration là
> **nguồn duy nhất** — cùng một file áp cho local, staging và production.

### Liên kết lần đầu (mỗi thành viên, mỗi máy)

```bash
cd C:/Users/khoin/OneDrive/Documents/SW_LibraryApp/src

npx supabase login                      # mở trình duyệt để xác thực
npx supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` là mã project trên Supabase Dashboard (Settings → General → Reference ID).
Với project của nhóm: **`zmmbvjgeakxrlfbxsetj`**.

> Lệnh `link` tạo thư mục `.supabase/` chứa project ref. Thư mục này **đã** nằm trong `.gitignore` —
> không commit.

### Vòng lặp thay đổi schema (bắt buộc)

```bash
cd C:/Users/khoin/OneDrive/Documents/SW_LibraryApp/src

# 1. Tạo file migration mới (KHÔNG tự đặt tên file)
npx supabase migration new add_loan_items

# 2. Viết SQL vào src/supabase/migrations/<timestamp>_add_loan_items.sql

# 3. Chạy thử trên local — miễn phí, reset được
npx supabase db reset

# 4. Kiểm tra bằng pgTAP / chạy app local cho chắc

# 5. Đẩy lên hosted
npx supabase db push
```

`db push` chỉ áp các migration **chưa có** trên hosted. Nó **không** chạy lại migration cũ.

### ⚠️ Cảnh báo về `db push`

| | Local (`db reset`) | Hosted (`db push`) |
| --- | --- | --- |
| Dữ liệu | Xoá sạch, tạo lại | **Giữ nguyên** dữ liệu thật |
| Rủi ro | Không | **Phá DB của cả nhóm** |
| Có xác nhận? | Không | **Không** |

- Không có `--dry-run`. Hãy đọc kỹ SQL trước khi push.
- Migration đã push **không sửa lại được** — phải tạo migration mới để sửa (forward-only).
- Trước khi push thay đổi lớn: báo nhóm, và cân nhắc backup (Dashboard → Database → Backups).

### Secrets cho Edge Functions

Secret của Edge Function **không** đặt trong `.env.local` (file đó chỉ dành cho client). Dùng:

```bash
cd C:/Users/khoin/OneDrive/Documents/SW_LibraryApp/src
npx supabase secrets set LLM_API_KEY=... EMBEDDING_API_KEY=... --project-ref zmmbvjgeakxrlfbxsetj
npx supabase secrets list --project-ref zmmbvjgeakxrlfbxsetj
```

`service_role` key và database URL chỉ tồn tại trong Edge Function secrets / CI — **không bao giờ**
đưa vào `src/frontend/`.

### Deploy Edge Functions

```bash
npx supabase functions deploy hello --project-ref zmmbvjgeakxrlfbxsetj
```

### Trạng thái hiện tại

Hosted project **chưa được push migration** — schema cloud vẫn rỗng. Đây là chủ ý: chỉ push khi
schema M0 đã ổn định. Cho tới lúc đó, cả nhóm làm việc trên local stack.

Nếu app trỏ vào hosted (`.env.local` dùng URL cloud) mà chưa push, sẽ thấy lỗi
`Could not find the table 'public.books'` — đó là dấu hiệu schema chưa được đẩy lên.

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `docker: command not found` | Docker chưa vào PATH | Thêm `...\DockerDesktop\resources\bin` vào PATH, hoặc mở Docker Desktop |
| `supabase start` báo port đã dùng | Stack cũ còn chạy | `npx supabase stop --workdir src` rồi start lại |
| Database rỗng dù đã start | Thiếu `--workdir src` | `npx supabase db reset --workdir src` |
| App báo "Missing Supabase configuration" | Thiếu `src/frontend/.env.local` | Làm bước 3 |
| Danh sách sách trống | Chưa đăng nhập (RLS) | Xem mục "Đăng nhập test" |
| `401` khi gọi API | Dán nhầm key cloud vào local URL | Dùng đúng key local ở bước 3 |
| Sửa `.env.local` mà không thấy đổi | Vite chỉ đọc lúc khởi động | Tắt và chạy lại `npm run dev` |
| `npm run build` lỗi thiếu `@vitejs/plugin-react` | `node_modules` bị lệch do workspaces | Xoá `node_modules` + lockfile, chạy lại `npm install` |
| `db push` báo `Cannot find project ref` | Chưa `npx supabase link` | Chạy `npx supabase link --project-ref <ref>` |
| Hosted báo `Could not find the table` | Chưa push migration lên cloud | `npx supabase db push` |

---

## Việc cần làm tiếp

- [x] Xoá scaffold Flask + Firebase (DEC-LOG-01).
- [x] Chuyển frontend sang `supabase-js`.
- [x] Migration đầu tiên đã chạy và kiểm chứng trên local stack.
- [x] pgTAP RLS test (`src/supabase/tests/rls_test.sql`, 23/23 pass).
- [x] Playwright smoke test (`src/e2e/smoke.spec.ts`, 2/2 pass).
- [x] Pipeline CI (`.github/workflows/ci.yml`, 4 job).
- [ ] **Duyệt CI lần đầu trên GitHub** + bật branch protection cho `main`.
- [ ] Push migration lên hosted project khi schema M0 ổn định (`npx supabase db push`).
- [ ] Làm theo milestone M1–M11 trong đặc tả §19.
