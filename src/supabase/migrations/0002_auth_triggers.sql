-- Migration: 0002_auth_triggers.sql
-- Description: Automatically create and activate profile when Supabase Auth manages users (FR-AUTH-01, FR-AUTH-02)

-- 1. Trigger function to insert profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    role,
    status,
    full_name,
    email,
    student_id,
    faculty,
    phone
  )
  values (
    new.id,
    coalesce(new.raw_app_meta_data->>'role', 'student'),
    'pending_verification',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'faculty',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    student_id = coalesce(excluded.student_id, public.profiles.student_id),
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 2. Trigger function to activate profile when user email is confirmed
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null or old.email_confirmed_at != new.email_confirmed_at) then
    update public.profiles
    set status = 'active',
        updated_at = app_now()
    where id = new.id
      and status = 'pending_verification';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.handle_user_email_confirmed();
