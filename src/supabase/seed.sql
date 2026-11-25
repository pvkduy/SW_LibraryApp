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


-- -----------------------------------------------------------------------------
-- Seed Showcase Books, Copies & Reviews for Catalog / Book Detail / Checkout (002 & 004)
-- -----------------------------------------------------------------------------
update public.profiles
set phone = '0912-345-678'
where id = '11111111-1111-1111-1111-111111111111' and phone is null;

insert into public.books (
  title, authors, isbn13, publisher, year, pages, language, category, field,
  description, keywords, collection, replacement_price, shelf_location, status,
  rating_avg, rating_count, popularity_score, borrow_count
)
values
  (
    'The Design of Everyday Things',
    array['Don Norman'],
    '9780465050659',
    'Basic Books',
    2013,
    368,
    'English',
    'Non-Fiction',
    'UX & Design',
    'Even the smartest among us can feel inept as we fail to figure out which light switch or oven burner to turn on, or whether to push, pull, or slide a door. The fault, argues this ingenious—even liberating—book, lies not in ourselves, but in product design that ignores the needs of users and the principles of cognitive psychology.',
    array['design', 'ux', 'usability', 'psychology', 'interaction'],
    'premium',
    240000,
    'Floor 2 • Shelf B4 (West Wing)',
    'active',
    4.80,
    342,
    98.5,
    124
  ),
  (
    'Atomic Habits',
    array['James Clear'],
    '9780735211292',
    'Avery',
    2018,
    320,
    'English',
    'Non-Fiction',
    'Productivity',
    'No matter your goals, Atomic Habits offers a proven framework for improving every day. James Clear reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.',
    array['habits', 'productivity', 'psychology', 'self-improvement'],
    'standard',
    190000,
    'Floor 1 • Shelf A2 (North Wing)',
    'active',
    4.90,
    218,
    95.0,
    110
  ),
  (
    'Dune',
    array['Frank Herbert'],
    '9780441172719',
    'Ace Books',
    1965,
    688,
    'English',
    'Fiction',
    'Sci-Fi',
    'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the spice melange.',
    array['sci-fi', 'classic', 'arrakis', 'novel', 'fiction'],
    'premium',
    210000,
    'Floor 3 • Shelf F1 (South Wing)',
    'active',
    4.75,
    410,
    92.0,
    96
  ),
  (
    'A Brief History of Time',
    array['Stephen Hawking'],
    '9780553380163',
    'Bantam Books',
    1988,
    256,
    'English',
    'Science',
    'Physics',
    'A landmark volume in science writing by one of the great minds of our time, exploring the origins of the universe, black holes, wormholes, and the nature of time itself.',
    array['physics', 'cosmology', 'universe', 'science'],
    'standard',
    165000,
    'Floor 2 • Shelf S3 (East Wing)',
    'active',
    4.65,
    185,
    88.0,
    82
  ),
  (
    'Introduction to Algorithms',
    array['Thomas H. Cormen', 'Charles E. Leiserson'],
    '9780262046305',
    'MIT Press',
    2022,
    1312,
    'English',
    'Science',
    'Computer Science',
    'The comprehensive textbook covering a broad range of algorithms in depth, yet making their design and analysis accessible to all levels of readers.',
    array['algorithms', 'clrs', 'computer science', 'data structures'],
    'premium',
    450000,
    'Floor 2 • Shelf CS-01 (West Wing)',
    'active',
    4.85,
    276,
    90.5,
    89
  )
on conflict (isbn13) do update set
  pages = excluded.pages,
  description = excluded.description,
  shelf_location = excluded.shelf_location;

-- Update pages on existing 4 books as well
update public.books set pages = 464, language = 'English', rating_avg = 4.70, rating_count = 156, popularity_score = 94.0 where isbn13 = '9780132350884';
update public.books set pages = 310, language = 'Vietnamese', rating_avg = 4.50, rating_count = 42, popularity_score = 78.0 where isbn13 = '9786040000001';
update public.books set pages = 220, language = 'Vietnamese', rating_avg = 4.60, rating_count = 29, popularity_score = 72.0 where isbn13 = '9786040000002';
update public.books set pages = 248, language = 'Vietnamese', rating_avg = 4.45, rating_count = 19, popularity_score = 70.0 where isbn13 = '9786040000003';

-- Copies matching Figma Book Detail ("The Design of Everyday Things": BK-10019, BK-10020 available; BK-10021 borrowed)
insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, v.barcode, v.status, b.shelf_location, 'good'
from public.books b
cross join (values
  ('BK-10019', 'available'),
  ('BK-10020', 'available'),
  ('BK-10021', 'borrowed')
) as v(barcode, status)
where b.isbn13 = '9780465050659'
on conflict (barcode) do nothing;

insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, v.barcode, v.status, b.shelf_location, 'good'
from public.books b
cross join (values ('BK-10030', 'available'), ('BK-10031', 'available')) as v(barcode, status)
where b.isbn13 = '9780735211292'
on conflict (barcode) do nothing;

insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, v.barcode, v.status, b.shelf_location, 'good'
from public.books b
cross join (values ('BK-10040', 'available'), ('BK-10041', 'available')) as v(barcode, status)
where b.isbn13 = '9780441172719'
on conflict (barcode) do nothing;

insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, v.barcode, v.status, b.shelf_location, 'good'
from public.books b
cross join (values ('BK-10050', 'available'), ('BK-10051', 'available')) as v(barcode, status)
where b.isbn13 = '9780553380163'
on conflict (barcode) do nothing;

insert into public.copies (book_id, barcode, status, shelf_location, condition)
select b.id, 'BK-10060', 'borrowed', b.shelf_location, 'good'
from public.books b
where b.isbn13 = '9780262046305'
on conflict (barcode) do nothing;

-- Seed sample review matching Figma ("Essential reading for anyone in UX, architecture, or product design.")
insert into public.book_reviews (id, book_id, uid, rating, comment, created_at, updated_at)
select
  'eeee1111-1111-1111-1111-111111111111',
  b.id,
  '33333333-3333-3333-3333-333333333333',
  5,
  'Essential reading for anyone in UX, architecture, or product design.',
  now() - interval '14 days',
  now() - interval '14 days'
from public.books b
where b.isbn13 = '9780465050659'
on conflict (id) do nothing;
