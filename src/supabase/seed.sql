-- Seed data for local development (SRS §10.6).
-- M0a: minimal placeholder so the frontend has something to read.
-- The full seed (every Loan Item state, queues, charges, receipts) lands with
-- the milestones that define those tables.

-- Staff account note: profiles.id references auth.users(id), so a seed user must
-- exist in auth first. Create the Auth user with the admin script (SRS §2.1) or
-- via supabase auth admin, then insert the matching profile here.

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
