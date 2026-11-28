alter table public.receipts
  drop constraint if exists receipts_method_check;

alter table public.receipts
  add constraint receipts_method_check
  check (method in ('cash', 'card', 'transfer', 'counter', 'online', 'ewallet', 'mobile_banking'));

alter table public.receipts
  drop constraint if exists receipts_type_check;

alter table public.receipts
  add constraint receipts_type_check
  check (type in (
    'fine', 'damage', 'loss', 'borrow_fee', 'membership',
    'overdue_fine', 'damage_fee', 'loss_fee', 'premium_fee', 'reversal', 'manual'
  ));
