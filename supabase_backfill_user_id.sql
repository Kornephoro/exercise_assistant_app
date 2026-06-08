-- ==========================================================
-- Backfill legacy rows after adding user_id tenant isolation.
-- Run this in Supabase SQL Editor before testing the app.
-- ==========================================================

-- 1. Find your real app user id.
-- If auth.users is empty, first enable Anonymous sign-ins in Supabase
-- Authentication settings, then open the app once. The app will create
-- an anonymous auth.users row automatically.
-- If there is only one real/anonymous app user, copy its id into
-- target_user_id_text below.
select id, email, created_at, last_sign_in_at
from auth.users
order by created_at desc;

-- 2. Optional inspection: these rows will be hidden by strict RLS until assigned.
select 'user_profiles' as table_name, count(*) as null_user_id_rows
from public.user_profiles
where user_id is null
union all
select 'user_programs', count(*)
from public.user_programs
where user_id is null;

-- 3. Run this block.
-- If auth.users has exactly one row, it will use that user automatically.
-- If you have multiple users, replace PASTE_AUTH_USER_UUID_HERE with the target user id.
do $$
declare
  target_user_id_text text := 'PASTE_AUTH_USER_UUID_HERE';
  target_user_id uuid;
  auth_user_count integer := 0;
  updated_profiles integer := 0;
  updated_programs integer := 0;
begin
  select count(*) into auth_user_count from auth.users;

  if target_user_id_text = 'PASTE_AUTH_USER_UUID_HERE' then
    if auth_user_count = 1 then
      select id into target_user_id from auth.users order by created_at desc limit 1;
    else
      raise exception 'Replace target_user_id_text with auth.users.id before running this block. auth.users count: %', auth_user_count;
    end if;
  else
    target_user_id := target_user_id_text::uuid;
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'auth.users.id % does not exist', target_user_id;
  end if;

  update public.user_profiles
  set user_id = target_user_id
  where user_id is null;
  get diagnostics updated_profiles = row_count;

  update public.user_programs
  set user_id = target_user_id
  where user_id is null;
  get diagnostics updated_programs = row_count;

  raise notice 'Backfilled user_profiles rows: %, user_programs rows: %',
    updated_profiles,
    updated_programs;
end $$;

-- 4. Verify. user_profiles/user_programs should be 0.
-- workout_templates can remain > 0 when those rows are built-in public templates.
select 'user_profiles' as table_name, count(*) as null_user_id_rows from public.user_profiles where user_id is null
union all
select 'user_programs', count(*) from public.user_programs where user_id is null
union all
select 'workout_templates', count(*) from public.workout_templates where user_id is null;
