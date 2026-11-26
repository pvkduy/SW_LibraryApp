alter table public.book_reviews
  add column if not exists headline text;

drop function if exists public.rpc_submit_book_review(uuid, integer, text);

create function public.rpc_submit_book_review(
  p_loan_item_id uuid,
  p_rating integer,
  p_comment text default null,
  p_headline text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_item record;
  v_review_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  if p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'INVALID_RATING', 'message', 'Rating must be between 1 and 5 stars.');
  end if;

  if length(trim(coalesce(p_headline, ''))) > 80 then
    return jsonb_build_object('success', false, 'error', 'HEADLINE_TOO_LONG', 'message', 'Review headline must be 80 characters or fewer.');
  end if;

  if length(coalesce(p_comment, '')) > 500 then
    return jsonb_build_object('success', false, 'error', 'COMMENT_TOO_LONG', 'message', 'Review must be 500 characters or fewer.');
  end if;

  select li.*, c.book_id
  into v_item
  from public.loan_items li
  join public.copies c on c.id = li.copy_id
  where li.id = p_loan_item_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Loan record not found.');
  end if;

  if v_item.uid <> v_uid then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You cannot review this loan.');
  end if;

  if v_item.status <> 'returned' then
    return jsonb_build_object('success', false, 'error', 'NOT_RETURNED', 'message', 'You can review a book after returning it.');
  end if;

  insert into public.book_reviews (book_id, loan_item_id, uid, rating, headline, comment, updated_at)
  values (v_item.book_id, p_loan_item_id, v_uid, p_rating, nullif(trim(p_headline), ''), p_comment, app_now())
  on conflict (uid, loan_item_id)
  do update set
    rating = excluded.rating,
    headline = excluded.headline,
    comment = excluded.comment,
    updated_at = app_now()
  returning id into v_review_id;

  return jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'message', 'Thank you for sharing your review!'
  );
end;
$$;
