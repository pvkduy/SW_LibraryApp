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

-- -----------------------------------------------------------------------------
-- Seed Second Student (for overdue & multi-user tests)
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'minh.nguyen@shelfhelp.edu.vn',
  crypt('Password123!', gen_salt('bf', 10)),
  now(), now(),
  '{"provider":"email","providers":["email"],"role":"student"}'::jsonb,
  '{"full_name":"Nguyễn Văn Minh","student_id":"24125088"}'::jsonb,
  now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

insert into public.profiles (
  id, role, status, full_name, email, student_id, faculty, debt_outstanding, active_items, created_at, updated_at
)
values (
  '33333333-3333-3333-3333-333333333333',
  'student', 'active', 'Nguyễn Văn Minh', 'minh.nguyen@shelfhelp.edu.vn', '24125088',
  'Khoa Học Máy Tính', 15000, 1, now(), now()
)
on conflict (id) do update set
  debt_outstanding = excluded.debt_outstanding,
  active_items = excluded.active_items;

-- -----------------------------------------------------------------------------
-- Seed Circulation: Loan Requests & Loan Items
-- -----------------------------------------------------------------------------
insert into public.loan_requests (id, uid, pickup_code, status, created_at, updated_at)
values (
  'aaaa1111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'PICKUP-8921',
  'pending',
  now(), now()
)
on conflict (id) do nothing;

-- Item 1: Ready for pickup (Clean Code - copy 01)
insert into public.loan_items (
  id, request_id, uid, book_id, copy_id, source, status, duration_days, pickup_deadline, created_at, updated_at
)
select
  'bbbb1111-1111-1111-1111-111111111111',
  'aaaa1111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  b.id,
  c.id,
  'cart',
  'ready_for_pickup',
  14,
  now() + interval '24 hours',
  now(), now()
from public.books b
join public.copies c on c.book_id = b.id and c.barcode = '9780132350884-01'
where b.isbn13 = '9780132350884'
on conflict (id) do nothing;

update public.copies
set status = 'held', held_for_type = 'loan_item', held_until = now() + interval '24 hours'
where barcode = '9780132350884-01';

-- Item 2: Borrowed (Hóa học đại cương - on loan)
insert into public.loan_items (
  id, uid, book_id, copy_id, source, status, is_premium, duration_days, handover_at, due_at, condition_out, created_at, updated_at
)
select
  'bbbb2222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  b.id,
  c.id,
  'cart',
  'borrowed',
  true,
  14,
  now() - interval '3 days',
  (now() + interval '11 days')::date + time '23:59:59',
  'good',
  now() - interval '3 days', now()
from public.books b
join public.copies c on c.book_id = b.id and c.barcode = '9786040000001-01'
where b.isbn13 = '9786040000001'
on conflict (id) do nothing;

update public.copies
set status = 'borrowed'
where barcode = '9786040000001-01';

-- Item 3: Overdue 3 days (Họa tiết dân tộc - overdue)
insert into public.loan_items (
  id, uid, book_id, copy_id, source, status, duration_days, handover_at, due_at, condition_out, created_at, updated_at
)
select
  'bbbb3333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  b.id,
  c.id,
  'cart',
  'overdue',
  14,
  now() - interval '17 days',
  (now() - interval '3 days')::date + time '23:59:59',
  'good',
  now() - interval '17 days', now()
from public.books b
join public.copies c on c.book_id = b.id and c.barcode = '9786040000002-01'
where b.isbn13 = '9786040000002'
on conflict (id) do nothing;

update public.copies
set status = 'borrowed'
where barcode = '9786040000002-01';

-- -----------------------------------------------------------------------------
-- Seed Charges (Unpaid fine for student 33333333-3333...)
-- -----------------------------------------------------------------------------
insert into public.charges (
  id, uid, type, loan_item_id, amount, status, rate, notes, created_at, updated_at
)
values (
  'cccc1111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'overdue_fine',
  'bbbb3333-3333-3333-3333-333333333333',
  15000,
  'unpaid',
  5000,
  'Tiền phạt trễ hạn 3 ngày (Sách: Họa tiết dân tộc)',
  now(), now()
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Seed Reservations (Queues)
-- -----------------------------------------------------------------------------
-- Reservation 1: Ready for pickup (Hoa văn Việt Nam)
insert into public.reservations (
  id, uid, book_id, copy_id, status, hold_until, pickup_code, created_at, updated_at
)
select
  'dddd1111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  b.id,
  c.id,
  'ready_for_pickup',
  now() + interval '36 hours',
  'RES-4412',
  now() - interval '2 days', now()
from public.books b
join public.copies c on c.book_id = b.id and c.barcode = '9786040000003-01'
where b.isbn13 = '9786040000003'
on conflict (id) do nothing;

update public.copies
set status = 'held', held_for_type = 'reservation', held_until = now() + interval '36 hours'
where barcode = '9786040000003-01';

-- Reservation 2: Waiting in queue #1 for Clean Code
insert into public.reservations (
  id, uid, book_id, copy_id, status, queue_position, created_at, updated_at
)
select
  'dddd2222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  b.id,
  null,
  'waiting',
  1,
  now() - interval '1 day', now()
from public.books b
where b.isbn13 = '9780132350884'
on conflict (id) do nothing;

