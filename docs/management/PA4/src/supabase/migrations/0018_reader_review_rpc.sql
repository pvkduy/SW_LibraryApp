create or replace function public.rpc_submit_book_review_for_user(
  p_user_id uuid,
  p_loan_item_id uuid,
  p_rating integer,
  p_comment text,
  p_headline text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_submit_book_review(p_loan_item_id, p_rating, p_comment, p_headline);
end;
$$;

revoke execute on function public.rpc_submit_book_review_for_user(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.rpc_submit_book_review_for_user(uuid, uuid, integer, text, text) to service_role;
revoke execute on function public.rpc_submit_book_review(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.rpc_submit_book_review(uuid, integer, text, text) to service_role;

notify pgrst, 'reload schema';
