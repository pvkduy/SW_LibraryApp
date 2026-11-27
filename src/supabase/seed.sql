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
  description, collection, replacement_price, shelf_location, status
)
values
  (
    'Clean Code', array['Robert C. Martin'], '9780132350884',
    'Prentice Hall', 2008, 'en', 'Computer Science', 'Software Engineering',
    'A handbook of agile software craftsmanship.', 'standard',
    180000, 'CS-A1', 'active'
  ),
  (
    'Hóa học đại cương', array['Nguyễn Văn A'], '9786040000001',
    'NXB Giáo dục', 2020, 'vi', 'Natural Sciences', 'Chemistry',
    'Giáo trình hóa học đại cương cho sinh viên năm nhất.', 'premium',
    120000, 'NS-B2', 'active'
  ),
  (
    'Họa tiết dân tộc', array['Trần Thị B'], '9786040000002',
    'NXB Mỹ thuật', 2019, 'vi', 'Arts', 'Design',
    'Tuyển tập họa tiết truyền thống.', 'standard',
    95000, 'AR-C3', 'active'
  ),
  (
    'Hoa văn Việt Nam', array['Lê Văn C'], '9786040000003',
    'NXB Văn hóa', 2018, 'vi', 'Arts', 'Culture',
    'Nghiên cứu hoa văn trong kiến trúc cổ.', 'standard',
    88000, 'AR-C4', 'active'
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
  id, uid, book_id, copy_id, source, status, is_premium, duration_days, handover_at, due_at, due_date, condition_out, created_at, updated_at
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
  id, uid, book_id, copy_id, source, status, duration_days, handover_at, due_at, due_date, condition_out, created_at, updated_at
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
on conflict (isbn13) where isbn13 is not null do update set
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

-- =============================================================================
-- BEGIN GENERATED BOOK SEED (SCRUM-81) — DO NOT EDIT MANUALLY
-- Regenerate with: node src/scripts/seed-books.mjs
-- =============================================================================
-- 191 synthetic books (+ 9 existing fixtures = 200 total titles, SRS §10.6)
insert into public.books (
  title, authors, isbn10, isbn13, publisher, year, pages, language, category, field,
  description, toc, keywords, collection, replacement_price, shelf_location, status,
  rating_avg, rating_count, popularity_score, borrow_count, added_at
)
values
  ('Designing Reliable Microservices', array['Peter Norvig'], '1968100016', '9781968100018', 'Manning Publications', 2021, 368, 'English', 'Computer Science', 'Distributed Systems', 'Designing Reliable Microservices offers a structured, practical exploration of Distributed Systems with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Distributed Systems
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['microservices', 'distributed', 'architecture', 'resilience'], 'premium', 395000, 'Floor 2 • Shelf CS-01 (West Wing)', 'active', 4.17, 18, 53.2, 22, now() - interval '3 days'),
  ('Pragmatic Type Systems', array['Barbara Liskov'], '1968100024', '9781968100025', 'Manning Publications', 2014, 704, 'English', 'Computer Science', 'Software Engineering', 'Pragmatic Type Systems offers a structured, practical exploration of Software Engineering with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Software Engineering
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['typescript', 'types', 'compilers', 'software'], 'premium', 185000, 'Floor 2 • Shelf CS-02 (West Wing)', 'active', 4.61, 164, 43.4, 57, now() - interval '5 days'),
  ('Modern Relational Internals', array['Raghuram Rajan', 'Rachel Carson'], '1968100032', '9781968100032', 'OReilly Media', 2008, 816, 'English', 'Computer Science', 'Databases', 'Modern Relational Internals offers a structured, practical exploration of Databases with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Databases
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['postgres', 'sql', 'storage', 'indexing'], 'premium', 290000, 'Floor 2 • Shelf CS-03 (West Wing)', 'active', 4.46, 137, 29.4, 18, now() - interval '7 days'),
  ('Practical Deep Learning Foundations', array['Marty Cagan'], '1968100040', '9781968100049', 'OReilly Media', 2002, 616, 'English', 'Computer Science', 'Artificial Intelligence', 'Practical Deep Learning Foundations offers a structured, practical exploration of Artificial Intelligence with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Artificial Intelligence
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['deep learning', 'neural networks', 'ai', 'tensors'], 'standard', 395000, 'Floor 2 • Shelf CS-04 (West Wing)', 'active', 4.82, 87, 68.2, 50, now() - interval '9 days'),
  ('Zero-Trust Network Defense', array['Cathy ONeil', 'Octavia Butler'], '1968100059', '9781968100056', 'Pragmatic Press', 2021, 456, 'English', 'Computer Science', 'Cybersecurity', 'Zero-Trust Network Defense offers a structured, practical exploration of Cybersecurity with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Cybersecurity
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['security', 'cryptography', 'zero-trust', 'defense'], 'premium', 335000, 'Floor 2 • Shelf CS-05 (West Wing)', 'active', 3.76, 56, 48.2, 26, now() - interval '11 days'),
  ('Concurrency in Systems Programming', array['Judea Pearl'], '1968100067', '9781968100063', 'No Starch Press', 2024, 704, 'English', 'Computer Science', 'Operating Systems', 'Concurrency in Systems Programming offers a structured, practical exploration of Operating Systems with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Operating Systems
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['concurrency', 'threads', 'kernels', 'systems'], 'standard', 325000, 'Floor 2 • Shelf CS-06 (West Wing)', 'active', 4.38, 136, 52.9, 50, now() - interval '13 days'),
  ('Graph Algorithms in Practice', array['Ursula Le Guin'], '1968100075', '9781968100070', 'Pragmatic Press', 2022, 464, 'English', 'Computer Science', 'Algorithms & Data Structures', 'Graph Algorithms in Practice offers a structured, practical exploration of Algorithms & Data Structures with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Algorithms & Data Structures
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['graphs', 'algorithms', 'shortest path', 'optimization'], 'standard', 395000, 'Floor 2 • Shelf CS-07 (West Wing)', 'active', 4.46, 38, 79.8, 13, now() - interval '14 days'),
  ('Event-Driven Platform Engineering', array['Hannah Fry'], '1968100083', '9781968100087', 'MIT Press', 2017, 528, 'English', 'Computer Science', 'Cloud Architecture', 'Event-Driven Platform Engineering offers a structured, practical exploration of Cloud Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Cloud Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['events', 'streaming', 'kafka', 'cloud'], 'standard', 145000, 'Floor 2 • Shelf CS-08 (West Wing)', 'active', 4.02, 32, 76.0, 63, now() - interval '16 days'),
  ('Compiler Construction Essentials', array['Kent Beck', 'Barbara Liskov'], '1968100091', '9781968100094', 'Pragmatic Press', 2012, 384, 'English', 'Computer Science', 'Software Engineering', 'Compiler Construction Essentials offers a structured, practical exploration of Software Engineering with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Software Engineering
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['compilers', 'ast', 'parsers', 'llvm'], 'standard', 335000, 'Floor 2 • Shelf CS-09 (West Wing)', 'active', 4.10, 152, 41.4, 37, now() - interval '18 days'),
  ('Distributed Consensus Explained', array['Martin Kleppmann', 'Christopher Alexander'], '1968100105', '9781968100100', 'Manning Publications', 2012, 608, 'English', 'Computer Science', 'Distributed Systems', 'Distributed Consensus Explained offers a structured, practical exploration of Distributed Systems with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Distributed Systems
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['raft', 'paxos', 'replication', 'fault tolerance'], 'standard', 165000, 'Floor 2 • Shelf CS-10 (West Wing)', 'active', 4.03, 139, 78.4, 30, now() - interval '20 days'),
  ('Applied Natural Language Processing', array['Steven Strogatz'], '1968100113', '9781968100117', 'Addison-Wesley', 2013, 528, 'English', 'Computer Science', 'Artificial Intelligence', 'Applied Natural Language Processing offers a structured, practical exploration of Artificial Intelligence with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Artificial Intelligence
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['nlp', 'transformers', 'embeddings', 'llm'], 'premium', 365000, 'Floor 2 • Shelf CS-11 (West Wing)', 'active', 3.97, 18, 78.2, 13, now() - interval '22 days'),
  ('Web Performance Engineering', array['Amartya Sen', 'Dieter Rams'], '1968100121', '9781968100124', 'Manning Publications', 2014, 728, 'English', 'Computer Science', 'Software Engineering', 'Web Performance Engineering offers a structured, practical exploration of Software Engineering with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Software Engineering
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['web', 'rendering', 'caching', 'latency'], 'standard', 320000, 'Floor 2 • Shelf CS-12 (West Wing)', 'active', 3.91, 13, 30.9, 16, now() - interval '24 days'),
  ('Linux Kernel Internals', array['Eric Evans'], '196810013X', '9781968100131', 'No Starch Press', 2024, 696, 'English', 'Computer Science', 'Operating Systems', 'Linux Kernel Internals offers a structured, practical exploration of Operating Systems with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Operating Systems
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['linux', 'kernel', 'memory', 'schedulers'], 'standard', 160000, 'Floor 2 • Shelf CS-01 (West Wing)', 'active', 4.27, 106, 82.9, 47, now() - interval '26 days'),
  ('Query Optimization Patterns', array['Edward Wilson', 'Ed Yong'], '1968100148', '9781968100148', 'Manning Publications', 2007, 584, 'English', 'Computer Science', 'Databases', 'Query Optimization Patterns offers a structured, practical exploration of Databases with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Databases
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['databases', 'query planner', 'btree', 'transactions'], 'standard', 255000, 'Floor 2 • Shelf CS-02 (West Wing)', 'active', 3.84, 72, 54.7, 66, now() - interval '27 days'),
  ('Protocol Design for Modern Networks', array['Christopher Bishop'], '1968100156', '9781968100155', 'Pragmatic Press', 2003, 368, 'English', 'Computer Science', 'Computer Networks', 'Protocol Design for Modern Networks offers a structured, practical exploration of Computer Networks with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Computer Networks
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['tcp', 'http3', 'quic', 'networking'], 'standard', 240000, 'Floor 2 • Shelf CS-03 (West Wing)', 'active', 4.90, 94, 64.2, 77, now() - interval '29 days'),
  ('Automated Testing at Scale', array['Edward Wilson', 'Arthur Clarke'], '1968100164', '9781968100162', 'Addison-Wesley', 2017, 784, 'English', 'Computer Science', 'Software Engineering', 'Automated Testing at Scale offers a structured, practical exploration of Software Engineering with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Software Engineering
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['testing', 'ci', 'playwright', 'quality'], 'standard', 300000, 'Floor 2 • Shelf CS-04 (West Wing)', 'active', 4.52, 136, 55.6, 76, now() - interval '31 days'),
  ('Cryptography for Application Engineers', array['Rachel Carson'], '1968100172', '9781968100179', 'MIT Press', 2007, 432, 'English', 'Computer Science', 'Cybersecurity', 'Cryptography for Application Engineers offers a structured, practical exploration of Cybersecurity with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Cybersecurity
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['encryption', 'tls', 'hashing', 'authentication'], 'standard', 155000, 'Floor 2 • Shelf CS-05 (West Wing)', 'active', 3.84, 105, 69.6, 69, now() - interval '33 days'),
  ('Reinforcement Learning Studio', array['Andy Weir', 'Ernst Gombrich'], '1968100180', '9781968100186', 'MIT Press', 2019, 368, 'English', 'Computer Science', 'Artificial Intelligence', 'Reinforcement Learning Studio offers a structured, practical exploration of Artificial Intelligence with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Artificial Intelligence
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['rl', 'agents', 'policy gradient', 'ai'], 'premium', 385000, 'Floor 2 • Shelf CS-06 (West Wing)', 'active', 4.10, 127, 35.4, 34, now() - interval '35 days'),
  ('Cloud-Native Observability', array['Hannah Fry'], '1968100199', '9781968100193', 'Addison-Wesley', 2013, 440, 'English', 'Computer Science', 'Cloud Architecture', 'Cloud-Native Observability offers a structured, practical exploration of Cloud Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Cloud Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['metrics', 'tracing', 'logging', 'sre'], 'standard', 400000, 'Floor 2 • Shelf CS-07 (West Wing)', 'active', 3.91, 112, 50.4, 49, now() - interval '37 days'),
  ('Functional Programming Patterns', array['Octavia Butler'], '1968100202', '9781968100209', 'OReilly Media', 2000, 272, 'English', 'Computer Science', 'Software Engineering', 'Functional Programming Patterns offers a structured, practical exploration of Software Engineering with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Software Engineering
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['functional', 'immutability', 'monads', 'composition'], 'premium', 350000, 'Floor 2 • Shelf CS-08 (West Wing)', 'active', 3.97, 39, 73.8, 35, now() - interval '39 days'),
  ('Data Structures for Competitive Coding', array['Arthur Clarke', 'David Thomas'], '1968100210', '9781968100216', 'MIT Press', 2000, 520, 'English', 'Computer Science', 'Algorithms & Data Structures', 'Data Structures for Competitive Coding offers a structured, practical exploration of Algorithms & Data Structures with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Algorithms & Data Structures
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['trees', 'heaps', 'dynamic programming', 'algorithms'], 'standard', 210000, 'Floor 2 • Shelf CS-09 (West Wing)', 'active', 4.00, 96, 74.4, 41, now() - interval '40 days'),
  ('Container Runtime Internals', array['Kazuo Ishiguro', 'Martin Kleppmann'], '1968100229', '9781968100223', 'Pragmatic Press', 2020, 472, 'English', 'Computer Science', 'Cloud Architecture', 'Container Runtime Internals offers a structured, practical exploration of Cloud Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Cloud Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['docker', 'containers', 'cgroups', 'namespaces'], 'premium', 160000, 'Floor 2 • Shelf CS-10 (West Wing)', 'active', 4.60, 165, 55.3, 34, now() - interval '42 days'),
  ('Cấu trúc dữ liệu và giải thuật ứng dụng', array['Tô Khánh Vy'], '604810023X', '9786048100230', 'NXB Đại học Quốc gia TP.HCM', 2006, 360, 'Vietnamese', 'Computer Science', 'Algorithms & Data Structures', 'Cấu trúc dữ liệu và giải thuật ứng dụng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Algorithms & Data Structures, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Algorithms & Data Structures
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['giải thuật', 'cấu trúc dữ liệu', 'lập trình', 'tối ưu'], 'standard', 245000, 'Floor 2 • Shelf CS-11 (West Wing)', 'draft', 4.07, 0, 0.0, 0, now() - interval '44 days'),
  ('Kiến trúc hệ thống phân tán hiện đại', array['Châu Thành Đạt', 'Lý Quang Khải'], '6048100248', '9786048100247', 'NXB Bách Khoa Hà Nội', 2001, 704, 'Vietnamese', 'Computer Science', 'Distributed Systems', 'Kiến trúc hệ thống phân tán hiện đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Distributed Systems, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Distributed Systems
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['hệ phân tán', 'kiến trúc', 'mở rộng', 'đồng bộ'], 'premium', 360000, 'Floor 2 • Shelf CS-12 (West Wing)', 'active', 4.51, 73, 74.6, 51, now() - interval '46 days'),
  ('Nhập môn trí tuệ nhân tạo thực hành', array['Nguyễn Thị Hồng Nhung'], '6048100256', '9786048100254', 'NXB Trẻ', 2013, 776, 'Vietnamese', 'Computer Science', 'Artificial Intelligence', 'Nhập môn trí tuệ nhân tạo thực hành cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Artificial Intelligence, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Artificial Intelligence
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['trí tuệ nhân tạo', 'học máy', 'dữ liệu', 'mô hình'], 'standard', 250000, 'Floor 2 • Shelf CS-01 (West Wing)', 'active', 4.78, 70, 64.1, 67, now() - interval '48 days'),
  ('Thiết kế cơ sở dữ liệu quan hệ', array['Trần Văn Kiên', 'Phạm Anh Thư'], '6048100264', '9786048100261', 'NXB Bách Khoa Hà Nội', 2007, 344, 'Vietnamese', 'Computer Science', 'Databases', 'Thiết kế cơ sở dữ liệu quan hệ cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Databases, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Databases
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['cơ sở dữ liệu', 'sql', 'ràng buộc', 'chỉ mục'], 'standard', 180000, 'Floor 2 • Shelf CS-02 (West Wing)', 'active', 3.81, 21, 49.5, 62, now() - interval '50 days'),
  ('An toàn thông tin và mật mã ứng dụng', array['Đặng Thu Hà'], '6048100272', '9786048100278', 'NXB Trẻ', 2020, 648, 'Vietnamese', 'Computer Science', 'Cybersecurity', 'An toàn thông tin và mật mã ứng dụng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Cybersecurity, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Cybersecurity
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['an toàn thông tin', 'mật mã', 'bảo mật', 'mạng'], 'standard', 350000, 'Floor 2 • Shelf CS-03 (West Wing)', 'active', 4.45, 28, 40.5, 13, now() - interval '51 days'),
  ('Nguyên lý hệ điều hành và tiến trình', array['Phan Nhật Ánh'], '6048100280', '9786048100285', 'NXB Bách Khoa Hà Nội', 2001, 304, 'Vietnamese', 'Computer Science', 'Operating Systems', 'Nguyên lý hệ điều hành và tiến trình cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Operating Systems, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Operating Systems
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['hệ điều hành', 'tiến trình', 'bộ nhớ', 'lập lịch'], 'standard', 220000, 'Floor 2 • Shelf CS-04 (West Wing)', 'active', 4.07, 103, 39.2, 75, now() - interval '53 days'),
  ('Mạng máy tính và giao thức truyền tin', array['Đặng Thu Hà'], '6048100299', '9786048100292', 'NXB Trẻ', 2021, 296, 'Vietnamese', 'Computer Science', 'Computer Networks', 'Mạng máy tính và giao thức truyền tin cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Computer Networks, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Computer Networks
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['mạng máy tính', 'giao thức', 'định tuyến', 'internet'], 'premium', 220000, 'Floor 2 • Shelf CS-05 (West Wing)', 'active', 4.67, 108, 81.1, 37, now() - interval '55 days'),
  ('Kỹ nghệ phần mềm hướng kiểm thử', array['Phan Nhật Ánh'], '6048100302', '9786048100308', 'NXB Thông tin và Truyền thông', 2015, 568, 'Vietnamese', 'Computer Science', 'Software Engineering', 'Kỹ nghệ phần mềm hướng kiểm thử cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Software Engineering, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Software Engineering
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['kiểm thử', 'phần mềm', 'quy trình', 'chất lượng'], 'premium', 160000, 'Floor 2 • Shelf CS-06 (West Wing)', 'active', 3.82, 146, 28.4, 50, now() - interval '57 days'),
  ('Lập trình web toàn diện với JavaScript', array['Mai Xuân Trường'], '6048100310', '9786048100315', 'NXB Thông tin và Truyền thông', 2010, 656, 'Vietnamese', 'Computer Science', 'Software Engineering', 'Lập trình web toàn diện với JavaScript cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Software Engineering, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Software Engineering
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['javascript', 'lập trình web', 'frontend', 'backend'], 'premium', 320000, 'Floor 2 • Shelf CS-07 (West Wing)', 'active', 4.81, 66, 42.4, 28, now() - interval '59 days'),
  ('Điện toán đám mây cho kỹ sư trẻ', array['Châu Thành Đạt', 'Phan Nhật Ánh'], '6048100329', '9786048100322', 'NXB Đại học Quốc gia TP.HCM', 1999, 320, 'Vietnamese', 'Computer Science', 'Cloud Architecture', 'Điện toán đám mây cho kỹ sư trẻ cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Cloud Architecture, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Cloud Architecture
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['đám mây', 'triển khai', 'hạ tầng', 'devops'], 'standard', 205000, 'Floor 2 • Shelf CS-08 (West Wing)', 'active', 3.94, 161, 83.7, 25, now() - interval '61 days'),
  ('Học sâu và thị giác máy tính', array['Lê Minh Triết', 'Dương Hải Yến'], '6048100337', '9786048100339', 'NXB Trẻ', 2005, 760, 'Vietnamese', 'Computer Science', 'Artificial Intelligence', 'Học sâu và thị giác máy tính cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Artificial Intelligence, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Artificial Intelligence
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['học sâu', 'thị giác máy tính', 'mạng nơ-ron', 'ai'], 'standard', 215000, 'Floor 2 • Shelf CS-09 (West Wing)', 'active', 4.59, 52, 76.7, 74, now() - interval '63 days'),
  ('Tối ưu truy vấn và hiệu năng SQL', array['Đinh Văn Sơn', 'Trần Đức Hùng'], '6048100345', '9786048100346', 'NXB Thông tin và Truyền thông', 2005, 536, 'Vietnamese', 'Computer Science', 'Databases', 'Tối ưu truy vấn và hiệu năng SQL cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Databases, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Databases
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['sql', 'hiệu năng', 'truy vấn', 'giao dịch'], 'standard', 330000, 'Floor 2 • Shelf CS-10 (West Wing)', 'active', 4.27, 124, 63.7, 26, now() - interval '64 days'),
  ('Phân tích thiết kế hướng đối tượng', array['Mai Xuân Trường', 'Phan Trọng Nghĩa'], '6048100353', '9786048100353', 'NXB Bách Khoa Hà Nội', 2025, 304, 'Vietnamese', 'Computer Science', 'Software Engineering', 'Phân tích thiết kế hướng đối tượng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Software Engineering, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Software Engineering
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['hướng đối tượng', 'uml', 'thiết kế', 'kiến trúc'], 'premium', 375000, 'Floor 2 • Shelf CS-11 (West Wing)', 'active', 4.58, 169, 43.8, 44, now() - interval '66 days'),
  ('Xây dựng API bền vững và bảo mật', array['Đinh Văn Sơn', 'Kiều Hữu Phước'], '6048100361', '9786048100360', 'NXB Đại học Quốc gia TP.HCM', 2007, 672, 'Vietnamese', 'Computer Science', 'Software Engineering', 'Xây dựng API bền vững và bảo mật cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Software Engineering, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Software Engineering
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['api', 'rest', 'xác thực', 'bảo mật'], 'standard', 395000, 'Floor 2 • Shelf CS-12 (West Wing)', 'active', 4.42, 7, 62.6, 60, now() - interval '68 days'),
  ('Quantum Fields Demystified', array['Edward Wilson'], '1968100377', '9781968100377', 'Basic Press', 1998, 240, 'English', 'Science', 'Quantum Mechanics', 'Quantum Fields Demystified offers a structured, practical exploration of Quantum Mechanics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Quantum Mechanics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['quantum', 'physics', 'fields', 'particles'], 'standard', 350000, 'Floor 2 • Shelf SC-01 (East Wing)', 'active', 4.19, 163, 70.6, 10, now() - interval '70 days'),
  ('Linear Algebra for Data Scientists', array['Cathy ONeil'], '1968100385', '9781968100384', 'Basic Press', 2022, 640, 'English', 'Science', 'Mathematics', 'Linear Algebra for Data Scientists offers a structured, practical exploration of Mathematics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mathematics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['linear algebra', 'matrices', 'eigenvalues', 'math'], 'premium', 225000, 'Floor 2 • Shelf SC-02 (East Wing)', 'active', 4.13, 62, 54.5, 73, now() - interval '72 days'),
  ('Bayesian Thinking in Practice', array['Yuval Harari'], '1968100393', '9781968100391', 'Basic Press', 2001, 248, 'English', 'Science', 'Statistics', 'Bayesian Thinking in Practice offers a structured, practical exploration of Statistics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Statistics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['bayesian', 'probability', 'inference', 'statistics'], 'standard', 280000, 'Floor 2 • Shelf SC-03 (East Wing)', 'active', 4.08, 46, 38.6, 71, now() - interval '74 days'),
  ('The Fabric of Cosmology', array['Dieter Rams'], '1968100407', '9781968100407', 'Princeton University Press', 2025, 320, 'English', 'Science', 'Astronomy', 'The Fabric of Cosmology offers a structured, practical exploration of Astronomy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Astronomy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['cosmology', 'galaxies', 'astrophysics', 'space'], 'premium', 145000, 'Floor 2 • Shelf SC-04 (East Wing)', 'active', 4.18, 148, 37.6, 24, now() - interval '76 days'),
  ('Mapping the Human Connectome', array['Rob Pike'], '1968100415', '9781968100414', 'Basic Press', 2002, 536, 'English', 'Science', 'Neuroscience', 'Mapping the Human Connectome offers a structured, practical exploration of Neuroscience with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Neuroscience
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['neuroscience', 'brain', 'synapses', 'cognition'], 'standard', 310000, 'Floor 2 • Shelf SC-05 (East Wing)', 'active', 4.75, 38, 34.1, 29, now() - interval '77 days'),
  ('Statistical Learning and Prediction', array['Daron Acemoglu'], '1968100423', '9781968100421', 'Oxford University Press', 2018, 584, 'English', 'Science', 'Data Science', 'Statistical Learning and Prediction offers a structured, practical exploration of Data Science with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Data Science
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['regression', 'classification', 'data science', 'modeling'], 'standard', 125000, 'Floor 2 • Shelf SC-06 (East Wing)', 'active', 4.45, 31, 73.1, 75, now() - interval '79 days'),
  ('Thermodynamics and Entropy', array['Neal Stephenson'], '1968100431', '9781968100438', 'Oxford University Press', 2002, 472, 'English', 'Science', 'Physics', 'Thermodynamics and Entropy offers a structured, practical exploration of Physics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Physics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['thermodynamics', 'energy', 'entropy', 'mechanics'], 'premium', 140000, 'Floor 2 • Shelf SC-07 (East Wing)', 'active', 4.68, 64, 59.3, 25, now() - interval '81 days'),
  ('Calculus of Variations', array['Edward Tufte'], '196810044X', '9781968100445', 'Basic Press', 2007, 656, 'English', 'Science', 'Mathematics', 'Calculus of Variations offers a structured, practical exploration of Mathematics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mathematics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['calculus', 'analysis', 'optimization', 'differential'], 'premium', 275000, 'Floor 2 • Shelf SC-08 (East Wing)', 'active', 4.24, 69, 28.3, 76, now() - interval '83 days'),
  ('Planetary Climate Dynamics', array['John Berger'], '1968100458', '9781968100452', 'Basic Press', 2011, 288, 'English', 'Science', 'Climate Science', 'Planetary Climate Dynamics offers a structured, practical exploration of Climate Science with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Climate Science
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['climate', 'atmosphere', 'oceans', 'modeling'], 'standard', 280000, 'Floor 2 • Shelf SC-09 (East Wing)', 'active', 3.98, 76, 37.2, 30, now() - interval '85 days'),
  ('Signals, Noise, and Information', array['Arthur Clarke', 'Christopher Bishop'], '1968100466', '9781968100469', 'Basic Press', 2002, 488, 'English', 'Science', 'Data Science', 'Signals, Noise, and Information offers a structured, practical exploration of Data Science with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Data Science
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['information theory', 'signals', 'entropy', 'analytics'], 'premium', 310000, 'Floor 2 • Shelf SC-10 (East Wing)', 'active', 4.53, 149, 75.8, 30, now() - interval '87 days'),
  ('Relativity and Curved Spacetime', array['Marty Cagan', 'Malcolm Gladwell'], '1968100474', '9781968100476', 'Princeton University Press', 2017, 320, 'English', 'Science', 'Physics', 'Relativity and Curved Spacetime offers a structured, practical exploration of Physics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Physics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['relativity', 'gravity', 'spacetime', 'einstein'], 'standard', 165000, 'Floor 2 • Shelf SC-11 (East Wing)', 'draft', 4.66, 0, 0.0, 0, now() - interval '88 days'),
  ('Number Theory and Prime Mysteries', array['Steven Strogatz'], '1968100482', '9781968100483', 'Penguin Science', 2016, 616, 'English', 'Science', 'Mathematics', 'Number Theory and Prime Mysteries offers a structured, practical exploration of Mathematics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mathematics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['primes', 'number theory', 'modular', 'proofs'], 'premium', 310000, 'Floor 2 • Shelf SC-12 (East Wing)', 'active', 4.85, 164, 46.2, 47, now() - interval '90 days'),
  ('Exoplanets Beyond the Solar Rim', array['Margaret Atwood'], '1968100490', '9781968100490', 'Penguin Science', 2013, 248, 'English', 'Science', 'Astronomy', 'Exoplanets Beyond the Solar Rim offers a structured, practical exploration of Astronomy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Astronomy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['exoplanets', 'telescopes', 'astronomy', 'orbits'], 'standard', 175000, 'Floor 2 • Shelf SC-01 (East Wing)', 'active', 3.75, 148, 68.4, 11, now() - interval '92 days'),
  ('Memory, Sleep, and Neural Plasticity', array['Isaac Asimov', 'Brian Greene'], '1968100504', '9781968100506', 'Princeton University Press', 2014, 544, 'English', 'Science', 'Neuroscience', 'Memory, Sleep, and Neural Plasticity offers a structured, practical exploration of Neuroscience with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Neuroscience
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['memory', 'neurobiology', 'sleep', 'plasticity'], 'standard', 280000, 'Floor 2 • Shelf SC-02 (East Wing)', 'active', 4.26, 163, 59.9, 80, now() - interval '94 days'),
  ('Causal Inference for Researchers', array['Nassim Taleb', 'Jane Goodall'], '1968100512', '9781968100513', 'Penguin Science', 2020, 248, 'English', 'Science', 'Statistics', 'Causal Inference for Researchers offers a structured, practical exploration of Statistics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Statistics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['causality', 'experiments', 'statistics', 'econometrics'], 'premium', 205000, 'Floor 2 • Shelf SC-03 (East Wing)', 'active', 4.54, 97, 81.6, 51, now() - interval '96 days'),
  ('Optics and Photonics Fundamentals', array['Donald Knuth'], '1968100520', '9781968100520', 'Oxford University Press', 2001, 376, 'English', 'Science', 'Physics', 'Optics and Photonics Fundamentals offers a structured, practical exploration of Physics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Physics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['optics', 'lasers', 'photonics', 'waves'], 'premium', 315000, 'Floor 2 • Shelf SC-04 (East Wing)', 'active', 4.90, 110, 45.0, 48, now() - interval '98 days'),
  ('Stochastic Processes Made Clear', array['Rachel Carson'], '1968100539', '9781968100537', 'Basic Press', 2026, 432, 'English', 'Science', 'Mathematics', 'Stochastic Processes Made Clear offers a structured, practical exploration of Mathematics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mathematics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['markov', 'stochastic', 'random', 'probability'], 'standard', 295000, 'Floor 2 • Shelf SC-05 (East Wing)', 'active', 4.32, 95, 84.3, 37, now() - interval '100 days'),
  ('Computational Astrophysics', array['Kazuo Ishiguro'], '1968100547', '9781968100544', 'Penguin Science', 1998, 504, 'English', 'Science', 'Astronomy', 'Computational Astrophysics offers a structured, practical exploration of Astronomy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Astronomy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['simulations', 'stars', 'astrophysics', 'numerical'], 'premium', 295000, 'Floor 2 • Shelf SC-06 (East Wing)', 'active', 3.97, 21, 65.4, 3, now() - interval '101 days'),
  ('Experimental Design Essentials', array['Ted Chiang', 'Ursula Le Guin'], '1968100555', '9781968100551', 'Basic Press', 2013, 520, 'English', 'Science', 'Statistics', 'Experimental Design Essentials offers a structured, practical exploration of Statistics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Statistics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['ab testing', 'experiments', 'sampling', 'hypothesis'], 'standard', 240000, 'Floor 2 • Shelf SC-07 (East Wing)', 'active', 4.07, 31, 38.9, 59, now() - interval '103 days'),
  ('Electromagnetism in Modern Tech', array['Judea Pearl'], '1968100563', '9781968100568', 'Princeton University Press', 2006, 592, 'English', 'Science', 'Physics', 'Electromagnetism in Modern Tech offers a structured, practical exploration of Physics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Physics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['electromagnetism', 'maxwell', 'circuits', 'waves'], 'standard', 315000, 'Floor 2 • Shelf SC-08 (East Wing)', 'active', 3.79, 140, 36.9, 9, now() - interval '105 days'),
  ('Topology Through Visual Intuition', array['Rob Pike', 'Christopher Alexander'], '1968100571', '9781968100575', 'Basic Press', 2012, 480, 'English', 'Science', 'Mathematics', 'Topology Through Visual Intuition offers a structured, practical exploration of Mathematics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mathematics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['topology', 'geometry', 'manifolds', 'spaces'], 'standard', 320000, 'Floor 2 • Shelf SC-09 (East Wing)', 'active', 4.79, 58, 49.2, 11, now() - interval '107 days'),
  ('Vật lý lượng tử cho người mới bắt đầu', array['Đỗ Mỹ Duyên', 'Trần Văn Kiên'], '6048100582', '9786048100582', 'NXB Giáo dục Việt Nam', 2008, 608, 'Vietnamese', 'Science', 'Quantum Mechanics', 'Vật lý lượng tử cho người mới bắt đầu cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Quantum Mechanics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Quantum Mechanics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['lượng tử', 'vật lý', 'nguyên tử', 'năng lượng'], 'standard', 305000, 'Floor 2 • Shelf SC-10 (East Wing)', 'active', 4.01, 104, 79.8, 59, now() - interval '109 days'),
  ('Đại số tuyến tính và ứng dụng kỹ thuật', array['Lý Quang Khải'], '6048100590', '9786048100599', 'NXB Giáo dục Việt Nam', 2002, 432, 'Vietnamese', 'Science', 'Mathematics', 'Đại số tuyến tính và ứng dụng kỹ thuật cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mathematics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mathematics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['đại số tuyến tính', 'ma trận', 'vectơ', 'toán học'], 'premium', 165000, 'Floor 2 • Shelf SC-11 (East Wing)', 'active', 4.67, 57, 73.2, 54, now() - interval '111 days'),
  ('Xác suất thống kê trong phân tích dữ liệu', array['Bùi Thanh Tùng'], '6048100604', '9786048100605', 'NXB Đại học Quốc gia Hà Nội', 2010, 416, 'Vietnamese', 'Science', 'Statistics', 'Xác suất thống kê trong phân tích dữ liệu cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Statistics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Statistics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['xác suất', 'thống kê', 'dữ liệu', 'suy luận'], 'standard', 250000, 'Floor 2 • Shelf SC-12 (East Wing)', 'active', 4.10, 149, 50.0, 50, now() - interval '113 days'),
  ('Thiên văn học và hành trình khám phá vũ trụ', array['Nguyễn Minh Tuấn'], '6048100612', '9786048100612', 'NXB Tri thức', 2018, 632, 'Vietnamese', 'Science', 'Astronomy', 'Thiên văn học và hành trình khám phá vũ trụ cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Astronomy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Astronomy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thiên văn', 'vũ trụ', 'hành tinh', 'ngân hà'], 'standard', 335000, 'Floor 2 • Shelf SC-01 (East Wing)', 'active', 4.18, 166, 74.1, 22, now() - interval '114 days'),
  ('Thần kinh học về trí nhớ và tập trung', array['Phan Trọng Nghĩa', 'Đặng Công Danh'], '6048100620', '9786048100629', 'NXB Giáo dục Việt Nam', 2012, 216, 'Vietnamese', 'Science', 'Neuroscience', 'Thần kinh học về trí nhớ và tập trung cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Neuroscience, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Neuroscience
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thần kinh', 'não bộ', 'trí nhớ', 'nhận thức'], 'premium', 320000, 'Floor 2 • Shelf SC-02 (East Wing)', 'active', 3.96, 30, 72.4, 11, now() - interval '116 days'),
  ('Giải tích nhiều biến và phương trình vi phân', array['Kiều Hữu Phước', 'Đinh Văn Sơn'], '6048100639', '9786048100636', 'NXB Thế giới', 2016, 488, 'Vietnamese', 'Science', 'Mathematics', 'Giải tích nhiều biến và phương trình vi phân cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mathematics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mathematics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['giải tích', 'vi phân', 'tích phân', 'toán cao cấp'], 'standard', 285000, 'Floor 2 • Shelf SC-03 (East Wing)', 'active', 4.90, 137, 48.3, 19, now() - interval '118 days'),
  ('Biến đổi khí hậu và năng lượng tái tạo', array['Phan Nhật Ánh', 'Lương Thảo Nguyên'], '6048100647', '9786048100643', 'NXB Giáo dục Việt Nam', 2026, 360, 'Vietnamese', 'Science', 'Climate Science', 'Biến đổi khí hậu và năng lượng tái tạo cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Climate Science, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Climate Science
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['khí hậu', 'năng lượng', 'môi trường', 'bền vững'], 'standard', 320000, 'Floor 2 • Shelf SC-04 (East Wing)', 'active', 4.87, 47, 48.3, 63, now() - interval '120 days'),
  ('Cơ học cổ điển và dao động sóng', array['Phạm Quốc Bảo'], '6048100655', '9786048100650', 'NXB Giáo dục Việt Nam', 2007, 656, 'Vietnamese', 'Science', 'Physics', 'Cơ học cổ điển và dao động sóng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Physics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Physics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['cơ học', 'dao động', 'sóng', 'vật lý'], 'standard', 175000, 'Floor 2 • Shelf SC-05 (East Wing)', 'active', 4.54, 85, 41.4, 76, now() - interval '122 days'),
  ('Phân tích dữ liệu từ lý thuyết đến mô hình', array['Tô Khánh Vy'], '6048100663', '9786048100667', 'NXB Đại học Quốc gia Hà Nội', 2013, 592, 'Vietnamese', 'Science', 'Data Science', 'Phân tích dữ liệu từ lý thuyết đến mô hình cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Data Science, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Data Science
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['dữ liệu', 'mô hình', 'phân tích', 'dự báo'], 'premium', 235000, 'Floor 2 • Shelf SC-06 (East Wing)', 'active', 4.74, 65, 54.4, 25, now() - interval '124 days'),
  ('Toán rời rạc và logic hình thức', array['Phạm Anh Thư', 'Bùi Thanh Tùng'], '6048100671', '9786048100674', 'NXB Thế giới', 2021, 408, 'Vietnamese', 'Science', 'Mathematics', 'Toán rời rạc và logic hình thức cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mathematics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mathematics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['toán rời rạc', 'logic', 'tổ hợp', 'đồ thị'], 'standard', 225000, 'Floor 2 • Shelf SC-07 (East Wing)', 'active', 4.72, 82, 68.3, 23, now() - interval '125 days'),
  ('Quang học ứng dụng và công nghệ laser', array['Ngô Gia Huy'], '604810068X', '9786048100681', 'NXB Giáo dục Việt Nam', 2023, 248, 'Vietnamese', 'Science', 'Physics', 'Quang học ứng dụng và công nghệ laser cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Physics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Physics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['quang học', 'ánh sáng', 'laser', 'vật lý'], 'standard', 345000, 'Floor 2 • Shelf SC-08 (East Wing)', 'active', 3.87, 50, 73.1, 66, now() - interval '127 days'),
  ('Phân tích chuỗi thời gian hiện đại', array['Vũ Bảo Ngọc', 'Phan Trọng Nghĩa'], '6048100698', '9786048100698', 'NXB Đại học Quốc gia Hà Nội', 2008, 520, 'Vietnamese', 'Science', 'Statistics', 'Phân tích chuỗi thời gian hiện đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Statistics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Statistics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['chuỗi thời gian', 'dự báo', 'thống kê', 'mô hình'], 'standard', 120000, 'Floor 2 • Shelf SC-09 (East Wing)', 'active', 4.48, 40, 57.7, 44, now() - interval '129 days'),
  ('Địa vật lý và cấu trúc hành tinh', array['Phan Nhật Ánh'], '6048100701', '9786048100704', 'NXB Tri thức', 2015, 416, 'Vietnamese', 'Science', 'Astronomy', 'Địa vật lý và cấu trúc hành tinh cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Astronomy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Astronomy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['địa vật lý', 'trái đất', 'hành tinh', 'kiến tạo'], 'standard', 155000, 'Floor 2 • Shelf SC-10 (East Wing)', 'active', 4.66, 43, 30.4, 57, now() - interval '131 days'),
  ('Deep Focus in a Noisy Era', array['Peter Norvig'], '1968100717', '9781968100711', 'Simon & Schuster', 2010, 216, 'English', 'Non-Fiction', 'Productivity', 'Deep Focus in a Noisy Era offers a structured, practical exploration of Productivity with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Productivity
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['focus', 'deep work', 'attention', 'habits'], 'standard', 175000, 'Floor 1 • Shelf NF-01 (North Wing)', 'draft', 4.11, 0, 0.0, 0, now() - interval '133 days'),
  ('Behavioral Economics Explained', array['Julie Zhuo'], '1968100725', '9781968100728', 'Penguin Random House', 2004, 384, 'English', 'Non-Fiction', 'Economics', 'Behavioral Economics Explained offers a structured, practical exploration of Economics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Economics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['behavioral', 'decisions', 'markets', 'incentives'], 'standard', 190000, 'Floor 1 • Shelf NF-02 (North Wing)', 'active', 4.62, 98, 68.4, 8, now() - interval '135 days'),
  ('Systems Thinking for Leaders', array['Andy Weir', 'Barbara Liskov'], '1968100733', '9781968100735', 'HarperCollins', 2010, 288, 'English', 'Non-Fiction', 'Management', 'Systems Thinking for Leaders offers a structured, practical exploration of Management with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Management
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['systems', 'strategy', 'leadership', 'organizations'], 'premium', 145000, 'Floor 1 • Shelf NF-03 (North Wing)', 'active', 4.18, 145, 55.8, 36, now() - interval '137 days'),
  ('The Silk Roads of Innovation', array['Sean Carroll'], '1968100741', '9781968100742', 'Riverhead Press', 2003, 416, 'English', 'Non-Fiction', 'History', 'The Silk Roads of Innovation offers a structured, practical exploration of History with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of History
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['trade', 'history', 'civilizations', 'innovation'], 'premium', 150000, 'Floor 1 • Shelf NF-04 (North Wing)', 'active', 4.70, 94, 48.5, 40, now() - interval '138 days'),
  ('Cognitive Biases and Clear Judgment', array['Octavia Butler', 'Neal Stephenson'], '196810075X', '9781968100759', 'Portfolio Press', 2024, 224, 'English', 'Non-Fiction', 'Psychology', 'Cognitive Biases and Clear Judgment offers a structured, practical exploration of Psychology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Psychology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['psychology', 'bias', 'reasoning', 'mind'], 'standard', 120000, 'Floor 1 • Shelf NF-05 (North Wing)', 'active', 3.79, 144, 69.2, 62, now() - interval '140 days'),
  ('Product Discovery Playbook', array['Andrew Hunt'], '1968100768', '9781968100766', 'Riverhead Press', 2024, 488, 'English', 'Non-Fiction', 'UX & Design', 'Product Discovery Playbook offers a structured, practical exploration of UX & Design with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of UX & Design
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['product', 'discovery', 'users', 'prototyping'], 'standard', 285000, 'Floor 1 • Shelf NF-06 (North Wing)', 'active', 4.34, 170, 37.2, 58, now() - interval '142 days'),
  ('Ethics in the Age of Automation', array['Dieter Rams', 'Steven Strogatz'], '1968100776', '9781968100773', 'Penguin Random House', 2004, 384, 'English', 'Non-Fiction', 'Philosophy', 'Ethics in the Age of Automation offers a structured, practical exploration of Philosophy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Philosophy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['ethics', 'philosophy', 'technology', 'society'], 'standard', 95000, 'Floor 1 • Shelf NF-07 (North Wing)', 'active', 4.77, 147, 57.7, 16, now() - interval '144 days'),
  ('Macroeconomics and Global Trade', array['Kazuo Ishiguro'], '1968100784', '9781968100780', 'Simon & Schuster', 2018, 280, 'English', 'Non-Fiction', 'Economics', 'Macroeconomics and Global Trade offers a structured, practical exploration of Economics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Economics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['macroeconomics', 'inflation', 'trade', 'policy'], 'standard', 260000, 'Floor 1 • Shelf NF-08 (North Wing)', 'active', 4.78, 108, 68.0, 76, now() - interval '146 days'),
  ('Urban Sociology and Public Space', array['Barbara Liskov'], '1968100792', '9781968100797', 'HarperCollins', 2003, 480, 'English', 'Non-Fiction', 'Sociology', 'Urban Sociology and Public Space offers a structured, practical exploration of Sociology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sociology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['cities', 'communities', 'sociology', 'urban'], 'standard', 205000, 'Floor 1 • Shelf NF-09 (North Wing)', 'active', 3.95, 32, 46.2, 77, now() - interval '148 days'),
  ('Negotiation Without Compromise', array['Jane Goodall', 'Barbara Liskov'], '1968100806', '9781968100803', 'HarperCollins', 2019, 200, 'English', 'Non-Fiction', 'Management', 'Negotiation Without Compromise offers a structured, practical exploration of Management with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Management
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['negotiation', 'communication', 'strategy', 'leadership'], 'standard', 280000, 'Floor 1 • Shelf NF-10 (North Wing)', 'active', 3.99, 161, 64.0, 64, now() - interval '150 days'),
  ('Research Methods in Human Factors', array['Haruki Murakami', 'Stuart Russell'], '1968100814', '9781968100810', 'Simon & Schuster', 1998, 496, 'English', 'Non-Fiction', 'UX & Design', 'Research Methods in Human Factors offers a structured, practical exploration of UX & Design with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of UX & Design
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['ux research', 'interviews', 'usability', 'design'], 'premium', 100000, 'Floor 1 • Shelf NF-11 (North Wing)', 'active', 3.85, 63, 60.9, 57, now() - interval '151 days'),
  ('The Craft of Clear Technical Writing', array['Ed Yong'], '1968100822', '9781968100827', 'Penguin Random House', 2021, 368, 'English', 'Non-Fiction', 'Productivity', 'The Craft of Clear Technical Writing offers a structured, practical exploration of Productivity with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Productivity
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['writing', 'clarity', 'documentation', 'communication'], 'standard', 280000, 'Floor 1 • Shelf NF-12 (North Wing)', 'active', 3.99, 13, 53.6, 14, now() - interval '153 days'),
  ('Stoic Principles for Modern Work', array['Steven Strogatz'], '1968100830', '9781968100834', 'Simon & Schuster', 2008, 520, 'English', 'Non-Fiction', 'Philosophy', 'Stoic Principles for Modern Work offers a structured, practical exploration of Philosophy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Philosophy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['stoicism', 'resilience', 'philosophy', 'mindset'], 'standard', 215000, 'Floor 1 • Shelf NF-01 (North Wing)', 'active', 4.47, 146, 40.5, 14, now() - interval '155 days'),
  ('Financial Markets and Valuation', array['Daniel Kahneman'], '1968100849', '9781968100841', 'Portfolio Press', 2003, 336, 'English', 'Non-Fiction', 'Economics', 'Financial Markets and Valuation offers a structured, practical exploration of Economics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Economics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['finance', 'markets', 'valuation', 'investing'], 'standard', 285000, 'Floor 1 • Shelf NF-02 (North Wing)', 'active', 4.87, 89, 57.2, 60, now() - interval '157 days'),
  ('Maritime Empires of Southeast Asia', array['Kazuo Ishiguro', 'Rachel Carson'], '1968100857', '9781968100858', 'Riverhead Press', 2015, 376, 'English', 'Non-Fiction', 'History', 'Maritime Empires of Southeast Asia offers a structured, practical exploration of History with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of History
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['southeast asia', 'maritime', 'history', 'trade'], 'premium', 265000, 'Floor 1 • Shelf NF-03 (North Wing)', 'active', 4.84, 72, 80.8, 64, now() - interval '159 days'),
  ('Team Topologies and Collaboration', array['Margaret Atwood', 'Yuval Harari'], '1968100865', '9781968100865', 'Portfolio Press', 2015, 288, 'English', 'Non-Fiction', 'Management', 'Team Topologies and Collaboration offers a structured, practical exploration of Management with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Management
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['teams', 'organization', 'collaboration', 'agile'], 'standard', 265000, 'Floor 1 • Shelf NF-04 (North Wing)', 'active', 4.79, 75, 33.2, 26, now() - interval '161 days'),
  ('The Psychology of Motivation', array['Martin Kleppmann'], '1968100873', '9781968100872', 'Simon & Schuster', 2017, 208, 'English', 'Non-Fiction', 'Psychology', 'The Psychology of Motivation offers a structured, practical exploration of Psychology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Psychology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['motivation', 'flow', 'intrinsic', 'learning'], 'standard', 165000, 'Floor 1 • Shelf NF-05 (North Wing)', 'active', 4.01, 19, 36.4, 37, now() - interval '162 days'),
  ('Critical Thinking Toolkit', array['Malcolm Gladwell', 'Jane Goodall'], '1968100881', '9781968100889', 'HarperCollins', 2025, 376, 'English', 'Non-Fiction', 'Philosophy', 'Critical Thinking Toolkit offers a structured, practical exploration of Philosophy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Philosophy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['logic', 'arguments', 'critical thinking', 'evidence'], 'standard', 155000, 'Floor 1 • Shelf NF-06 (North Wing)', 'active', 4.65, 50, 66.0, 7, now() - interval '164 days'),
  ('Digital Economy and Platform Strategy', array['Arthur Clarke', 'Marty Cagan'], '196810089X', '9781968100896', 'Portfolio Press', 2005, 480, 'English', 'Non-Fiction', 'Economics', 'Digital Economy and Platform Strategy offers a structured, practical exploration of Economics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Economics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['platforms', 'network effects', 'economics', 'digital'], 'standard', 255000, 'Floor 1 • Shelf NF-07 (North Wing)', 'active', 4.36, 52, 48.6, 30, now() - interval '166 days'),
  ('Social Networks and Collective Behavior', array['Donald Knuth'], '1968100903', '9781968100902', 'Riverhead Press', 2010, 464, 'English', 'Non-Fiction', 'Sociology', 'Social Networks and Collective Behavior offers a structured, practical exploration of Sociology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sociology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['networks', 'influence', 'society', 'behavior'], 'standard', 140000, 'Floor 1 • Shelf NF-08 (North Wing)', 'active', 4.28, 30, 69.8, 62, now() - interval '168 days'),
  ('Accessible Digital Interfaces', array['Brian Greene', 'Haruki Murakami'], '1968100911', '9781968100919', 'Penguin Random House', 2012, 192, 'English', 'Non-Fiction', 'UX & Design', 'Accessible Digital Interfaces offers a structured, practical exploration of UX & Design with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of UX & Design
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['accessibility', 'wcag', 'inclusive design', 'ui'], 'premium', 115000, 'Floor 1 • Shelf NF-09 (North Wing)', 'active', 4.79, 41, 41.7, 15, now() - interval '170 days'),
  ('Kinh tế học vi mô và quyết định thị trường', array['Lê Minh Triết'], '6048100922', '9786048100926', 'NXB Trẻ', 2020, 328, 'Vietnamese', 'Non-Fiction', 'Economics', 'Kinh tế học vi mô và quyết định thị trường cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Economics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Economics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['kinh tế vi mô', 'thị trường', 'cung cầu', 'chiến lược'], 'standard', 185000, 'Floor 1 • Shelf NF-10 (North Wing)', 'active', 4.76, 87, 77.7, 57, now() - interval '172 days'),
  ('Tâm lý học hành vi trong đời sống hiện đại', array['Lý Quang Khải'], '6048100930', '9786048100933', 'NXB Trẻ', 2020, 472, 'Vietnamese', 'Non-Fiction', 'Psychology', 'Tâm lý học hành vi trong đời sống hiện đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Psychology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Psychology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['tâm lý học', 'hành vi', 'quyết định', 'nhận thức'], 'standard', 265000, 'Floor 1 • Shelf NF-11 (North Wing)', 'active', 4.18, 62, 52.0, 36, now() - interval '174 days'),
  ('Phương pháp quản lý thời gian cho sinh viên', array['Đinh Văn Sơn'], '6048100949', '9786048100940', 'NXB Lao động', 2009, 488, 'Vietnamese', 'Non-Fiction', 'Productivity', 'Phương pháp quản lý thời gian cho sinh viên cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Productivity, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Productivity
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['quản lý thời gian', 'hiệu suất', 'tập trung', 'kỹ năng'], 'standard', 210000, 'Floor 1 • Shelf NF-12 (North Wing)', 'active', 4.40, 74, 46.4, 21, now() - interval '175 days'),
  ('Lịch sử thương mại Đông Nam Á cổ trung đại', array['Ngô Gia Huy'], '6048100957', '9786048100957', 'NXB Trẻ', 1999, 472, 'Vietnamese', 'Non-Fiction', 'History', 'Lịch sử thương mại Đông Nam Á cổ trung đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực History, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về History
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['lịch sử', 'đông nam á', 'thương mại', 'biển đảo'], 'standard', 150000, 'Floor 1 • Shelf NF-01 (North Wing)', 'draft', 4.13, 0, 0.0, 0, now() - interval '177 days'),
  ('Tư duy phản biện và lập luận sắc bén', array['Ngô Tấn Phát', 'Đặng Thu Hà'], '6048100965', '9786048100964', 'NXB Trẻ', 2024, 288, 'Vietnamese', 'Non-Fiction', 'Philosophy', 'Tư duy phản biện và lập luận sắc bén cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Philosophy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Philosophy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['tư duy phản biện', 'lập luận', 'triết học', 'logic'], 'standard', 185000, 'Floor 1 • Shelf NF-02 (North Wing)', 'active', 4.86, 95, 44.4, 5, now() - interval '179 days'),
  ('Thiết kế trải nghiệm người dùng thực chiến', array['Lê Minh Triết'], '6048100973', '9786048100971', 'NXB Trẻ', 2013, 208, 'Vietnamese', 'Non-Fiction', 'UX & Design', 'Thiết kế trải nghiệm người dùng thực chiến cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực UX & Design, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về UX & Design
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['trải nghiệm người dùng', 'ux', 'giao diện', 'nghiên cứu'], 'premium', 165000, 'Floor 1 • Shelf NF-03 (North Wing)', 'active', 4.12, 114, 49.7, 30, now() - interval '181 days'),
  ('Quản trị dự án tinh gọn trong doanh nghiệp', array['Trịnh Ngọc Bích'], '6048100981', '9786048100988', 'NXB Trẻ', 2000, 424, 'Vietnamese', 'Non-Fiction', 'Management', 'Quản trị dự án tinh gọn trong doanh nghiệp cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Management, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Management
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['quản trị dự án', 'agile', 'lãnh đạo', 'nhóm'], 'premium', 205000, 'Floor 1 • Shelf NF-04 (North Wing)', 'active', 4.14, 11, 71.3, 63, now() - interval '183 days'),
  ('Xã hội học đô thị và không gian cộng đồng', array['Trần Văn Kiên', 'Kiều Hữu Phước'], '604810099X', '9786048100995', 'NXB Tri thức', 2021, 248, 'Vietnamese', 'Non-Fiction', 'Sociology', 'Xã hội học đô thị và không gian cộng đồng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Sociology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Sociology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['xã hội học', 'đô thị', 'cộng đồng', 'phát triển'], 'standard', 110000, 'Floor 1 • Shelf NF-05 (North Wing)', 'active', 4.18, 119, 45.2, 78, now() - interval '185 days'),
  ('Tài chính cá nhân và đầu tư bền vững', array['Bùi Thanh Tùng'], '6048101007', '9786048101008', 'NXB Tổng hợp TP.HCM', 2024, 376, 'Vietnamese', 'Non-Fiction', 'Economics', 'Tài chính cá nhân và đầu tư bền vững cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Economics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Economics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['tài chính', 'đầu tư', 'tiết kiệm', 'quản lý'], 'premium', 130000, 'Floor 1 • Shelf NF-06 (North Wing)', 'active', 4.60, 149, 32.8, 40, now() - interval '187 days'),
  ('Nghệ thuật thuyết trình và giao tiếp thuyết phục', array['Kiều Hữu Phước'], '6048101015', '9786048101015', 'NXB Trẻ', 1999, 288, 'Vietnamese', 'Non-Fiction', 'Productivity', 'Nghệ thuật thuyết trình và giao tiếp thuyết phục cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Productivity, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Productivity
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['giao tiếp', 'thuyết trình', 'kỹ năng mềm', 'tự tin'], 'standard', 270000, 'Floor 1 • Shelf NF-07 (North Wing)', 'active', 4.07, 68, 40.5, 65, now() - interval '188 days'),
  ('Lịch sử giáo dục đại học thế giới', array['Vũ Bảo Ngọc'], '6048101023', '9786048101022', 'NXB Trẻ', 2013, 304, 'Vietnamese', 'Non-Fiction', 'History', 'Lịch sử giáo dục đại học thế giới cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực History, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về History
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['lịch sử', 'giáo dục', 'đại học', 'tri thức'], 'standard', 220000, 'Floor 1 • Shelf NF-08 (North Wing)', 'active', 4.42, 155, 43.2, 44, now() - interval '190 days'),
  ('Đạo đức công nghệ trong kỷ nguyên số', array['Nguyễn Minh Tuấn'], '6048101031', '9786048101039', 'NXB Tổng hợp TP.HCM', 2016, 200, 'Vietnamese', 'Non-Fiction', 'Philosophy', 'Đạo đức công nghệ trong kỷ nguyên số cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Philosophy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Philosophy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['đạo đức', 'công nghệ', 'triết học', 'xã hội'], 'premium', 135000, 'Floor 1 • Shelf NF-09 (North Wing)', 'active', 4.08, 155, 44.0, 12, now() - interval '192 days'),
  ('Khởi nghiệp tinh gọn và kiểm chứng thị trường', array['Bùi Thanh Tùng'], '604810104X', '9786048101046', 'NXB Trẻ', 2007, 424, 'Vietnamese', 'Non-Fiction', 'Management', 'Khởi nghiệp tinh gọn và kiểm chứng thị trường cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Management, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Management
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['khởi nghiệp', 'sản phẩm', 'thị trường', 'đổi mới'], 'standard', 245000, 'Floor 1 • Shelf NF-10 (North Wing)', 'active', 4.29, 7, 78.1, 19, now() - interval '194 days'),
  ('The Glass Observatory', array['Judea Pearl'], '1968101055', '9781968101053', 'Faber & Faber', 2002, 216, 'English', 'Fiction', 'Sci-Fi', 'The Glass Observatory offers a structured, practical exploration of Sci-Fi with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sci-Fi
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['sci-fi', 'space', 'observatory', 'novel'], 'standard', 140000, 'Floor 3 • Shelf FI-01 (South Wing)', 'active', 4.88, 167, 29.9, 3, now() - interval '196 days'),
  ('Letters from the Harbor', array['Jane Goodall'], '1968101063', '9781968101060', 'Gollancz', 2019, 280, 'English', 'Fiction', 'Literary Fiction', 'Letters from the Harbor offers a structured, practical exploration of Literary Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Literary Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['literary', 'letters', 'coastal', 'drama'], 'premium', 235000, 'Floor 3 • Shelf FI-02 (South Wing)', 'active', 4.14, 70, 55.9, 49, now() - interval '198 days'),
  ('Midnight on the Eastern Express', array['Yuval Harari', 'Kent Beck'], '1968101071', '9781968101077', 'Gollancz', 2000, 272, 'English', 'Fiction', 'Mystery & Thriller', 'Midnight on the Eastern Express offers a structured, practical exploration of Mystery & Thriller with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mystery & Thriller
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['mystery', 'detective', 'suspense', 'train'], 'premium', 110000, 'Floor 3 • Shelf FI-03 (South Wing)', 'active', 4.59, 134, 28.5, 48, now() - interval '199 days'),
  ('The Cartographer of Amber Coast', array['Mariana Mazzucato'], '196810108X', '9781968101084', 'Tor Publishing', 2014, 360, 'English', 'Fiction', 'Historical Fiction', 'The Cartographer of Amber Coast offers a structured, practical exploration of Historical Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Historical Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['historical', 'maps', 'voyage', 'adventure'], 'standard', 150000, 'Floor 3 • Shelf FI-04 (South Wing)', 'active', 4.84, 29, 49.5, 64, now() - interval '201 days'),
  ('Chronicles of the Silver Spire', array['Kazuo Ishiguro', 'Julie Zhuo'], '1968101098', '9781968101091', 'Orbit Press', 2026, 224, 'English', 'Fiction', 'Fantasy', 'Chronicles of the Silver Spire offers a structured, practical exploration of Fantasy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Fantasy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['fantasy', 'magic', 'kingdom', 'epic'], 'standard', 165000, 'Floor 3 • Shelf FI-05 (South Wing)', 'active', 4.62, 138, 68.3, 35, now() - interval '203 days'),
  ('Orbits of Quiet Stars', array['Steven Strogatz'], '1968101101', '9781968101107', 'Gollancz', 2002, 408, 'English', 'Fiction', 'Short Stories', 'Orbits of Quiet Stars offers a structured, practical exploration of Short Stories with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Short Stories
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['anthology', 'short stories', 'sci-fi', 'speculative'], 'standard', 110000, 'Floor 3 • Shelf FI-06 (South Wing)', 'active', 3.99, 13, 29.4, 7, now() - interval '205 days'),
  ('Echoes Under the Monsoon', array['Arthur Clarke'], '196810111X', '9781968101114', 'Vintage Press', 2001, 376, 'English', 'Fiction', 'Literary Fiction', 'Echoes Under the Monsoon offers a structured, practical exploration of Literary Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Literary Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['monsoon', 'family', 'literary', 'memory'], 'standard', 85000, 'Floor 3 • Shelf FI-07 (South Wing)', 'active', 3.95, 47, 46.4, 7, now() - interval '207 days'),
  ('The Clockmaker Cipher', array['Josef Albers', 'Siddhartha Mukherjee'], '1968101128', '9781968101121', 'Faber & Faber', 2008, 240, 'English', 'Fiction', 'Mystery & Thriller', 'The Clockmaker Cipher offers a structured, practical exploration of Mystery & Thriller with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mystery & Thriller
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['cipher', 'thriller', 'clockwork', 'investigation'], 'premium', 105000, 'Floor 3 • Shelf FI-08 (South Wing)', 'active', 4.02, 76, 85.0, 51, now() - interval '209 days'),
  ('Starlight Relay Station Nine', array['Sean Carroll'], '1968101136', '9781968101138', 'Orbit Press', 2003, 584, 'English', 'Fiction', 'Sci-Fi', 'Starlight Relay Station Nine offers a structured, practical exploration of Sci-Fi with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sci-Fi
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['deep space', 'relay', 'ai', 'sci-fi'], 'standard', 175000, 'Floor 3 • Shelf FI-09 (South Wing)', 'active', 4.50, 52, 53.7, 36, now() - interval '211 days'),
  ('The Salt Merchant Daughter', array['Dieter Rams'], '1968101144', '9781968101145', 'Faber & Faber', 2002, 512, 'English', 'Fiction', 'Historical Fiction', 'The Salt Merchant Daughter offers a structured, practical exploration of Historical Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Historical Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['historical', 'harbor', 'family', 'century'], 'standard', 195000, 'Floor 3 • Shelf FI-10 (South Wing)', 'active', 4.55, 81, 39.1, 19, now() - interval '212 days'),
  ('Lanterns of the Sunken Valley', array['Jane Goodall', 'Tim Harford'], '1968101152', '9781968101152', 'Orbit Press', 2013, 376, 'English', 'Fiction', 'Fantasy', 'Lanterns of the Sunken Valley offers a structured, practical exploration of Fantasy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Fantasy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['fantasy', 'folklore', 'journey', 'magic'], 'standard', 90000, 'Floor 3 • Shelf FI-11 (South Wing)', 'active', 4.83, 107, 50.2, 50, now() - interval '214 days'),
  ('Paper Boats in Winter Rain', array['Daron Acemoglu'], '1968101160', '9781968101169', 'Gollancz', 2011, 232, 'English', 'Fiction', 'Short Stories', 'Paper Boats in Winter Rain offers a structured, practical exploration of Short Stories with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Short Stories
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['short stories', 'fiction', 'contemporary', 'vignettes'], 'standard', 215000, 'Floor 3 • Shelf FI-12 (South Wing)', 'active', 4.01, 54, 53.9, 64, now() - interval '216 days'),
  ('The Silent Archivist', array['Ursula Le Guin'], '1968101179', '9781968101176', 'Orbit Press', 2018, 352, 'English', 'Fiction', 'Mystery & Thriller', 'The Silent Archivist offers a structured, practical exploration of Mystery & Thriller with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mystery & Thriller
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['library', 'archive', 'mystery', 'secret'], 'premium', 120000, 'Floor 3 • Shelf FI-01 (South Wing)', 'active', 4.18, 88, 57.2, 24, now() - interval '218 days'),
  ('Meridian of Brass and Steam', array['Kent Beck'], '1968101187', '9781968101183', 'Tor Publishing', 2008, 520, 'English', 'Fiction', 'Sci-Fi', 'Meridian of Brass and Steam offers a structured, practical exploration of Sci-Fi with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sci-Fi
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['steampunk', 'airship', 'invention', 'sci-fi'], 'standard', 155000, 'Floor 3 • Shelf FI-02 (South Wing)', 'active', 4.57, 89, 74.4, 38, now() - interval '220 days'),
  ('A Garden Across Two Seasons', array['Octavia Butler'], '1968101195', '9781968101190', 'Orbit Press', 2006, 464, 'English', 'Fiction', 'Literary Fiction', 'A Garden Across Two Seasons offers a structured, practical exploration of Literary Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Literary Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['seasons', 'prose', 'literary', 'reflection'], 'standard', 180000, 'Floor 3 • Shelf FI-03 (South Wing)', 'draft', 4.73, 0, 0.0, 0, now() - interval '222 days'),
  ('The Winter Garrison', array['Martin Fowler'], '1968101209', '9781968101206', 'Vintage Press', 2015, 416, 'English', 'Fiction', 'Historical Fiction', 'The Winter Garrison offers a structured, practical exploration of Historical Fiction with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Historical Fiction
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['historical', 'frontier', 'winter', 'chronicle'], 'standard', 230000, 'Floor 3 • Shelf FI-04 (South Wing)', 'active', 3.99, 55, 47.3, 68, now() - interval '224 days'),
  ('Tides of the Jade Archipelago', array['Haruki Murakami'], '1968101217', '9781968101213', 'Vintage Press', 2017, 256, 'English', 'Fiction', 'Fantasy', 'Tides of the Jade Archipelago offers a structured, practical exploration of Fantasy with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Fantasy
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['fantasy', 'islands', 'voyage', 'myth'], 'standard', 230000, 'Floor 3 • Shelf FI-05 (South Wing)', 'active', 4.86, 91, 63.7, 11, now() - interval '225 days'),
  ('Footsteps on the Iron Bridge', array['Tim Harford'], '1968101225', '9781968101220', 'Faber & Faber', 2013, 328, 'English', 'Fiction', 'Mystery & Thriller', 'Footsteps on the Iron Bridge offers a structured, practical exploration of Mystery & Thriller with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Mystery & Thriller
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['noir', 'bridge', 'detective', 'thriller'], 'premium', 145000, 'Floor 3 • Shelf FI-06 (South Wing)', 'active', 3.94, 99, 56.0, 33, now() - interval '227 days'),
  ('The Memory Weaver', array['Esther Duflo', 'Ted Chiang'], '1968101233', '9781968101237', 'Vintage Press', 2020, 248, 'English', 'Fiction', 'Sci-Fi', 'The Memory Weaver offers a structured, practical exploration of Sci-Fi with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Sci-Fi
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['memory', 'future', 'cyberpunk', 'sci-fi'], 'standard', 195000, 'Floor 3 • Shelf FI-07 (South Wing)', 'active', 3.96, 107, 33.3, 3, now() - interval '229 days'),
  ('Postcards from an Old Railway', array['Austin Kleon'], '1968101241', '9781968101244', 'Faber & Faber', 2020, 320, 'English', 'Fiction', 'Short Stories', 'Postcards from an Old Railway offers a structured, practical exploration of Short Stories with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Short Stories
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['travel', 'railway', 'short stories', 'nostalgia'], 'standard', 140000, 'Floor 3 • Shelf FI-08 (South Wing)', 'active', 3.77, 6, 82.1, 65, now() - interval '231 days'),
  ('Bến sông chiều cuối thu', array['Đặng Thu Hà', 'Ngô Tấn Phát'], '6048101252', '9786048101251', 'NXB Kim Đồng', 2005, 200, 'Vietnamese', 'Fiction', 'Literary Fiction', 'Bến sông chiều cuối thu cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Literary Fiction, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Literary Fiction
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['tiểu thuyết', 'văn học', 'quê hương', 'ký ức'], 'standard', 220000, 'Floor 3 • Shelf FI-09 (South Wing)', 'active', 4.25, 98, 82.2, 40, now() - interval '233 days'),
  ('Ngọn hải đăng trên đảo sương mù', array['Nguyễn Minh Tuấn'], '6048101260', '9786048101268', 'NXB Văn học', 2023, 488, 'Vietnamese', 'Fiction', 'Mystery & Thriller', 'Ngọn hải đăng trên đảo sương mù cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mystery & Thriller, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mystery & Thriller
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['trinh thám', 'bí ẩn', 'hải đăng', 'điều tra'], 'standard', 180000, 'Floor 3 • Shelf FI-10 (South Wing)', 'active', 4.43, 19, 63.7, 19, now() - interval '235 days'),
  ('Trạm quỹ đạo bình minh', array['Nguyễn Minh Tuấn'], '6048101279', '9786048101275', 'NXB Văn học', 2011, 232, 'Vietnamese', 'Fiction', 'Sci-Fi', 'Trạm quỹ đạo bình minh cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Sci-Fi, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Sci-Fi
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['viễn tưởng', 'vũ trụ', 'tương lai', 'phiêu lưu'], 'standard', 175000, 'Floor 3 • Shelf FI-11 (South Wing)', 'active', 4.25, 64, 76.1, 50, now() - interval '236 days'),
  ('Biên niên sử phố cổ ven sông', array['Đặng Công Danh'], '6048101287', '9786048101282', 'NXB Văn học', 2001, 568, 'Vietnamese', 'Fiction', 'Historical Fiction', 'Biên niên sử phố cổ ven sông cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Historical Fiction, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Historical Fiction
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['lịch sử', 'phố cổ', 'gia tộc', 'tiểu thuyết'], 'standard', 210000, 'Floor 3 • Shelf FI-12 (South Wing)', 'active', 4.37, 25, 66.4, 49, now() - interval '238 days'),
  ('Khu rừng của những chiếc đèn lồng', array['Đỗ Mỹ Duyên'], '6048101295', '9786048101299', 'NXB Hội Nhà văn', 2021, 576, 'Vietnamese', 'Fiction', 'Fantasy', 'Khu rừng của những chiếc đèn lồng cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Fantasy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Fantasy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['kỳ ảo', 'phiêu lưu', 'truyền thuyết', 'rừng sâu'], 'standard', 80000, 'Floor 3 • Shelf FI-01 (South Wing)', 'active', 4.62, 114, 44.0, 25, now() - interval '240 days'),
  ('Những chuyến tàu đi qua mùa mưa', array['Ngô Gia Huy', 'Phạm Quốc Bảo'], '6048101309', '9786048101305', 'NXB Kim Đồng', 2012, 448, 'Vietnamese', 'Fiction', 'Short Stories', 'Những chuyến tàu đi qua mùa mưa cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Short Stories, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Short Stories
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['truyện ngắn', 'tản văn', 'mùa mưa', 'kỷ niệm'], 'premium', 135000, 'Floor 3 • Shelf FI-02 (South Wing)', 'active', 4.11, 139, 79.1, 9, now() - interval '242 days'),
  ('Bản đồ sao bị thất lạc', array['Ngô Tấn Phát'], '6048101317', '9786048101312', 'NXB Văn học', 2008, 224, 'Vietnamese', 'Fiction', 'Mystery & Thriller', 'Bản đồ sao bị thất lạc cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mystery & Thriller, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mystery & Thriller
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['bí mật', 'thám tử', 'bản đồ', 'hồi hộp'], 'standard', 145000, 'Floor 3 • Shelf FI-03 (South Wing)', 'active', 4.43, 167, 29.7, 49, now() - interval '244 days'),
  ('Thành phố bên kia dải ngân hà', array['Tạ Kim Ngân'], '6048101325', '9786048101329', 'NXB Hội Nhà văn', 1998, 304, 'Vietnamese', 'Fiction', 'Sci-Fi', 'Thành phố bên kia dải ngân hà cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Sci-Fi, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Sci-Fi
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['viễn tưởng', 'ngân hà', 'hành tinh', 'khám phá'], 'standard', 150000, 'Floor 3 • Shelf FI-04 (South Wing)', 'active', 4.16, 135, 58.5, 45, now() - interval '246 days'),
  ('Gió bấc trên đồi thông cũ', array['Ngô Tấn Phát'], '6048101333', '9786048101336', 'NXB Trẻ', 2000, 328, 'Vietnamese', 'Fiction', 'Literary Fiction', 'Gió bấc trên đồi thông cũ cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Literary Fiction, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Literary Fiction
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['văn học hiện đại', 'tuổi trẻ', 'tình bạn', 'đà lạt'], 'standard', 85000, 'Floor 3 • Shelf FI-05 (South Wing)', 'active', 3.95, 68, 56.4, 47, now() - interval '248 days'),
  ('Người giữ thư viện tầng áp mái', array['Trịnh Ngọc Bích'], '6048101341', '9786048101343', 'NXB Kim Đồng', 2011, 448, 'Vietnamese', 'Fiction', 'Fantasy', 'Người giữ thư viện tầng áp mái cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Fantasy, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Fantasy
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thư viện', 'kỳ ảo', 'bí ẩn', 'giả tưởng'], 'standard', 160000, 'Floor 3 • Shelf FI-06 (South Wing)', 'active', 3.99, 161, 64.7, 75, now() - interval '249 days'),
  ('Mùa gặt ở thung lũng mây', array['Ngô Gia Huy'], '604810135X', '9786048101350', 'NXB Kim Đồng', 1999, 504, 'Vietnamese', 'Fiction', 'Literary Fiction', 'Mùa gặt ở thung lũng mây cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Literary Fiction, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Literary Fiction
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['nông thôn', 'miền núi', 'tiểu thuyết', 'đời sống'], 'standard', 155000, 'Floor 3 • Shelf FI-07 (South Wing)', 'active', 3.95, 11, 35.4, 57, now() - interval '251 days'),
  ('Mật mã chiếc đồng hồ quả lắc', array['Lý Quang Khải'], '6048101368', '9786048101367', 'NXB Hội Nhà văn', 2021, 320, 'Vietnamese', 'Fiction', 'Mystery & Thriller', 'Mật mã chiếc đồng hồ quả lắc cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Mystery & Thriller, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Mystery & Thriller
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['mật mã', 'trinh thám', 'suy luận', 'kịch tính'], 'standard', 90000, 'Floor 3 • Shelf FI-08 (South Wing)', 'active', 4.34, 101, 39.2, 41, now() - interval '253 days'),
  ('Tuyển tập truyện ngắn tuổi hai mươi', array['Tô Khánh Vy'], '6048101376', '9786048101374', 'NXB Trẻ', 2016, 184, 'Vietnamese', 'Fiction', 'Short Stories', 'Tuyển tập truyện ngắn tuổi hai mươi cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Short Stories, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Short Stories
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['truyện ngắn', 'sinh viên', 'tuổi trẻ', 'tuyển tập'], 'standard', 150000, 'Floor 3 • Shelf FI-09 (South Wing)', 'active', 4.83, 46, 61.5, 38, now() - interval '255 days'),
  ('Molecular Cell Biology Essentials', array['Josef Albers'], '1968101381', '9781968101381', 'Wiley Science', 2011, 552, 'English', 'Natural Sciences', 'Biology', 'Molecular Cell Biology Essentials offers a structured, practical exploration of Biology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['cells', 'biology', 'proteins', 'metabolism'], 'standard', 160000, 'Floor 2 • Shelf NS-01 (East Wing)', 'active', 4.75, 157, 59.8, 8, now() - interval '257 days'),
  ('Organic Synthesis Pathways', array['Brian Kernighan', 'Barbara Liskov'], '196810139X', '9781968101398', 'Wiley Science', 2001, 592, 'English', 'Natural Sciences', 'Chemistry', 'Organic Synthesis Pathways offers a structured, practical exploration of Chemistry with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Chemistry
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['organic', 'reactions', 'synthesis', 'molecules'], 'standard', 130000, 'Floor 2 • Shelf NS-02 (East Wing)', 'active', 4.25, 87, 47.9, 29, now() - interval '259 days'),
  ('Tropical Forest Ecosystems', array['Esther Duflo'], '1968101403', '9781968101404', 'Springer Nature', 2022, 464, 'English', 'Natural Sciences', 'Ecology', 'Tropical Forest Ecosystems offers a structured, practical exploration of Ecology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Ecology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['ecology', 'biodiversity', 'forests', 'conservation'], 'standard', 140000, 'Floor 2 • Shelf NS-03 (East Wing)', 'active', 4.70, 110, 38.5, 79, now() - interval '261 days'),
  ('Plate Tectonics and Volcanology', array['Malcolm Gladwell'], '1968101411', '9781968101411', 'Springer Nature', 2002, 376, 'English', 'Natural Sciences', 'Earth Sciences', 'Plate Tectonics and Volcanology offers a structured, practical exploration of Earth Sciences with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Earth Sciences
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['geology', 'tectonics', 'volcanoes', 'earth'], 'standard', 120000, 'Floor 2 • Shelf NS-04 (East Wing)', 'active', 4.55, 81, 32.7, 37, now() - interval '262 days'),
  ('CRISPR and Genome Engineering', array['Tim Harford'], '196810142X', '9781968101428', 'Springer Nature', 2023, 496, 'English', 'Natural Sciences', 'Biotechnology', 'CRISPR and Genome Engineering offers a structured, practical exploration of Biotechnology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biotechnology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['crispr', 'genetics', 'biotech', 'dna'], 'standard', 285000, 'Floor 2 • Shelf NS-05 (East Wing)', 'active', 3.93, 127, 54.4, 67, now() - interval '264 days'),
  ('Microbial Worlds Around Us', array['Eric Evans'], '1968101438', '9781968101435', 'University of Chicago Press', 2011, 248, 'English', 'Natural Sciences', 'Biology', 'Microbial Worlds Around Us offers a structured, practical exploration of Biology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['microbiology', 'bacteria', 'microbiome', 'life'], 'premium', 190000, 'Floor 2 • Shelf NS-06 (East Wing)', 'draft', 4.82, 0, 0.0, 0, now() - interval '266 days'),
  ('Analytical Spectroscopy Techniques', array['Austin Kleon'], '1968101446', '9781968101442', 'Wiley Science', 2014, 528, 'English', 'Natural Sciences', 'Chemistry', 'Analytical Spectroscopy Techniques offers a structured, practical exploration of Chemistry with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Chemistry
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['spectroscopy', 'analytical', 'lab', 'chemistry'], 'premium', 315000, 'Floor 2 • Shelf NS-07 (East Wing)', 'active', 3.99, 63, 51.8, 77, now() - interval '268 days'),
  ('Marine Biology of Coral Reefs', array['Rob Pike'], '1968101454', '9781968101459', 'Yale University Press', 2013, 568, 'English', 'Natural Sciences', 'Ecology', 'Marine Biology of Coral Reefs offers a structured, practical exploration of Ecology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Ecology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['marine', 'coral', 'oceans', 'ecosystems'], 'premium', 285000, 'Floor 2 • Shelf NS-08 (East Wing)', 'active', 4.67, 94, 54.3, 68, now() - interval '270 days'),
  ('Principles of Evolutionary Genetics', array['David Thomas'], '1968101462', '9781968101466', 'Academic Press', 2001, 480, 'English', 'Natural Sciences', 'Genetics', 'Principles of Evolutionary Genetics offers a structured, practical exploration of Genetics with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Genetics
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['evolution', 'genetics', 'alleles', 'adaptation'], 'premium', 325000, 'Floor 2 • Shelf NS-09 (East Wing)', 'active', 4.34, 56, 78.0, 73, now() - interval '272 days'),
  ('Hydrology and Freshwater Systems', array['Rachel Carson'], '1968101470', '9781968101473', 'Academic Press', 2003, 616, 'English', 'Natural Sciences', 'Earth Sciences', 'Hydrology and Freshwater Systems offers a structured, practical exploration of Earth Sciences with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Earth Sciences
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['water', 'rivers', 'hydrology', 'geoscience'], 'standard', 210000, 'Floor 2 • Shelf NS-10 (East Wing)', 'active', 3.84, 59, 80.9, 70, now() - interval '273 days'),
  ('Biochemistry of Enzymes', array['Dieter Rams'], '1968101489', '9781968101480', 'University of Chicago Press', 2011, 376, 'English', 'Natural Sciences', 'Biotechnology', 'Biochemistry of Enzymes offers a structured, practical exploration of Biotechnology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biotechnology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['enzymes', 'biochemistry', 'kinetics', 'catalysis'], 'premium', 110000, 'Floor 2 • Shelf NS-11 (East Wing)', 'active', 4.38, 168, 85.4, 48, now() - interval '275 days'),
  ('Botany and Plant Physiology', array['Cathy ONeil'], '1968101497', '9781968101497', 'Wiley Science', 2003, 504, 'English', 'Natural Sciences', 'Biology', 'Botany and Plant Physiology offers a structured, practical exploration of Biology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['plants', 'botany', 'photosynthesis', 'flora'], 'standard', 195000, 'Floor 2 • Shelf NS-12 (East Wing)', 'active', 4.46, 158, 65.1, 64, now() - interval '277 days'),
  ('Polymer Materials and Composites', array['Jordan Ellenberg'], '1968101500', '9781968101503', 'Wiley Science', 2001, 416, 'English', 'Natural Sciences', 'Chemistry', 'Polymer Materials and Composites offers a structured, practical exploration of Chemistry with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Chemistry
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['polymers', 'materials', 'chemistry', 'engineering'], 'standard', 245000, 'Floor 2 • Shelf NS-01 (East Wing)', 'active', 4.86, 69, 54.5, 79, now() - interval '279 days'),
  ('Soil Science and Sustainable Farming', array['Peter Norvig', 'Jordan Ellenberg'], '1968101519', '9781968101510', 'University of Chicago Press', 2005, 344, 'English', 'Natural Sciences', 'Ecology', 'Soil Science and Sustainable Farming offers a structured, practical exploration of Ecology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Ecology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['soil', 'agriculture', 'nutrients', 'ecology'], 'premium', 195000, 'Floor 2 • Shelf NS-02 (East Wing)', 'active', 3.78, 103, 79.0, 18, now() - interval '281 days'),
  ('Mineralogy and Rock Identification', array['Carlo Rovelli'], '1968101527', '9781968101527', 'University of Chicago Press', 2021, 248, 'English', 'Natural Sciences', 'Earth Sciences', 'Mineralogy and Rock Identification offers a structured, practical exploration of Earth Sciences with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Earth Sciences
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['minerals', 'crystals', 'geology', 'rocks'], 'premium', 155000, 'Floor 2 • Shelf NS-03 (East Wing)', 'active', 3.86, 163, 47.8, 57, now() - interval '283 days'),
  ('Immunology and Cellular Defense', array['John Berger'], '1968101535', '9781968101534', 'Yale University Press', 2008, 584, 'English', 'Natural Sciences', 'Biology', 'Immunology and Cellular Defense offers a structured, practical exploration of Biology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['immunology', 'antibodies', 'vaccines', 'health'], 'standard', 275000, 'Floor 2 • Shelf NS-04 (East Wing)', 'active', 4.11, 133, 73.4, 10, now() - interval '285 days'),
  ('Bioinformatics Sequence Analysis', array['Christopher Alexander'], '1968101543', '9781968101541', 'Yale University Press', 2008, 336, 'English', 'Natural Sciences', 'Biotechnology', 'Bioinformatics Sequence Analysis offers a structured, practical exploration of Biotechnology with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Biotechnology
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['bioinformatics', 'genomics', 'alignment', 'dna'], 'standard', 175000, 'Floor 2 • Shelf NS-05 (East Wing)', 'active', 4.37, 137, 65.6, 53, now() - interval '286 days'),
  ('Sinh học phân tử và di truyền tế bào', array['Vũ Bảo Ngọc'], '6048101554', '9786048101558', 'NXB Nông nghiệp', 2026, 552, 'Vietnamese', 'Natural Sciences', 'Biology', 'Sinh học phân tử và di truyền tế bào cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Biology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Biology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['sinh học', 'tế bào', 'di truyền', 'phân tử'], 'premium', 190000, 'Floor 2 • Shelf NS-06 (East Wing)', 'active', 4.85, 122, 31.7, 29, now() - interval '288 days'),
  ('Hệ sinh thái rừng ngập mặn Việt Nam', array['Trần Văn Kiên'], '6048101562', '9786048101565', 'NXB Đại học Quốc gia TP.HCM', 2007, 608, 'Vietnamese', 'Natural Sciences', 'Ecology', 'Hệ sinh thái rừng ngập mặn Việt Nam cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Ecology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Ecology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['sinh thái', 'rừng ngập mặn', 'đa dạng sinh học', 'bảo tồn'], 'standard', 325000, 'Floor 2 • Shelf NS-07 (East Wing)', 'active', 3.89, 145, 36.4, 24, now() - interval '290 days'),
  ('Địa chất đại cương và tài nguyên trầm tích', array['Ngô Gia Huy', 'Trịnh Ngọc Bích'], '6048101570', '9786048101572', 'NXB Nông nghiệp', 2015, 312, 'Vietnamese', 'Natural Sciences', 'Earth Sciences', 'Địa chất đại cương và tài nguyên trầm tích cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Earth Sciences, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Earth Sciences
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['địa chất', 'đá trầm tích', 'trái đất', 'địa tầng'], 'standard', 285000, 'Floor 2 • Shelf NS-08 (East Wing)', 'active', 4.86, 63, 47.0, 43, now() - interval '292 days'),
  ('Công nghệ sinh học và ứng dụng y dược', array['Nguyễn Minh Tuấn', 'Trần Đức Hùng'], '6048101589', '9786048101589', 'NXB Tài nguyên Môi trường', 2023, 608, 'Vietnamese', 'Natural Sciences', 'Biotechnology', 'Công nghệ sinh học và ứng dụng y dược cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Biotechnology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Biotechnology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['công nghệ sinh học', 'y dược', 'enzyme', 'tế bào'], 'premium', 240000, 'Floor 2 • Shelf NS-09 (East Wing)', 'active', 4.78, 128, 68.8, 36, now() - interval '294 days'),
  ('Vi sinh vật học thực nghiệm', array['Lương Thảo Nguyên', 'Đỗ Mỹ Duyên'], '6048101597', '9786048101596', 'NXB Nông nghiệp', 2010, 632, 'Vietnamese', 'Natural Sciences', 'Biology', 'Vi sinh vật học thực nghiệm cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Biology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Biology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['vi sinh vật', 'thí nghiệm', 'nấm men', 'sinh học'], 'standard', 270000, 'Floor 2 • Shelf NS-10 (East Wing)', 'active', 4.13, 58, 34.6, 76, now() - interval '296 days'),
  ('Di truyền học quần thể và chọn lọc tự nhiên', array['Tô Khánh Vy', 'Dương Hải Yến'], '6048101600', '9786048101602', 'NXB Nông nghiệp', 2014, 504, 'Vietnamese', 'Natural Sciences', 'Genetics', 'Di truyền học quần thể và chọn lọc tự nhiên cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Genetics, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Genetics
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['di truyền', 'quần thể', 'chọn lọc', 'gen'], 'standard', 335000, 'Floor 2 • Shelf NS-11 (East Wing)', 'active', 4.34, 81, 62.0, 59, now() - interval '298 days'),
  ('Thủy văn học và quản lý nguồn nước', array['Phan Nhật Ánh'], '6048101619', '9786048101619', 'NXB Tài nguyên Môi trường', 1998, 240, 'Vietnamese', 'Natural Sciences', 'Earth Sciences', 'Thủy văn học và quản lý nguồn nước cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Earth Sciences, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Earth Sciences
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thủy văn', 'nguồn nước', 'sông ngòi', 'môi trường'], 'standard', 160000, 'Floor 2 • Shelf NS-12 (East Wing)', 'active', 4.38, 122, 28.8, 59, now() - interval '299 days'),
  ('Thực vật học nhiệt đới và dược liệu', array['Trần Đức Hùng', 'Phan Nhật Ánh'], '6048101627', '9786048101626', 'NXB Tài nguyên Môi trường', 2000, 512, 'Vietnamese', 'Natural Sciences', 'Biology', 'Thực vật học nhiệt đới và dược liệu cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Biology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Biology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thực vật', 'nhiệt đới', 'dược liệu', 'sinh học'], 'premium', 225000, 'Floor 2 • Shelf NS-01 (East Wing)', 'active', 4.64, 23, 64.4, 64, now() - interval '301 days'),
  ('Sinh thái biển và bảo tồn rạn san hô', array['Đỗ Mỹ Duyên'], '6048101635', '9786048101633', 'NXB Tài nguyên Môi trường', 2008, 376, 'Vietnamese', 'Natural Sciences', 'Ecology', 'Sinh thái biển và bảo tồn rạn san hô cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Ecology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Ecology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['sinh thái biển', 'san hô', 'đại dương', 'bảo tồn'], 'standard', 280000, 'Floor 2 • Shelf NS-02 (East Wing)', 'active', 4.56, 28, 61.9, 39, now() - interval '303 days'),
  ('Kỹ thuật phân tích quang phổ trong phòng thí nghiệm', array['Trịnh Ngọc Bích', 'Mai Xuân Trường'], '6048101643', '9786048101640', 'NXB Nông nghiệp', 2022, 512, 'Vietnamese', 'Natural Sciences', 'Chemistry', 'Kỹ thuật phân tích quang phổ trong phòng thí nghiệm cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Chemistry, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Chemistry
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['quang phổ', 'phân tích', 'phòng thí nghiệm', 'vật liệu'], 'standard', 320000, 'Floor 2 • Shelf NS-03 (East Wing)', 'active', 4.11, 39, 40.7, 73, now() - interval '305 days'),
  ('Vật liệu polyme phân hủy sinh học', array['Đặng Công Danh', 'Mai Xuân Trường'], '6048101651', '9786048101657', 'NXB Giáo dục Việt Nam', 2013, 416, 'Vietnamese', 'Natural Sciences', 'Biotechnology', 'Vật liệu polyme phân hủy sinh học cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Biotechnology, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Biotechnology
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['polyme', 'vật liệu mới', 'sinh học', 'môi trường'], 'standard', 290000, 'Floor 2 • Shelf NS-04 (East Wing)', 'active', 4.44, 116, 36.7, 37, now() - interval '307 days'),
  ('Grid Systems in Editorial Layout', array['Octavia Butler'], '1968101667', '9781968101664', 'Taschen', 2025, 328, 'English', 'Arts', 'Typography', 'Grid Systems in Editorial Layout offers a structured, practical exploration of Typography with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Typography
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['grids', 'typography', 'layout', 'editorial'], 'standard', 170000, 'Floor 3 • Shelf AR-01 (West Wing)', 'active', 4.22, 136, 51.4, 38, now() - interval '309 days'),
  ('Sustainable Tropical Architecture', array['Isaac Asimov'], '1968101675', '9781968101671', 'Thames & Hudson', 2013, 184, 'English', 'Arts', 'Architecture', 'Sustainable Tropical Architecture offers a structured, practical exploration of Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['architecture', 'tropical', 'passive cooling', 'buildings'], 'standard', 115000, 'Floor 3 • Shelf AR-02 (West Wing)', 'draft', 4.76, 0, 0.0, 0, now() - interval '310 days'),
  ('Color Theory and Visual Harmony', array['Cathy ONeil'], '1968101683', '9781968101688', 'Laurence King', 2017, 392, 'English', 'Arts', 'Visual Arts', 'Color Theory and Visual Harmony offers a structured, practical exploration of Visual Arts with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Visual Arts
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['color', 'composition', 'painting', 'aesthetics'], 'premium', 275000, 'Floor 3 • Shelf AR-03 (West Wing)', 'active', 4.34, 109, 61.3, 64, now() - interval '312 days'),
  ('Harmony and Counterpoint Foundations', array['Brian Kernighan'], '1968101691', '9781968101695', 'Taschen', 2011, 336, 'English', 'Arts', 'Music Theory', 'Harmony and Counterpoint Foundations offers a structured, practical exploration of Music Theory with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Music Theory
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['music', 'harmony', 'composition', 'scales'], 'standard', 225000, 'Floor 3 • Shelf AR-04 (West Wing)', 'active', 3.93, 50, 77.6, 12, now() - interval '314 days'),
  ('Visual Storytelling in Cinema', array['Christopher Bishop'], '1968101705', '9781968101701', 'Princeton Architectural Press', 1998, 256, 'English', 'Arts', 'Film Studies', 'Visual Storytelling in Cinema offers a structured, practical exploration of Film Studies with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Film Studies
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['cinema', 'cinematography', 'editing', 'film'], 'standard', 290000, 'Floor 3 • Shelf AR-05 (West Wing)', 'active', 3.77, 155, 34.1, 30, now() - interval '316 days'),
  ('Industrial Design Sketches to Form', array['Rachel Carson'], '1968101713', '9781968101718', 'Taschen', 2005, 240, 'English', 'Arts', 'Design', 'Industrial Design Sketches to Form offers a structured, practical exploration of Design with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Design
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['industrial design', 'sketching', 'ergonomics', 'prototypes'], 'standard', 235000, 'Floor 3 • Shelf AR-06 (West Wing)', 'active', 4.61, 102, 77.2, 39, now() - interval '318 days'),
  ('Modernist Concrete and Light', array['Martin Fowler', 'Carl Sagan'], '1968101721', '9781968101725', 'Taschen', 2010, 384, 'English', 'Arts', 'Architecture', 'Modernist Concrete and Light offers a structured, practical exploration of Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['modernism', 'concrete', 'light', 'spatial'], 'standard', 110000, 'Floor 3 • Shelf AR-07 (West Wing)', 'active', 4.02, 101, 70.2, 14, now() - interval '320 days'),
  ('Typeface Anatomy and Pairing', array['Richard Feynman'], '196810173X', '9781968101732', 'Thames & Hudson', 2004, 192, 'English', 'Arts', 'Typography', 'Typeface Anatomy and Pairing offers a structured, practical exploration of Typography with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Typography
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['fonts', 'serif', 'typeface', 'design'], 'standard', 180000, 'Floor 3 • Shelf AR-08 (West Wing)', 'active', 3.78, 78, 47.7, 37, now() - interval '322 days'),
  ('Watercolor Landscapes and Texture', array['Raghuram Rajan'], '1968101748', '9781968101749', 'Phaidon Press', 2005, 312, 'English', 'Arts', 'Visual Arts', 'Watercolor Landscapes and Texture offers a structured, practical exploration of Visual Arts with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Visual Arts
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['watercolor', 'illustration', 'landscape', 'art'], 'standard', 205000, 'Floor 3 • Shelf AR-09 (West Wing)', 'active', 4.18, 131, 80.5, 24, now() - interval '323 days'),
  ('Sound Design for Interactive Media', array['Octavia Butler'], '1968101756', '9781968101756', 'Laurence King', 2025, 288, 'English', 'Arts', 'Music Theory', 'Sound Design for Interactive Media offers a structured, practical exploration of Music Theory with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Music Theory
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['sound', 'acoustics', 'audio', 'media'], 'standard', 115000, 'Floor 3 • Shelf AR-10 (West Wing)', 'active', 4.32, 107, 38.5, 40, now() - interval '325 days'),
  ('Documentary Filmmaking Craft', array['Brian Kernighan'], '1968101764', '9781968101763', 'Laurence King', 2025, 432, 'English', 'Arts', 'Film Studies', 'Documentary Filmmaking Craft offers a structured, practical exploration of Film Studies with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Film Studies
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['documentary', 'storytelling', 'directing', 'film'], 'standard', 215000, 'Floor 3 • Shelf AR-11 (West Wing)', 'active', 4.38, 10, 57.5, 6, now() - interval '327 days'),
  ('Design Systems for Digital Teams', array['Ellen Lupton'], '1968101772', '9781968101770', 'Laurence King', 1999, 344, 'English', 'Arts', 'Design', 'Design Systems for Digital Teams offers a structured, practical exploration of Design with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Design
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['design systems', 'tokens', 'components', 'ui'], 'standard', 170000, 'Floor 3 • Shelf AR-12 (West Wing)', 'active', 4.33, 159, 33.7, 40, now() - interval '329 days'),
  ('Timber Joinery and Vernacular Homes', array['Rachel Carson'], '1968101780', '9781968101787', 'Princeton Architectural Press', 2017, 392, 'English', 'Arts', 'Architecture', 'Timber Joinery and Vernacular Homes offers a structured, practical exploration of Architecture with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Architecture
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['timber', 'craft', 'vernacular', 'architecture'], 'standard', 160000, 'Floor 3 • Shelf AR-01 (West Wing)', 'active', 3.88, 163, 31.4, 63, now() - interval '331 days'),
  ('Printmaking from Woodblock to Silkscreen', array['Esther Duflo'], '1968101799', '9781968101794', 'Thames & Hudson', 2024, 400, 'English', 'Arts', 'Visual Arts', 'Printmaking from Woodblock to Silkscreen offers a structured, practical exploration of Visual Arts with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Visual Arts
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['printmaking', 'woodblock', 'silkscreen', 'studio'], 'standard', 175000, 'Floor 3 • Shelf AR-02 (West Wing)', 'active', 4.03, 35, 61.3, 53, now() - interval '333 days'),
  ('Rhythm, Jazz, and Improvisation', array['Christopher Bishop'], '1968101802', '9781968101800', 'Thames & Hudson', 2023, 264, 'English', 'Arts', 'Music Theory', 'Rhythm, Jazz, and Improvisation offers a structured, practical exploration of Music Theory with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.', '1. Foundations of Music Theory
2. Core Principles and Frameworks
3. Applied Case Studies
4. Practice Problems and Further Reading', array['jazz', 'rhythm', 'improvisation', 'music'], 'standard', 180000, 'Floor 3 • Shelf AR-03 (West Wing)', 'active', 4.26, 17, 36.8, 32, now() - interval '335 days'),
  ('Kiến trúc nhiệt đới đương đại tại Việt Nam', array['Dương Hải Yến'], '6048101813', '9786048101817', 'NXB Văn nghệ', 2020, 280, 'Vietnamese', 'Arts', 'Architecture', 'Kiến trúc nhiệt đới đương đại tại Việt Nam cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Architecture, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Architecture
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['kiến trúc', 'nhiệt đới', 'không gian', 'xây dựng'], 'standard', 115000, 'Floor 3 • Shelf AR-04 (West Wing)', 'active', 4.76, 33, 52.7, 43, now() - interval '336 days'),
  ('Nghệ thuật chữ và bố cục trang in', array['Lê Minh Triết', 'Đặng Công Danh'], '6048101821', '9786048101824', 'NXB Thế giới', 2004, 232, 'Vietnamese', 'Arts', 'Typography', 'Nghệ thuật chữ và bố cục trang in cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Typography, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Typography
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['nghệ thuật chữ', 'bố cục', 'in ấn', 'thiết kế'], 'standard', 210000, 'Floor 3 • Shelf AR-05 (West Wing)', 'active', 4.80, 145, 54.6, 42, now() - interval '338 days'),
  ('Lý thuyết màu sắc trong thiết kế thị giác', array['Phan Nhật Ánh', 'Nguyễn Minh Tuấn'], '604810183X', '9786048101831', 'NXB Xây dựng', 1998, 376, 'Vietnamese', 'Arts', 'Visual Arts', 'Lý thuyết màu sắc trong thiết kế thị giác cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Visual Arts, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Visual Arts
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['màu sắc', 'thị giác', 'mỹ thuật', 'bố cục'], 'standard', 285000, 'Floor 3 • Shelf AR-06 (West Wing)', 'active', 4.38, 164, 41.1, 54, now() - interval '340 days'),
  ('Nhạc lý cơ bản và phối khí hiện đại', array['Đỗ Lan Anh'], '6048101848', '9786048101848', 'NXB Văn nghệ', 2023, 176, 'Vietnamese', 'Arts', 'Music Theory', 'Nhạc lý cơ bản và phối khí hiện đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Music Theory, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Music Theory
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['nhạc lý', 'âm nhạc', 'phối khí', 'giai điệu'], 'standard', 305000, 'Floor 3 • Shelf AR-07 (West Wing)', 'active', 3.84, 101, 43.1, 16, now() - interval '342 days'),
  ('Ngôn ngữ điện ảnh và nghệ thuật dựng phim', array['Phạm Anh Thư'], '6048101856', '9786048101855', 'NXB Văn nghệ', 2025, 416, 'Vietnamese', 'Arts', 'Film Studies', 'Ngôn ngữ điện ảnh và nghệ thuật dựng phim cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Film Studies, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Film Studies
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['điện ảnh', 'dựng phim', 'kịch bản', 'góc quay'], 'premium', 190000, 'Floor 3 • Shelf AR-08 (West Wing)', 'active', 4.53, 22, 79.6, 24, now() - interval '344 days'),
  ('Thiết kế sản phẩm công nghiệp và công thái học', array['Trần Văn Kiên', 'Ngô Tấn Phát'], '6048101864', '9786048101862', 'NXB Xây dựng', 1999, 416, 'Vietnamese', 'Arts', 'Design', 'Thiết kế sản phẩm công nghiệp và công thái học cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Design, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Design
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thiết kế sản phẩm', 'công thái học', 'sáng tạo', 'mẫu'], 'standard', 310000, 'Floor 3 • Shelf AR-09 (West Wing)', 'active', 4.18, 47, 31.8, 79, now() - interval '346 days'),
  ('Di sản kiến trúc gỗ truyền thống miền Trung', array['Phạm Anh Thư'], '6048101872', '9786048101879', 'NXB Văn nghệ', 2008, 288, 'Vietnamese', 'Arts', 'Architecture', 'Di sản kiến trúc gỗ truyền thống miền Trung cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Architecture, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Architecture
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['kiến trúc gỗ', 'di sản', 'miền trung', 'truyền thống'], 'standard', 220000, 'Floor 3 • Shelf AR-10 (West Wing)', 'active', 4.35, 127, 46.1, 74, now() - interval '347 days'),
  ('Kỹ thuật phác thảo và vẽ màu nước', array['Lương Thảo Nguyên', 'Đinh Văn Sơn'], '6048101880', '9786048101886', 'NXB Thế giới', 2002, 416, 'Vietnamese', 'Arts', 'Visual Arts', 'Kỹ thuật phác thảo và vẽ màu nước cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Visual Arts, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Visual Arts
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['phác thảo', 'màu nước', 'hội vẽ', 'mỹ thuật'], 'standard', 305000, 'Floor 3 • Shelf AR-11 (West Wing)', 'active', 3.91, 153, 64.6, 70, now() - interval '349 days'),
  ('Thiết kế nhận diện thương hiệu toàn diện', array['Mai Xuân Trường'], '6048101899', '9786048101893', 'NXB Văn nghệ', 2018, 408, 'Vietnamese', 'Arts', 'Design', 'Thiết kế nhận diện thương hiệu toàn diện cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Design, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Design
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['thương hiệu', 'logo', 'nhận diện', 'thiết kế'], 'standard', 240000, 'Floor 3 • Shelf AR-12 (West Wing)', 'active', 4.55, 159, 56.7, 71, now() - interval '351 days'),
  ('Lịch sử mỹ thuật Đông Dương thế kỷ hai mươi', array['Châu Thành Đạt'], '6048101902', '9786048101909', 'NXB Văn nghệ', 2024, 216, 'Vietnamese', 'Arts', 'Visual Arts', 'Lịch sử mỹ thuật Đông Dương thế kỷ hai mươi cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Visual Arts, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Visual Arts
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['mỹ thuật', 'lịch sử', 'tranh lụa', 'sơn mài'], 'standard', 160000, 'Floor 3 • Shelf AR-01 (West Wing)', 'draft', 4.55, 0, 0.0, 0, now() - interval '353 days'),
  ('Âm thanh và ánh sáng trong sân khấu đương đại', array['Bùi Thanh Tùng', 'Trần Văn Kiên'], '6048101910', '9786048101916', 'NXB Mỹ thuật', 2002, 240, 'Vietnamese', 'Arts', 'Film Studies', 'Âm thanh và ánh sáng trong sân khấu đương đại cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực Film Studies, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.', '1. Tổng quan về Film Studies
2. Nền tảng lý thuyết và phương pháp luận
3. Phân tích tình huống thực tế
4. Bài tập ứng dụng và tài liệu tham khảo', array['sân khấu', 'ánh sáng', 'âm thanh', 'nghệ thuật'], 'standard', 215000, 'Floor 3 • Shelf AR-02 (West Wing)', 'draft', 4.08, 0, 0.0, 0, now() - interval '355 days')
on conflict (isbn13) where isbn13 is not null do nothing;

-- Physical copies (batch receipts -> Admin History: Batch receipts)
do $$
begin
  perform set_config('app.inventory_actor', '22222222-2222-2222-2222-222222222222', true);
  perform set_config('app.inventory_type', 'batch_receipt', true);
  perform set_config('app.inventory_reason', 'Initial catalog batch receipt (SCRUM-81)', true);
  insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type, held_for_type, held_until)
  select b.id, v.barcode, v.status, v.shelf_location, v.condition, v.source_type, v.held_for_type,
         case when v.held_hours is not null then now() + make_interval(hours => v.held_hours) else null end
  from (values
    ('9781968100018', 'BK-20002', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100018', 'BK-20004', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100025', 'BK-20005', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100025', 'BK-20007', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100032', 'BK-20008', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100032', 'BK-20009', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100049', 'BK-20010', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100049', 'BK-20011', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100063', 'BK-20014', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100063', 'BK-20015', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100070', 'BK-20018', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100070', 'BK-20019', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100087', 'BK-20021', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100087', 'BK-20022', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100087', 'BK-20023', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100094', 'BK-20026', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100094', 'BK-20027', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100100', 'BK-20029', 'available', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100100', 'BK-20030', 'borrowed', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100117', 'BK-20031', 'available', 'Floor 2 • Shelf CS-11 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100117', 'BK-20032', 'available', 'Floor 2 • Shelf CS-11 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100124', 'BK-20033', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100124', 'BK-20034', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100124', 'BK-20036', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100131', 'BK-20040', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100148', 'BK-20041', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100148', 'BK-20042', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100148', 'BK-20043', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100155', 'BK-20046', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100162', 'BK-20048', 'borrowed', 'Floor 2 • Shelf CS-04 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100179', 'BK-20052', 'held', 'Floor 2 • Shelf CS-05 (West Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9781968100186', 'BK-20053', 'borrowed', 'Floor 2 • Shelf CS-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100186', 'BK-20054', 'borrowed', 'Floor 2 • Shelf CS-06 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100193', 'BK-20056', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100209', 'BK-20058', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100209', 'BK-20059', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100216', 'BK-20061', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100216', 'BK-20062', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100216', 'BK-20064', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100223', 'BK-20065', 'available', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100223', 'BK-20066', 'borrowed', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100223', 'BK-20067', 'available', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100247', 'BK-20069', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100247', 'BK-20071', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100254', 'BK-20073', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100261', 'BK-20077', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100278', 'BK-20078', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100278', 'BK-20079', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100285', 'BK-20081', 'borrowed', 'Floor 2 • Shelf CS-04 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100285', 'BK-20082', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100285', 'BK-20083', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100292', 'BK-20084', 'available', 'Floor 2 • Shelf CS-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100292', 'BK-20085', 'available', 'Floor 2 • Shelf CS-05 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100292', 'BK-20086', 'borrowed', 'Floor 2 • Shelf CS-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100308', 'BK-20088', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100308', 'BK-20089', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100308', 'BK-20090', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100308', 'BK-20091', 'available', 'Floor 2 • Shelf CS-06 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100315', 'BK-20092', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100339', 'BK-20098', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100339', 'BK-20099', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100346', 'BK-20101', 'available', 'Floor 2 • Shelf CS-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100353', 'BK-20103', 'available', 'Floor 2 • Shelf CS-11 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100360', 'BK-20104', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100360', 'BK-20106', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100384', 'BK-20112', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100384', 'BK-20113', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100384', 'BK-20114', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100391', 'BK-20115', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100407', 'BK-20118', 'borrowed', 'Floor 2 • Shelf SC-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100407', 'BK-20119', 'available', 'Floor 2 • Shelf SC-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100414', 'BK-20122', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100414', 'BK-20123', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100438', 'BK-20126', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100438', 'BK-20128', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100445', 'BK-20131', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100452', 'BK-20133', 'borrowed', 'Floor 2 • Shelf SC-09 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100469', 'BK-20134', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100469', 'BK-20135', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100469', 'BK-20136', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100469', 'BK-20137', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100476', 'BK-20138', 'available', 'Floor 2 • Shelf SC-11 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100483', 'BK-20140', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100483', 'BK-20141', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100490', 'BK-20143', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100490', 'BK-20144', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100506', 'BK-20145', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100506', 'BK-20146', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100506', 'BK-20147', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100513', 'BK-20149', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100520', 'BK-20150', 'available', 'Floor 2 • Shelf SC-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100520', 'BK-20151', 'borrowed', 'Floor 2 • Shelf SC-04 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100537', 'BK-20152', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100537', 'BK-20153', 'borrowed', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100544', 'BK-20155', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100551', 'BK-20158', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100551', 'BK-20159', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100551', 'BK-20160', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100568', 'BK-20161', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100568', 'BK-20162', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100575', 'BK-20164', 'available', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100575', 'BK-20165', 'available', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100582', 'BK-20166', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100582', 'BK-20167', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100582', 'BK-20168', 'borrowed', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100605', 'BK-20171', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100605', 'BK-20172', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100612', 'BK-20176', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100629', 'BK-20177', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100629', 'BK-20179', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100636', 'BK-20180', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100643', 'BK-20184', 'available', 'Floor 2 • Shelf SC-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100643', 'BK-20185', 'borrowed', 'Floor 2 • Shelf SC-04 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100650', 'BK-20186', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100650', 'BK-20187', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100674', 'BK-20191', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100681', 'BK-20192', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100681', 'BK-20195', 'borrowed', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100698', 'BK-20196', 'available', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100698', 'BK-20197', 'borrowed', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100704', 'BK-20199', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100711', 'BK-20201', 'available', 'Floor 1 • Shelf NF-01 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100728', 'BK-20202', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100728', 'BK-20205', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100735', 'BK-20206', 'borrowed', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100735', 'BK-20207', 'held', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', 'reservation', 24::int),
    ('9781968100742', 'BK-20208', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100742', 'BK-20209', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100742', 'BK-20210', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100742', 'BK-20211', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100759', 'BK-20212', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100759', 'BK-20213', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100766', 'BK-20217', 'available', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100773', 'BK-20218', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100773', 'BK-20219', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100780', 'BK-20220', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100780', 'BK-20221', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100797', 'BK-20225', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100797', 'BK-20227', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100803', 'BK-20229', 'held', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9781968100810', 'BK-20231', 'available', 'Floor 1 • Shelf NF-11 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100834', 'BK-20235', 'available', 'Floor 1 • Shelf NF-01 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100834', 'BK-20236', 'available', 'Floor 1 • Shelf NF-01 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100841', 'BK-20237', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100841', 'BK-20239', 'borrowed', 'Floor 1 • Shelf NF-02 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100841', 'BK-20240', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100858', 'BK-20241', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100858', 'BK-20242', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100858', 'BK-20244', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100872', 'BK-20247', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100872', 'BK-20248', 'borrowed', 'Floor 1 • Shelf NF-05 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100872', 'BK-20249', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100889', 'BK-20250', 'available', 'Floor 1 • Shelf NF-06 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100889', 'BK-20251', 'borrowed', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100896', 'BK-20254', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100902', 'BK-20256', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968100902', 'BK-20257', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968100919', 'BK-20258', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100926', 'BK-20261', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100926', 'BK-20263', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100933', 'BK-20265', 'available', 'Floor 1 • Shelf NF-11 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100940', 'BK-20267', 'available', 'Floor 1 • Shelf NF-12 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100940', 'BK-20269', 'available', 'Floor 1 • Shelf NF-12 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048100957', 'BK-20270', 'available', 'Floor 1 • Shelf NF-01 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100964', 'BK-20271', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100964', 'BK-20272', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100971', 'BK-20275', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100988', 'BK-20276', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100988', 'BK-20277', 'available', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100988', 'BK-20278', 'held', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9786048100988', 'BK-20279', 'borrowed', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100995', 'BK-20281', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048100995', 'BK-20282', 'held', 'Floor 1 • Shelf NF-05 (North Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9786048100995', 'BK-20283', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101008', 'BK-20285', 'held', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'batch', 'reservation', 24::int),
    ('9786048101015', 'BK-20287', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101022', 'BK-20288', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101022', 'BK-20289', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101022', 'BK-20290', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101039', 'BK-20291', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101039', 'BK-20292', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101046', 'BK-20294', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101046', 'BK-20295', 'borrowed', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101053', 'BK-20298', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101053', 'BK-20299', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101060', 'BK-20300', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101060', 'BK-20303', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101077', 'BK-20306', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101091', 'BK-20312', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101107', 'BK-20313', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101107', 'BK-20314', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101114', 'BK-20317', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101121', 'BK-20320', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101121', 'BK-20322', 'held', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9781968101121', 'BK-20323', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101138', 'BK-20324', 'borrowed', 'Floor 3 • Shelf FI-09 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101145', 'BK-20326', 'available', 'Floor 3 • Shelf FI-10 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101145', 'BK-20327', 'available', 'Floor 3 • Shelf FI-10 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101145', 'BK-20328', 'available', 'Floor 3 • Shelf FI-10 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101152', 'BK-20329', 'available', 'Floor 3 • Shelf FI-11 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101152', 'BK-20330', 'available', 'Floor 3 • Shelf FI-11 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101169', 'BK-20332', 'available', 'Floor 3 • Shelf FI-12 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101169', 'BK-20333', 'borrowed', 'Floor 3 • Shelf FI-12 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101169', 'BK-20334', 'available', 'Floor 3 • Shelf FI-12 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101169', 'BK-20335', 'borrowed', 'Floor 3 • Shelf FI-12 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101176', 'BK-20339', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101183', 'BK-20340', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101183', 'BK-20341', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101190', 'BK-20344', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101206', 'BK-20345', 'available', 'Floor 3 • Shelf FI-04 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101206', 'BK-20346', 'available', 'Floor 3 • Shelf FI-04 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101220', 'BK-20350', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101220', 'BK-20351', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101220', 'BK-20352', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101237', 'BK-20354', 'borrowed', 'Floor 3 • Shelf FI-07 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101244', 'BK-20357', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101251', 'BK-20359', 'borrowed', 'Floor 3 • Shelf FI-09 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101251', 'BK-20360', 'borrowed', 'Floor 3 • Shelf FI-09 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101251', 'BK-20361', 'available', 'Floor 3 • Shelf FI-09 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101268', 'BK-20362', 'available', 'Floor 3 • Shelf FI-10 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101275', 'BK-20364', 'borrowed', 'Floor 3 • Shelf FI-11 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101275', 'BK-20365', 'held', 'Floor 3 • Shelf FI-11 (South Wing)', 'good', 'batch', 'reservation', 24::int),
    ('9786048101282', 'BK-20366', 'available', 'Floor 3 • Shelf FI-12 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101282', 'BK-20367', 'borrowed', 'Floor 3 • Shelf FI-12 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101282', 'BK-20368', 'borrowed', 'Floor 3 • Shelf FI-12 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101299', 'BK-20370', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101299', 'BK-20373', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101305', 'BK-20374', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101305', 'BK-20377', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101312', 'BK-20379', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101312', 'BK-20380', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101312', 'BK-20381', 'borrowed', 'Floor 3 • Shelf FI-03 (South Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101329', 'BK-20383', 'borrowed', 'Floor 3 • Shelf FI-04 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101336', 'BK-20384', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101336', 'BK-20386', 'borrowed', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101336', 'BK-20387', 'held', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9786048101350', 'BK-20390', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101350', 'BK-20391', 'held', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'batch', 'reservation', 36::int),
    ('9786048101367', 'BK-20392', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101367', 'BK-20393', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101374', 'BK-20394', 'available', 'Floor 3 • Shelf FI-09 (South Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101381', 'BK-20398', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101398', 'BK-20400', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101398', 'BK-20401', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101398', 'BK-20402', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101404', 'BK-20403', 'borrowed', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101411', 'BK-20405', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101411', 'BK-20407', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101428', 'BK-20409', 'available', 'Floor 2 • Shelf NS-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101428', 'BK-20410', 'available', 'Floor 2 • Shelf NS-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101442', 'BK-20415', 'borrowed', 'Floor 2 • Shelf NS-07 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101459', 'BK-20417', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101459', 'BK-20418', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101466', 'BK-20421', 'available', 'Floor 2 • Shelf NS-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101466', 'BK-20422', 'available', 'Floor 2 • Shelf NS-09 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101473', 'BK-20423', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101473', 'BK-20425', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101473', 'BK-20426', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101497', 'BK-20429', 'available', 'Floor 2 • Shelf NS-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101497', 'BK-20430', 'available', 'Floor 2 • Shelf NS-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101503', 'BK-20431', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101503', 'BK-20432', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101510', 'BK-20435', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101527', 'BK-20437', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101527', 'BK-20440', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101534', 'BK-20441', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101541', 'BK-20444', 'borrowed', 'Floor 2 • Shelf NS-05 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101541', 'BK-20445', 'held', 'Floor 2 • Shelf NS-05 (East Wing)', 'good', 'batch', 'reservation', 24::int),
    ('9786048101558', 'BK-20447', 'available', 'Floor 2 • Shelf NS-06 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101565', 'BK-20450', 'available', 'Floor 2 • Shelf NS-07 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101572', 'BK-20451', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101572', 'BK-20454', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101589', 'BK-20455', 'available', 'Floor 2 • Shelf NS-09 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101589', 'BK-20456', 'available', 'Floor 2 • Shelf NS-09 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101596', 'BK-20458', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101602', 'BK-20462', 'available', 'Floor 2 • Shelf NS-11 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101619', 'BK-20464', 'available', 'Floor 2 • Shelf NS-12 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101619', 'BK-20465', 'available', 'Floor 2 • Shelf NS-12 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101626', 'BK-20467', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101633', 'BK-20469', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101633', 'BK-20470', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101640', 'BK-20471', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101657', 'BK-20476', 'borrowed', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101657', 'BK-20477', 'borrowed', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101657', 'BK-20478', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101664', 'BK-20479', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101664', 'BK-20481', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101664', 'BK-20482', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101671', 'BK-20483', 'available', 'Floor 3 • Shelf AR-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101688', 'BK-20484', 'borrowed', 'Floor 3 • Shelf AR-03 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101688', 'BK-20485', 'borrowed', 'Floor 3 • Shelf AR-03 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101695', 'BK-20486', 'available', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101695', 'BK-20487', 'borrowed', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101701', 'BK-20490', 'available', 'Floor 3 • Shelf AR-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101701', 'BK-20491', 'available', 'Floor 3 • Shelf AR-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101701', 'BK-20492', 'available', 'Floor 3 • Shelf AR-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101718', 'BK-20494', 'available', 'Floor 3 • Shelf AR-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101725', 'BK-20495', 'available', 'Floor 3 • Shelf AR-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101725', 'BK-20496', 'available', 'Floor 3 • Shelf AR-07 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101732', 'BK-20500', 'available', 'Floor 3 • Shelf AR-08 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101749', 'BK-20501', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101749', 'BK-20502', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101756', 'BK-20506', 'available', 'Floor 3 • Shelf AR-10 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101756', 'BK-20507', 'available', 'Floor 3 • Shelf AR-10 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101763', 'BK-20509', 'available', 'Floor 3 • Shelf AR-11 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101763', 'BK-20510', 'available', 'Floor 3 • Shelf AR-11 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101770', 'BK-20514', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101787', 'BK-20515', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101787', 'BK-20516', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101787', 'BK-20517', 'borrowed', 'Floor 3 • Shelf AR-01 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101794', 'BK-20519', 'available', 'Floor 3 • Shelf AR-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101794', 'BK-20521', 'available', 'Floor 3 • Shelf AR-02 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9781968101800', 'BK-20522', 'available', 'Floor 3 • Shelf AR-03 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9781968101800', 'BK-20524', 'borrowed', 'Floor 3 • Shelf AR-03 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101817', 'BK-20525', 'borrowed', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101817', 'BK-20526', 'held', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'batch', 'reservation', 24::int),
    ('9786048101824', 'BK-20527', 'available', 'Floor 3 • Shelf AR-05 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101831', 'BK-20529', 'available', 'Floor 3 • Shelf AR-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101831', 'BK-20530', 'available', 'Floor 3 • Shelf AR-06 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101831', 'BK-20531', 'borrowed', 'Floor 3 • Shelf AR-06 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101848', 'BK-20532', 'available', 'Floor 3 • Shelf AR-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101848', 'BK-20533', 'available', 'Floor 3 • Shelf AR-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101848', 'BK-20534', 'available', 'Floor 3 • Shelf AR-07 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101855', 'BK-20535', 'available', 'Floor 3 • Shelf AR-08 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101855', 'BK-20536', 'available', 'Floor 3 • Shelf AR-08 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101862', 'BK-20537', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101862', 'BK-20539', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101879', 'BK-20541', 'borrowed', 'Floor 3 • Shelf AR-10 (West Wing)', 'fair', 'batch', null::text, null::int),
    ('9786048101886', 'BK-20544', 'available', 'Floor 3 • Shelf AR-11 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101893', 'BK-20545', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101909', 'BK-20549', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'batch', null::text, null::int),
    ('9786048101916', 'BK-20551', 'available', 'Floor 3 • Shelf AR-02 (West Wing)', 'good', 'batch', null::text, null::int)
  ) as v(isbn13, barcode, status, shelf_location, condition, source_type, held_for_type, held_hours)
  join public.books b on b.isbn13 = v.isbn13
  on conflict (barcode) do nothing;
end $$;

-- Physical copies (manual acquisitions & donations -> Admin History: Manual additions)
do $$
begin
  perform set_config('app.inventory_actor', '22222222-2222-2222-2222-222222222222', true);
  perform set_config('app.inventory_type', 'manual_addition', true);
  perform set_config('app.inventory_reason', 'Catalog acquisition outside batch (SCRUM-81)', true);
  insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type, held_for_type, held_until)
  select b.id, v.barcode, v.status, v.shelf_location, v.condition, v.source_type, v.held_for_type,
         case when v.held_hours is not null then now() + make_interval(hours => v.held_hours) else null end
  from (values
    ('9781968100018', 'BK-20001', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100018', 'BK-20003', 'borrowed', 'Floor 2 • Shelf CS-01 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100056', 'BK-20012', 'borrowed', 'Floor 2 • Shelf CS-05 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100070', 'BK-20017', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100070', 'BK-20020', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968100087', 'BK-20024', 'available', 'Floor 2 • Shelf CS-08 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100094', 'BK-20025', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100094', 'BK-20028', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100124', 'BK-20035', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100131', 'BK-20037', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100131', 'BK-20038', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968100131', 'BK-20039', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100155', 'BK-20044', 'available', 'Floor 2 • Shelf CS-03 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100155', 'BK-20045', 'borrowed', 'Floor 2 • Shelf CS-03 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100162', 'BK-20047', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100162', 'BK-20049', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100179', 'BK-20050', 'available', 'Floor 2 • Shelf CS-05 (West Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968100179', 'BK-20051', 'available', 'Floor 2 • Shelf CS-05 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100193', 'BK-20055', 'available', 'Floor 2 • Shelf CS-07 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100230', 'BK-20068', 'available', 'Floor 2 • Shelf CS-11 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100254', 'BK-20074', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100254', 'BK-20075', 'available', 'Floor 2 • Shelf CS-01 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100261', 'BK-20076', 'available', 'Floor 2 • Shelf CS-02 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100285', 'BK-20080', 'available', 'Floor 2 • Shelf CS-04 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048100322', 'BK-20094', 'borrowed', 'Floor 2 • Shelf CS-08 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100339', 'BK-20096', 'available', 'Floor 2 • Shelf CS-09 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100346', 'BK-20100', 'available', 'Floor 2 • Shelf CS-10 (West Wing)', 'fair', 'donation', null::text, null::int),
    ('9786048100353', 'BK-20102', 'available', 'Floor 2 • Shelf CS-11 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100360', 'BK-20105', 'available', 'Floor 2 • Shelf CS-12 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100377', 'BK-20108', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100377', 'BK-20110', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100384', 'BK-20111', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100391', 'BK-20116', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100407', 'BK-20117', 'available', 'Floor 2 • Shelf SC-04 (East Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968100414', 'BK-20120', 'available', 'Floor 2 • Shelf SC-05 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100421', 'BK-20124', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100421', 'BK-20125', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100438', 'BK-20127', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100445', 'BK-20130', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100452', 'BK-20132', 'borrowed', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100483', 'BK-20139', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968100483', 'BK-20142', 'borrowed', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100513', 'BK-20148', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100544', 'BK-20154', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100544', 'BK-20156', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100544', 'BK-20157', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100575', 'BK-20163', 'available', 'Floor 2 • Shelf SC-09 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100599', 'BK-20169', 'borrowed', 'Floor 2 • Shelf SC-11 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100605', 'BK-20173', 'available', 'Floor 2 • Shelf SC-12 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100612', 'BK-20175', 'available', 'Floor 2 • Shelf SC-01 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100629', 'BK-20178', 'available', 'Floor 2 • Shelf SC-02 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100636', 'BK-20181', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100636', 'BK-20183', 'available', 'Floor 2 • Shelf SC-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100667', 'BK-20188', 'available', 'Floor 2 • Shelf SC-06 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100674', 'BK-20190', 'available', 'Floor 2 • Shelf SC-07 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100681', 'BK-20193', 'available', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100681', 'BK-20194', 'borrowed', 'Floor 2 • Shelf SC-08 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100704', 'BK-20198', 'available', 'Floor 2 • Shelf SC-10 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100728', 'BK-20204', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100766', 'BK-20215', 'available', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100766', 'BK-20216', 'available', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100780', 'BK-20222', 'available', 'Floor 1 • Shelf NF-08 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100780', 'BK-20223', 'borrowed', 'Floor 1 • Shelf NF-08 (North Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968100797', 'BK-20224', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100797', 'BK-20226', 'available', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100803', 'BK-20228', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100803', 'BK-20230', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100810', 'BK-20232', 'available', 'Floor 1 • Shelf NF-11 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100827', 'BK-20233', 'available', 'Floor 1 • Shelf NF-12 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9781968100827', 'BK-20234', 'available', 'Floor 1 • Shelf NF-12 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100841', 'BK-20238', 'available', 'Floor 1 • Shelf NF-02 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100858', 'BK-20243', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100865', 'BK-20245', 'borrowed', 'Floor 1 • Shelf NF-04 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100889', 'BK-20252', 'available', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968100896', 'BK-20253', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048100926', 'BK-20260', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100933', 'BK-20264', 'available', 'Floor 1 • Shelf NF-11 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9786048100940', 'BK-20266', 'available', 'Floor 1 • Shelf NF-12 (North Wing)', 'fair', 'donation', null::text, null::int),
    ('9786048100971', 'BK-20273', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100971', 'BK-20274', 'available', 'Floor 1 • Shelf NF-03 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048100995', 'BK-20280', 'available', 'Floor 1 • Shelf NF-05 (North Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101008', 'BK-20284', 'borrowed', 'Floor 1 • Shelf NF-06 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101015', 'BK-20286', 'available', 'Floor 1 • Shelf NF-07 (North Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101039', 'BK-20293', 'held', 'Floor 1 • Shelf NF-09 (North Wing)', 'good', 'donation', 'reservation', 36::int),
    ('9786048101046', 'BK-20296', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101046', 'BK-20297', 'available', 'Floor 1 • Shelf NF-10 (North Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101060', 'BK-20301', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101060', 'BK-20302', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101077', 'BK-20304', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101084', 'BK-20307', 'available', 'Floor 3 • Shelf FI-04 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101084', 'BK-20308', 'available', 'Floor 3 • Shelf FI-04 (South Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968101084', 'BK-20309', 'borrowed', 'Floor 3 • Shelf FI-04 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101091', 'BK-20310', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101091', 'BK-20311', 'borrowed', 'Floor 3 • Shelf FI-05 (South Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968101107', 'BK-20315', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101114', 'BK-20316', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101114', 'BK-20318', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101114', 'BK-20319', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101152', 'BK-20331', 'held', 'Floor 3 • Shelf FI-11 (South Wing)', 'good', 'donation', 'reservation', 36::int),
    ('9781968101176', 'BK-20336', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101176', 'BK-20337', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101183', 'BK-20342', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101183', 'BK-20343', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101213', 'BK-20347', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101213', 'BK-20348', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101213', 'BK-20349', 'available', 'Floor 3 • Shelf FI-05 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101237', 'BK-20353', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968101237', 'BK-20355', 'available', 'Floor 3 • Shelf FI-07 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101244', 'BK-20356', 'available', 'Floor 3 • Shelf FI-08 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101251', 'BK-20358', 'available', 'Floor 3 • Shelf FI-09 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101268', 'BK-20363', 'available', 'Floor 3 • Shelf FI-10 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101299', 'BK-20371', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101299', 'BK-20372', 'available', 'Floor 3 • Shelf FI-01 (South Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101305', 'BK-20375', 'available', 'Floor 3 • Shelf FI-02 (South Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101312', 'BK-20378', 'available', 'Floor 3 • Shelf FI-03 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101329', 'BK-20382', 'available', 'Floor 3 • Shelf FI-04 (South Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101343', 'BK-20388', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101343', 'BK-20389', 'available', 'Floor 3 • Shelf FI-06 (South Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101381', 'BK-20396', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101381', 'BK-20397', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101398', 'BK-20399', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101411', 'BK-20408', 'borrowed', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101428', 'BK-20411', 'available', 'Floor 2 • Shelf NS-05 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101435', 'BK-20412', 'available', 'Floor 2 • Shelf NS-06 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101442', 'BK-20413', 'available', 'Floor 2 • Shelf NS-07 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968101442', 'BK-20414', 'available', 'Floor 2 • Shelf NS-07 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968101466', 'BK-20419', 'available', 'Floor 2 • Shelf NS-09 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101480', 'BK-20427', 'available', 'Floor 2 • Shelf NS-11 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101480', 'BK-20428', 'held', 'Floor 2 • Shelf NS-11 (East Wing)', 'good', 'purchase_outside_batch', 'reservation', 36::int),
    ('9781968101503', 'BK-20434', 'borrowed', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101510', 'BK-20436', 'available', 'Floor 2 • Shelf NS-02 (East Wing)', 'fair', 'donation', null::text, null::int),
    ('9781968101527', 'BK-20438', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101534', 'BK-20442', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101534', 'BK-20443', 'borrowed', 'Floor 2 • Shelf NS-04 (East Wing)', 'fair', 'donation', null::text, null::int),
    ('9786048101558', 'BK-20446', 'available', 'Floor 2 • Shelf NS-06 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101558', 'BK-20448', 'borrowed', 'Floor 2 • Shelf NS-06 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101565', 'BK-20449', 'available', 'Floor 2 • Shelf NS-07 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101572', 'BK-20452', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101572', 'BK-20453', 'available', 'Floor 2 • Shelf NS-08 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101596', 'BK-20459', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101596', 'BK-20460', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101596', 'BK-20461', 'available', 'Floor 2 • Shelf NS-10 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101619', 'BK-20466', 'available', 'Floor 2 • Shelf NS-12 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101626', 'BK-20468', 'available', 'Floor 2 • Shelf NS-01 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101640', 'BK-20472', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101640', 'BK-20473', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9786048101640', 'BK-20474', 'available', 'Floor 2 • Shelf NS-03 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101657', 'BK-20475', 'available', 'Floor 2 • Shelf NS-04 (East Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101664', 'BK-20480', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101695', 'BK-20488', 'borrowed', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101695', 'BK-20489', 'available', 'Floor 3 • Shelf AR-04 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101718', 'BK-20493', 'available', 'Floor 3 • Shelf AR-06 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int),
    ('9781968101732', 'BK-20497', 'available', 'Floor 3 • Shelf AR-08 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101732', 'BK-20498', 'borrowed', 'Floor 3 • Shelf AR-08 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101732', 'BK-20499', 'available', 'Floor 3 • Shelf AR-08 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101749', 'BK-20503', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101749', 'BK-20504', 'available', 'Floor 3 • Shelf AR-09 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101756', 'BK-20505', 'available', 'Floor 3 • Shelf AR-10 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101756', 'BK-20508', 'borrowed', 'Floor 3 • Shelf AR-10 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101770', 'BK-20511', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9781968101770', 'BK-20512', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101787', 'BK-20518', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101794', 'BK-20520', 'available', 'Floor 3 • Shelf AR-02 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9781968101800', 'BK-20523', 'available', 'Floor 3 • Shelf AR-03 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101824', 'BK-20528', 'available', 'Floor 3 • Shelf AR-05 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101879', 'BK-20540', 'available', 'Floor 3 • Shelf AR-10 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101886', 'BK-20543', 'available', 'Floor 3 • Shelf AR-11 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101893', 'BK-20546', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'donation', null::text, null::int),
    ('9786048101893', 'BK-20547', 'available', 'Floor 3 • Shelf AR-12 (West Wing)', 'good', 'purchase_outside_batch', null::text, null::int),
    ('9786048101909', 'BK-20550', 'available', 'Floor 3 • Shelf AR-01 (West Wing)', 'fair', 'purchase_outside_batch', null::text, null::int)
  ) as v(isbn13, barcode, status, shelf_location, condition, source_type, held_for_type, held_hours)
  join public.books b on b.isbn13 = v.isbn13
  on conflict (barcode) do nothing;
end $$;

-- Physical copies with lifecycle transitions (Admin History: Status changes & Stock reductions)
do $$
begin
  perform set_config('app.inventory_actor', '22222222-2222-2222-2222-222222222222', true);
  perform set_config('app.inventory_type', 'batch_receipt', true);
  perform set_config('app.inventory_reason', 'Initial catalog batch receipt (SCRUM-81)', true);
  insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type)
  select b.id, v.barcode, 'available', v.shelf_location, 'good', v.source_type
  from (values
    ('9781968100025', 'BK-20006', 'Floor 2 • Shelf CS-02 (West Wing)', 'batch'),
    ('9781968100056', 'BK-20013', 'Floor 2 • Shelf CS-05 (West Wing)', 'batch'),
    ('9781968100063', 'BK-20016', 'Floor 2 • Shelf CS-06 (West Wing)', 'batch'),
    ('9781968100193', 'BK-20057', 'Floor 2 • Shelf CS-07 (West Wing)', 'purchase_outside_batch'),
    ('9781968100209', 'BK-20060', 'Floor 2 • Shelf CS-08 (West Wing)', 'batch'),
    ('9781968100216', 'BK-20063', 'Floor 2 • Shelf CS-09 (West Wing)', 'donation'),
    ('9786048100247', 'BK-20070', 'Floor 2 • Shelf CS-12 (West Wing)', 'purchase_outside_batch'),
    ('9786048100247', 'BK-20072', 'Floor 2 • Shelf CS-12 (West Wing)', 'purchase_outside_batch'),
    ('9786048100292', 'BK-20087', 'Floor 2 • Shelf CS-05 (West Wing)', 'batch'),
    ('9786048100315', 'BK-20093', 'Floor 2 • Shelf CS-07 (West Wing)', 'batch'),
    ('9786048100322', 'BK-20095', 'Floor 2 • Shelf CS-08 (West Wing)', 'batch'),
    ('9786048100339', 'BK-20097', 'Floor 2 • Shelf CS-09 (West Wing)', 'batch'),
    ('9786048100360', 'BK-20107', 'Floor 2 • Shelf CS-12 (West Wing)', 'batch'),
    ('9781968100377', 'BK-20109', 'Floor 2 • Shelf SC-01 (East Wing)', 'batch'),
    ('9781968100414', 'BK-20121', 'Floor 2 • Shelf SC-05 (East Wing)', 'batch'),
    ('9781968100438', 'BK-20129', 'Floor 2 • Shelf SC-07 (East Wing)', 'batch'),
    ('9786048100599', 'BK-20170', 'Floor 2 • Shelf SC-11 (East Wing)', 'batch'),
    ('9786048100605', 'BK-20174', 'Floor 2 • Shelf SC-12 (East Wing)', 'batch'),
    ('9786048100636', 'BK-20182', 'Floor 2 • Shelf SC-03 (East Wing)', 'purchase_outside_batch'),
    ('9786048100667', 'BK-20189', 'Floor 2 • Shelf SC-06 (East Wing)', 'purchase_outside_batch'),
    ('9786048100704', 'BK-20200', 'Floor 2 • Shelf SC-10 (East Wing)', 'batch'),
    ('9781968100728', 'BK-20203', 'Floor 1 • Shelf NF-02 (North Wing)', 'batch'),
    ('9781968100759', 'BK-20214', 'Floor 1 • Shelf NF-05 (North Wing)', 'batch'),
    ('9781968100865', 'BK-20246', 'Floor 1 • Shelf NF-04 (North Wing)', 'purchase_outside_batch'),
    ('9781968100896', 'BK-20255', 'Floor 1 • Shelf NF-07 (North Wing)', 'batch'),
    ('9781968100919', 'BK-20259', 'Floor 1 • Shelf NF-09 (North Wing)', 'batch'),
    ('9786048100926', 'BK-20262', 'Floor 1 • Shelf NF-10 (North Wing)', 'donation'),
    ('9786048100940', 'BK-20268', 'Floor 1 • Shelf NF-12 (North Wing)', 'batch'),
    ('9781968101077', 'BK-20305', 'Floor 3 • Shelf FI-03 (South Wing)', 'batch'),
    ('9781968101121', 'BK-20321', 'Floor 3 • Shelf FI-08 (South Wing)', 'batch'),
    ('9781968101138', 'BK-20325', 'Floor 3 • Shelf FI-09 (South Wing)', 'batch'),
    ('9781968101176', 'BK-20338', 'Floor 3 • Shelf FI-01 (South Wing)', 'donation'),
    ('9786048101282', 'BK-20369', 'Floor 3 • Shelf FI-12 (South Wing)', 'batch'),
    ('9786048101305', 'BK-20376', 'Floor 3 • Shelf FI-02 (South Wing)', 'batch'),
    ('9786048101336', 'BK-20385', 'Floor 3 • Shelf FI-05 (South Wing)', 'batch'),
    ('9786048101374', 'BK-20395', 'Floor 3 • Shelf FI-09 (South Wing)', 'donation'),
    ('9781968101404', 'BK-20404', 'Floor 2 • Shelf NS-03 (East Wing)', 'batch'),
    ('9781968101411', 'BK-20406', 'Floor 2 • Shelf NS-04 (East Wing)', 'batch'),
    ('9781968101442', 'BK-20416', 'Floor 2 • Shelf NS-07 (East Wing)', 'batch'),
    ('9781968101466', 'BK-20420', 'Floor 2 • Shelf NS-09 (East Wing)', 'batch'),
    ('9781968101473', 'BK-20424', 'Floor 2 • Shelf NS-10 (East Wing)', 'batch'),
    ('9781968101503', 'BK-20433', 'Floor 2 • Shelf NS-01 (East Wing)', 'purchase_outside_batch'),
    ('9781968101527', 'BK-20439', 'Floor 2 • Shelf NS-03 (East Wing)', 'batch'),
    ('9786048101589', 'BK-20457', 'Floor 2 • Shelf NS-09 (East Wing)', 'batch'),
    ('9786048101602', 'BK-20463', 'Floor 2 • Shelf NS-11 (East Wing)', 'batch'),
    ('9781968101770', 'BK-20513', 'Floor 3 • Shelf AR-12 (West Wing)', 'batch'),
    ('9786048101862', 'BK-20538', 'Floor 3 • Shelf AR-09 (West Wing)', 'batch'),
    ('9786048101879', 'BK-20542', 'Floor 3 • Shelf AR-10 (West Wing)', 'batch'),
    ('9786048101893', 'BK-20548', 'Floor 3 • Shelf AR-12 (West Wing)', 'purchase_outside_batch')
  ) as v(isbn13, barcode, shelf_location, source_type)
  join public.books b on b.isbn13 = v.isbn13
  on conflict (barcode) do nothing;

  perform set_config('app.inventory_type', 'status_change', true);
  perform set_config('app.inventory_reason', 'Shelf audit: cover or binding damaged', true);
  update public.copies
  set status = 'damaged', condition = 'damaged'
  where barcode in ('BK-20006', 'BK-20060', 'BK-20093', 'BK-20121', 'BK-20174', 'BK-20214', 'BK-20255', 'BK-20259', 'BK-20262', 'BK-20338', 'BK-20416', 'BK-20433', 'BK-20513') and status = 'available';

  perform set_config('app.inventory_type', 'status_change', true);
  perform set_config('app.inventory_reason', 'Routed to conservation bench for rebinding', true);
  update public.copies
  set status = 'under_repair', condition = 'poor'
  where barcode in ('BK-20013', 'BK-20057', 'BK-20063', 'BK-20095', 'BK-20097', 'BK-20107', 'BK-20170', 'BK-20182', 'BK-20200', 'BK-20203', 'BK-20246', 'BK-20321', 'BK-20325', 'BK-20385', 'BK-20404', 'BK-20439', 'BK-20457', 'BK-20538') and status = 'available';

  perform set_config('app.inventory_type', 'lost', true);
  perform set_config('app.inventory_reason', 'Confirmed missing during semester inventory audit', true);
  update public.copies
  set status = 'lost', condition = 'poor'
  where barcode in ('BK-20070', 'BK-20129', 'BK-20268', 'BK-20305', 'BK-20424', 'BK-20548') and status = 'available';

  perform set_config('app.inventory_type', 'write_off', true);
  perform set_config('app.inventory_reason', 'Retired due to wear beyond repair', true);
  update public.copies
  set status = 'retired', condition = 'damaged'
  where barcode in ('BK-20016', 'BK-20072', 'BK-20087', 'BK-20109', 'BK-20189', 'BK-20369', 'BK-20376', 'BK-20395', 'BK-20406', 'BK-20420', 'BK-20463', 'BK-20542') and status = 'available';

end $$;
-- =============================================================================
-- END GENERATED BOOK SEED (SCRUM-81)
-- =============================================================================
