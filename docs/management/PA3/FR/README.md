# ShelfHelp — PA3 Functional Requirement (FR) Demo & Source Code

Tài liệu bàn giao chức năng mẫu (FR Implementation) cho đợt nộp **PA3-2026**.

---

## 1. Thông tin chức năng (Functional Requirement)

* **Tên chức năng:** Quản lý Tài khoản & Xác thực người dùng (Authentication & Reader Accounts).
* **Mã đặc tả Spec Kit:** `001a-accounts-reader` và `001b-accounts-admin` (chi tiết tại `src/speckit/specs/001a-accounts-reader/`).
* **Các yêu cầu chức năng đáp ứng:**
  * `FR-AUTH-01`: Đăng ký tài khoản độc giả (Reader Registration) với email tên miền trường học (`@*.edu.vn`, `@fitus.edu.vn`), định dạng MSSV và mật khẩu an toàn (POL-02).
  * `FR-AUTH-02`: Kích hoạt tài khoản qua email xác nhận / mã OTP 6 số, hòm thư ảo Inbucket.
  * `FR-AUTH-03`: Đăng nhập linh hoạt bằng Email hoặc Mã số sinh viên (MSSV), ghi nhận phiên làm việc, phân quyền vai trò (Reader Mode / Admin Mode).
  * `FR-AUTH-04`: Đăng xuất an toàn với **hộp thoại modal popup xác nhận** (tránh thao tác nhầm).
  * `FR-AUTH-05`: Quên mật khẩu & Đặt lại mật khẩu.
* **Giao diện người dùng:** Đáp ứng chính xác 100% theo **8 bản thiết kế Figma** (Login, Register, Forgot Password, Verify OTP, Reset Password, Success Modal, Error Modal, và Logout Confirm Modal).

---

## 2. File Video Demo

* **File:** [`Screen Recording 2026-11-14 010626.mp4`](Screen%20Recording%202026-11-14%20010626.mp4)
* **Nội dung video:** Quay lại toàn bộ luồng thao tác thực tế từ Đăng ký $\rightarrow$ Xác thực $\rightarrow$ Đăng nhập bằng Email/MSSV $\rightarrow$ Xem Dashboard $\rightarrow$ Đăng xuất có xác nhận.

---

## 3. Cấu trúc Source Code đính kèm

Mã nguồn của chức năng được tổ chức trong thư mục [`source-code/`](source-code/) (và file nén [`source-code.zip`](source-code.zip)):

```
source-code/
├── frontend/
│   └── src/
│       ├── app/
│       │   └── App.jsx                 # Routing chính, bảo vệ trang Dashboard, modal xác nhận đăng xuất
│       ├── features/auth/
│       │   ├── components/             # Input, Icons, Layout, Modals (Success, Error, Confirm)
│       │   ├── AuthContext.jsx         # Context quản lý session, fallback Edge Function -> Auth client
│       │   ├── auth.css                # CSS thiết kế chuẩn Figma màu kem #FAF8F5, nâu #6E472A
│       │   ├── LoginPage.jsx           # Màn hình Đăng nhập (hỗ trợ MSSV + 1-click tự điền tài khoản mẫu)
│       │   ├── RegisterPage.jsx        # Màn hình Đăng ký tài khoản sinh viên
│       │   ├── ForgotPasswordPage.jsx  # Màn hình Quên mật khẩu
│       │   ├── VerifyOtpPage.jsx       # Màn hình 6 ô nhập mã OTP & nút kích hoạt
│       │   └── ResetPasswordPage.jsx   # Màn hình Đặt lại mật khẩu mới
│       └── lib/
│           └── supabase.js             # Supabase client khởi tạo
├── supabase/
│   ├── config.toml                     # Cấu hình local stack (ports, auth, inbucket, storage)
│   ├── seed.sql                        # Dữ liệu mẫu (sách, copies, 2 tài khoản mẫu dùng chung)
│   ├── functions/
│   │   └── register-student/index.ts   # Edge Function xử lý đăng ký sinh viên atomic
│   └── migrations/
│       ├── 0001_init.sql               # Bảng profiles, books, copies, Row Level Security (RLS)
│       └── 0002_auth_triggers.sql      # Triggers tự động liên kết auth.users với public.profiles
├── shared/
│   └── src/
│       ├── domain/auth.ts              # Logic kiểm tra MSSV, email domain, mật khẩu hợp lệ (POL-02)
│       └── index.ts
└── speckit/
    └── 001a-accounts-reader/
        ├── spec.md                     # Đặc tả kỹ thuật Spec Kit
        ├── plan.md                     # Kế hoạch kiến trúc kỹ thuật
        └── tasks.md                    # Danh sách các task (T001 - T016)
```

---

## 4. Hướng dẫn chạy thử nghiệm nhanh

1. **Khởi động Supabase local stack:**
   ```bash
   npm run db:start
   npm run db:reset
   ```
2. **Khởi động Frontend:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại: **`http://localhost:5173`**
3. **Tài khoản test có sẵn (được nạp tự động):**
   * 🎓 **Sinh viên:** `student@shelfhelp.edu.vn` (hoặc MSSV `24125000`) | Mật khẩu: `Password123!`
   * 📘 **Thủ thư (Admin):** `admin@shelfhelp.edu.vn` | Mật khẩu: `Password123!`
   *(Có khung bấm 1-click điền tự động ngay trên màn hình đăng nhập).*
4. **Hòm thư xem email xác thực local:**
   * Mở Inbucket tại: **`http://localhost:54324`**
