-- ==========================================================
-- Critical fixes: tenant isolation + transactional workout save
-- Run in Supabase SQL Editor after reviewing the preflight output.
-- ==========================================================

-- ----------------------------------------------------------
-- 0. Schema compatibility: older deployments may not yet have
-- user_id on every user-owned table, but the app now uses it as
-- the tenant key and upsert/RLS ownership boundary.
-- ----------------------------------------------------------
alter table public.user_profiles
  add column if not exists user_id uuid;

alter table public.user_programs
  add column if not exists user_id uuid;

alter table public.workouts
  add column if not exists user_id uuid;

alter table public.workout_sets
  add column if not exists user_id uuid;

alter table public.one_rm_records
  add column if not exists user_id uuid;

alter table public.body_metrics
  add column if not exists user_id uuid;

alter table public.diet_logs
  add column if not exists user_id uuid;

alter table public.user_nutrition_configs
  add column if not exists user_id uuid;

alter table public.workout_templates
  add column if not exists user_id uuid;

create unique index if not exists idx_user_profiles_user_id
  on public.user_profiles (user_id);

-- ----------------------------------------------------------
-- 1. Preflight: check rows that cannot be assigned to a user.
-- If any count is > 0 in production, backfill user_id manually
-- before depending on the stricter RLS policies below.
-- Note: workout_templates rows with user_id null may be built-in public
-- templates and can remain null intentionally.
-- ----------------------------------------------------------
select 'user_profiles' as table_name, count(*) as null_user_id_rows from public.user_profiles where user_id is null
union all
select 'user_programs', count(*) from public.user_programs where user_id is null
union all
select 'workouts', count(*) from public.workouts where user_id is null
union all
select 'workout_sets', count(*) from public.workout_sets where user_id is null
union all
select 'one_rm_records', count(*) from public.one_rm_records where user_id is null
union all
select 'body_metrics', count(*) from public.body_metrics where user_id is null
union all
select 'diet_logs', count(*) from public.diet_logs where user_id is null
union all
select 'user_nutrition_configs', count(*) from public.user_nutrition_configs where user_id is null
union all
select 'workout_templates', count(*) from public.workout_templates where user_id is null;

-- ----------------------------------------------------------
-- 2. Direct unique indexes that match frontend onConflict keys.
-- The old COALESCE expression indexes can stay during migration,
-- but these indexes are what Supabase upsert(date,user_id) needs.
-- ----------------------------------------------------------
create unique index if not exists idx_body_metrics_user_id_date
  on public.body_metrics (date, user_id);

create unique index if not exists idx_diet_logs_user_id_date
  on public.diet_logs (date, user_id);

create unique index if not exists idx_user_nutrition_configs_user_active
  on public.user_nutrition_configs (user_id)
  where user_id is not null and is_active = true;

-- Ensure the transactional RPC can store all current set detail variants.
alter table public.workout_sets
  add column if not exists workout_id bigint references public.workouts(id),
  add column if not exists is_warmup boolean default false,
  add column if not exists notes text,
  add column if not exists rpe numeric(3,1),
  add column if not exists tempo_eccentric int2,
  add column if not exists tempo_pause_bottom int2,
  add column if not exists tempo_concentric int2,
  add column if not exists tempo_pause_top int2,
  add column if not exists rest_duration int2,
  add column if not exists duration_seconds int,
  add column if not exists distance_meters numeric;

create index if not exists idx_workout_sets_workout_id
  on public.workout_sets (workout_id);

-- Current exercise recording modes do not always have weight/reps fields.
alter table public.workouts
  alter column weight_kg drop not null,
  alter column planned_reps drop not null;

alter table public.workout_sets
  alter column weight_kg drop not null,
  alter column planned_reps drop not null,
  alter column actual_reps drop not null;

-- ----------------------------------------------------------
-- 3. System/reference tables: public read, no browser-side write.
-- Seed and admin writes should happen through SQL Editor / migrations.
-- ----------------------------------------------------------
alter table public.programs enable row level security;
drop policy if exists "allow_public_select" on public.programs;
drop policy if exists "allow_public_insert" on public.programs;
drop policy if exists "allow_public_update" on public.programs;
drop policy if exists "allow_public_delete" on public.programs;
drop policy if exists "programs_public_select" on public.programs;
create policy "programs_public_select"
  on public.programs for select
  using (true);

alter table public.muscle_groups enable row level security;
drop policy if exists "allow_public_select" on public.muscle_groups;
drop policy if exists "allow_public_insert" on public.muscle_groups;
drop policy if exists "allow_public_update" on public.muscle_groups;
drop policy if exists "allow_public_delete" on public.muscle_groups;
drop policy if exists "muscle_groups_public_select" on public.muscle_groups;
create policy "muscle_groups_public_select"
  on public.muscle_groups for select
  using (true);

alter table public.exercises enable row level security;
drop policy if exists "allow_public_select" on public.exercises;
drop policy if exists "allow_public_insert" on public.exercises;
drop policy if exists "allow_public_update" on public.exercises;
drop policy if exists "allow_public_delete" on public.exercises;
drop policy if exists "exercises_public_select" on public.exercises;
create policy "exercises_public_select"
  on public.exercises for select
  using (true);

-- ----------------------------------------------------------
-- 4. User-owned private tables.
-- ----------------------------------------------------------
alter table public.user_profiles enable row level security;
drop policy if exists "allow_public_select" on public.user_profiles;
drop policy if exists "allow_public_insert" on public.user_profiles;
drop policy if exists "allow_public_update" on public.user_profiles;
drop policy if exists "allow_public_delete" on public.user_profiles;
drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);
create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);
create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "user_profiles_delete_own"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

alter table public.user_programs enable row level security;
drop policy if exists "allow_public_select" on public.user_programs;
drop policy if exists "allow_public_insert" on public.user_programs;
drop policy if exists "allow_public_update" on public.user_programs;
drop policy if exists "allow_public_delete" on public.user_programs;
drop policy if exists "user_programs_select_own" on public.user_programs;
drop policy if exists "user_programs_insert_own" on public.user_programs;
drop policy if exists "user_programs_update_own" on public.user_programs;
drop policy if exists "user_programs_delete_own" on public.user_programs;
create policy "user_programs_select_own"
  on public.user_programs for select
  using (auth.uid() = user_id);
create policy "user_programs_insert_own"
  on public.user_programs for insert
  with check (auth.uid() = user_id);
create policy "user_programs_update_own"
  on public.user_programs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "user_programs_delete_own"
  on public.user_programs for delete
  using (auth.uid() = user_id);

alter table public.workouts enable row level security;
drop policy if exists "allow_public_select" on public.workouts;
drop policy if exists "allow_public_insert" on public.workouts;
drop policy if exists "allow_public_update" on public.workouts;
drop policy if exists "allow_public_delete" on public.workouts;
drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_select_own"
  on public.workouts for select
  using (auth.uid() = user_id);
create policy "workouts_insert_own"
  on public.workouts for insert
  with check (auth.uid() = user_id);
create policy "workouts_update_own"
  on public.workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "workouts_delete_own"
  on public.workouts for delete
  using (auth.uid() = user_id);

alter table public.workout_sets enable row level security;
drop policy if exists "allow_public_select" on public.workout_sets;
drop policy if exists "allow_public_insert" on public.workout_sets;
drop policy if exists "allow_public_update" on public.workout_sets;
drop policy if exists "allow_public_delete" on public.workout_sets;
drop policy if exists "workout_sets_select_own" on public.workout_sets;
drop policy if exists "workout_sets_insert_own" on public.workout_sets;
drop policy if exists "workout_sets_update_own" on public.workout_sets;
drop policy if exists "workout_sets_delete_own" on public.workout_sets;
create policy "workout_sets_select_own"
  on public.workout_sets for select
  using (auth.uid() = user_id);
create policy "workout_sets_insert_own"
  on public.workout_sets for insert
  with check (auth.uid() = user_id);
create policy "workout_sets_update_own"
  on public.workout_sets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "workout_sets_delete_own"
  on public.workout_sets for delete
  using (auth.uid() = user_id);

alter table public.one_rm_records enable row level security;
drop policy if exists "allow_public_select" on public.one_rm_records;
drop policy if exists "allow_public_insert" on public.one_rm_records;
drop policy if exists "allow_public_update" on public.one_rm_records;
drop policy if exists "allow_public_delete" on public.one_rm_records;
drop policy if exists "one_rm_records_select_own" on public.one_rm_records;
drop policy if exists "one_rm_records_insert_own" on public.one_rm_records;
drop policy if exists "one_rm_records_update_own" on public.one_rm_records;
drop policy if exists "one_rm_records_delete_own" on public.one_rm_records;
create policy "one_rm_records_select_own"
  on public.one_rm_records for select
  using (auth.uid() = user_id);
create policy "one_rm_records_insert_own"
  on public.one_rm_records for insert
  with check (auth.uid() = user_id);
create policy "one_rm_records_update_own"
  on public.one_rm_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "one_rm_records_delete_own"
  on public.one_rm_records for delete
  using (auth.uid() = user_id);

alter table public.body_metrics enable row level security;
drop policy if exists "allow_public_select" on public.body_metrics;
drop policy if exists "allow_public_insert" on public.body_metrics;
drop policy if exists "allow_public_update" on public.body_metrics;
drop policy if exists "allow_public_delete" on public.body_metrics;
drop policy if exists "body_metrics_select_own" on public.body_metrics;
drop policy if exists "body_metrics_insert_own" on public.body_metrics;
drop policy if exists "body_metrics_update_own" on public.body_metrics;
drop policy if exists "body_metrics_delete_own" on public.body_metrics;
create policy "body_metrics_select_own"
  on public.body_metrics for select
  using (auth.uid() = user_id);
create policy "body_metrics_insert_own"
  on public.body_metrics for insert
  with check (auth.uid() = user_id);
create policy "body_metrics_update_own"
  on public.body_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "body_metrics_delete_own"
  on public.body_metrics for delete
  using (auth.uid() = user_id);

alter table public.diet_logs enable row level security;
drop policy if exists "allow_public_select" on public.diet_logs;
drop policy if exists "allow_public_insert" on public.diet_logs;
drop policy if exists "allow_public_update" on public.diet_logs;
drop policy if exists "allow_public_delete" on public.diet_logs;
drop policy if exists "diet_logs_select_own" on public.diet_logs;
drop policy if exists "diet_logs_insert_own" on public.diet_logs;
drop policy if exists "diet_logs_update_own" on public.diet_logs;
drop policy if exists "diet_logs_delete_own" on public.diet_logs;
create policy "diet_logs_select_own"
  on public.diet_logs for select
  using (auth.uid() = user_id);
create policy "diet_logs_insert_own"
  on public.diet_logs for insert
  with check (auth.uid() = user_id);
create policy "diet_logs_update_own"
  on public.diet_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "diet_logs_delete_own"
  on public.diet_logs for delete
  using (auth.uid() = user_id);

alter table public.user_nutrition_configs enable row level security;
drop policy if exists "allow_public_select" on public.user_nutrition_configs;
drop policy if exists "allow_public_insert" on public.user_nutrition_configs;
drop policy if exists "allow_public_update" on public.user_nutrition_configs;
drop policy if exists "allow_public_delete" on public.user_nutrition_configs;
drop policy if exists "user_nutrition_configs_select_own" on public.user_nutrition_configs;
drop policy if exists "user_nutrition_configs_insert_own" on public.user_nutrition_configs;
drop policy if exists "user_nutrition_configs_update_own" on public.user_nutrition_configs;
drop policy if exists "user_nutrition_configs_delete_own" on public.user_nutrition_configs;
create policy "user_nutrition_configs_select_own"
  on public.user_nutrition_configs for select
  using (auth.uid() = user_id);
create policy "user_nutrition_configs_insert_own"
  on public.user_nutrition_configs for insert
  with check (auth.uid() = user_id);
create policy "user_nutrition_configs_update_own"
  on public.user_nutrition_configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "user_nutrition_configs_delete_own"
  on public.user_nutrition_configs for delete
  using (auth.uid() = user_id);

-- Templates: built-in rows may keep user_id null and are read-only to clients.
alter table public.workout_templates enable row level security;
drop policy if exists "allow_public_select" on public.workout_templates;
drop policy if exists "allow_public_insert" on public.workout_templates;
drop policy if exists "allow_public_update" on public.workout_templates;
drop policy if exists "allow_public_delete" on public.workout_templates;
drop policy if exists "workout_templates_select_visible" on public.workout_templates;
drop policy if exists "workout_templates_insert_own" on public.workout_templates;
drop policy if exists "workout_templates_update_own" on public.workout_templates;
drop policy if exists "workout_templates_delete_own" on public.workout_templates;
create policy "workout_templates_select_visible"
  on public.workout_templates for select
  using (user_id is null or auth.uid() = user_id);
create policy "workout_templates_insert_own"
  on public.workout_templates for insert
  with check (auth.uid() = user_id);
create policy "workout_templates_update_own"
  on public.workout_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "workout_templates_delete_own"
  on public.workout_templates for delete
  using (auth.uid() = user_id);

-- Optional after backfilling historical data:
-- alter table public.user_profiles alter column user_id set not null;
-- alter table public.user_programs alter column user_id set not null;
-- alter table public.workouts alter column user_id set not null;
-- alter table public.workout_sets alter column user_id set not null;
-- alter table public.one_rm_records alter column user_id set not null;
-- alter table public.body_metrics alter column user_id set not null;
-- alter table public.diet_logs alter column user_id set not null;
-- alter table public.user_nutrition_configs alter column user_id set not null;

-- ----------------------------------------------------------
-- 5. Transactional workout save RPC.
-- The client passes:
-- {
--   "user_program_id": 1,
--   "program_state": {...},
--   "updated_at": "2026-06-08T...",
--   "workout_records": [{ "client_key": "0", ... }],
--   "workout_sets": [{ "workout_client_key": "0", ... }],
--   "one_rm_records": [{ "workout_client_key": "0", ... }]
-- }
-- ----------------------------------------------------------
create or replace function public.complete_workout_session(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_program_id bigint := nullif(payload->>'user_program_id', '')::bigint;
  v_workout jsonb;
  v_set jsonb;
  v_one_rm jsonb;
  v_client_key text;
  v_workout_id bigint;
  v_workout_map jsonb := '{}'::jsonb;
  v_created_workouts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_user_program_id is null then
    raise exception 'user_program_id is required';
  end if;

  if not exists (
    select 1
    from public.user_programs
    where id = v_user_program_id
      and user_id = v_user_id
  ) then
    raise exception 'User program not found or not owned by current user';
  end if;

  for v_workout in
    select value from jsonb_array_elements(coalesce(payload->'workout_records', '[]'::jsonb))
  loop
    v_client_key := coalesce(
      nullif(v_workout->>'client_key', ''),
      concat(v_workout->>'exercise', ':', v_workout->>'tier')
    );

    insert into public.workouts (
      user_id,
      training_day,
      tier,
      exercise,
      weight_kg,
      planned_reps,
      actual_last_set_reps,
      program_id
    )
    values (
      v_user_id,
      v_workout->>'training_day',
      v_workout->>'tier',
      v_workout->>'exercise',
      nullif(v_workout->>'weight_kg', '')::numeric,
      nullif(v_workout->>'planned_reps', '')::int,
      nullif(v_workout->>'actual_last_set_reps', '')::int,
      nullif(v_workout->>'program_id', '')::bigint
    )
    returning id into v_workout_id;

    v_workout_map := jsonb_set(v_workout_map, array[v_client_key], to_jsonb(v_workout_id), true);
    v_created_workouts := v_created_workouts || jsonb_build_array(jsonb_build_object(
      'client_key', v_client_key,
      'id', v_workout_id,
      'exercise', v_workout->>'exercise',
      'tier', v_workout->>'tier'
    ));
  end loop;

  for v_set in
    select value from jsonb_array_elements(coalesce(payload->'workout_sets', '[]'::jsonb))
  loop
    v_client_key := v_set->>'workout_client_key';
    v_workout_id := nullif(v_workout_map->>v_client_key, '')::bigint;

    if v_workout_id is null then
      raise exception 'Workout set references unknown workout_client_key: %', v_client_key;
    end if;

    insert into public.workout_sets (
      user_id,
      workout_id,
      exercise,
      tier,
      set_number,
      completed,
      is_warmup,
      notes,
      rpe,
      tempo_eccentric,
      tempo_pause_bottom,
      tempo_concentric,
      tempo_pause_top,
      rest_duration,
      weight_kg,
      planned_reps,
      actual_reps,
      duration_seconds,
      distance_meters
    )
    values (
      v_user_id,
      v_workout_id,
      v_set->>'exercise',
      v_set->>'tier',
      nullif(v_set->>'set_number', '')::int,
      coalesce(nullif(v_set->>'completed', '')::boolean, false),
      coalesce(nullif(v_set->>'is_warmup', '')::boolean, false),
      nullif(v_set->>'notes', ''),
      nullif(v_set->>'rpe', '')::numeric,
      nullif(v_set->>'tempo_eccentric', '')::int,
      nullif(v_set->>'tempo_pause_bottom', '')::int,
      nullif(v_set->>'tempo_concentric', '')::int,
      nullif(v_set->>'tempo_pause_top', '')::int,
      nullif(v_set->>'rest_duration', '')::int,
      nullif(v_set->>'weight_kg', '')::numeric,
      nullif(v_set->>'planned_reps', '')::int,
      nullif(v_set->>'actual_reps', '')::int,
      nullif(v_set->>'duration_seconds', '')::int,
      nullif(v_set->>'distance_meters', '')::numeric
    );
  end loop;

  for v_one_rm in
    select value from jsonb_array_elements(coalesce(payload->'one_rm_records', '[]'::jsonb))
  loop
    v_client_key := v_one_rm->>'workout_client_key';
    v_workout_id := nullif(v_workout_map->>v_client_key, '')::bigint;

    insert into public.one_rm_records (
      user_id,
      exercise,
      date,
      weight_kg,
      reps,
      e1rm_kg,
      formula,
      source,
      source_workout_id
    )
    values (
      v_user_id,
      v_one_rm->>'exercise',
      nullif(v_one_rm->>'date', '')::date,
      nullif(v_one_rm->>'weight_kg', '')::numeric,
      nullif(v_one_rm->>'reps', '')::int,
      nullif(v_one_rm->>'e1rm_kg', '')::numeric,
      nullif(v_one_rm->>'formula', ''),
      coalesce(nullif(v_one_rm->>'source', ''), 'auto_from_workout'),
      v_workout_id
    );
  end loop;

  update public.user_programs
  set
    program_state = coalesce(payload->'program_state', program_state),
    updated_at = coalesce(nullif(payload->>'updated_at', '')::timestamptz, now())
  where id = v_user_program_id
    and user_id = v_user_id;

  return jsonb_build_object('workouts', v_created_workouts);
end;
$$;

revoke all on function public.complete_workout_session(jsonb) from public;
revoke all on function public.complete_workout_session(jsonb) from anon;
grant execute on function public.complete_workout_session(jsonb) to authenticated;
