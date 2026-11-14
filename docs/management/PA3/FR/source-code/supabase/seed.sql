-- Seed data for local development (SRS §10.6).

-- -----------------------------------------------------------------------------
-- Seed accounts for team development
-- 1. Student account: student@shelfhelp.edu.vn / Password123!
-- 2. Admin account: admin@shelfhelp.edu.vn / Password123!
-- -----------------------------------------------------------------------------

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student@shelfhelp.edu.vn',
    crypt('Password123!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"student"}'::jsonb,
    '{"full_name":"Sinh Viên Nhóm 7","student_id":"24125000"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@shelfhelp.edu.vn',
    crypt('Password123!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"full_name":"Thủ Thư Nhóm 7"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  raw_app_meta_data = excluded.raw_app_meta_data,
  email_confirmed_at = now();

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@shelfhelp.edu.vn"}'::jsonb,
    'email',
    '11111111-1111-1111-1111-111111111111',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"admin@shelfhelp.edu.vn"}'::jsonb,
    'email',
    '22222222-2222-2222-2222-222222222222',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do nothing;

insert into public.profiles (
  id,
  role,
  status,
  full_name,
  email,
  student_id,
  faculty,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'student',
    'active',
    'Sinh Viên Nhóm 7',
    'student@shelfhelp.edu.vn',
    '24125000',
    'Công nghệ Thông tin',
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'admin',
    'active',
    'Thủ Thư Nhóm 7',
    'admin@shelfhelp.edu.vn',
    null,
    'Thư viện Trung tâm',
    now(),
    now()
  )
on conflict (id) do update set
  role = excluded.role,
  status = excluded.status,
  full_name = excluded.full_name;

-- -----------------------------------------------------------------------------
-- Seed Books
-- -----------------------------------------------------------------------------

insert into public.books (
  title, authors, isbn13, publisher, year, language, category, field,
  description, collection, replacement_price, shelf_location, status,
  total_copies, available_copies
)
values
  (
    'Clean Code', array['Robert C. Martin'], '9780132350884',
    'Prentice Hall', 2008, 'en', 'Computer Science', 'Software Engineering',
    'A handbook of agile software craftsmanship.', 'standard',
    180000, 'CS-A1', 'active', 2, 2
  ),
  (
    'Hóa học đại cương', array['Nguyễn Văn A'], '9786040000001',
    'NXB Giáo dục', 2020, 'vi', 'Natural Sciences', 'Chemistry',
    'Giáo trình hóa học đại cương cho sinh viên năm nhất.', 'premium',
    120000, 'NS-B2', 'active', 1, 1
  ),
  (
    'Họa tiết dân tộc', array['Trần Thị B'], '9786040000002',
    'NXB Mỹ thuật', 2019, 'vi', 'Arts', 'Design',
    'Tuyển tập họa tiết truyền thống.', 'standard',
    95000, 'AR-C3', 'active', 1, 1
  ),
  (
    'Hoa văn Việt Nam', array['Lê Văn C'], '9786040000003',
    'NXB Văn hóa', 2018, 'vi', 'Arts', 'Culture',
    'Nghiên cứu hoa văn trong kiến trúc cổ.', 'standard',
    88000, 'AR-C4', 'active', 1, 1
  )
on conflict do nothing;

-- Copies for the seeded books (one barcode per physical item, DEC-35).
insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, b.isbn13 || '-01', 'available', b.shelf_location, 'good'
from public.books b
where b.isbn13 in ('9780132350884', '9786040000001', '9786040000002', '9786040000003')
on conflict (barcode) do nothing;

insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, b.isbn13 || '-02', 'available', b.shelf_location, 'good'
from public.books b
where b.isbn13 = '9780132350884'
on conflict (barcode) do nothing;
