-- ==========================================================
-- Incremental fix: add training session identity and duration.
-- Run this before testing the redesigned workout summary.
-- ==========================================================

alter table public.workouts
  add column if not exists session_id uuid,
  add column if not exists session_duration_seconds int;

alter table public.workout_sets
  add column if not exists session_id uuid;

alter table public.one_rm_records
  add column if not exists session_id uuid;

create index if not exists idx_workouts_user_session
  on public.workouts (user_id, session_id, created_at);

create index if not exists idx_workout_sets_user_session
  on public.workout_sets (user_id, session_id);

-- Recreate RPC so new saves write session_id and duration.
create or replace function public.complete_workout_session(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(payload->>'session_id', '')::uuid;
  v_session_duration_seconds int := nullif(payload->>'session_duration_seconds', '')::int;
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

  if v_session_id is null then
    raise exception 'session_id is required';
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
      session_id,
      session_duration_seconds,
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
      v_session_id,
      v_session_duration_seconds,
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
      session_id,
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
      v_session_id,
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
      session_id,
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
      v_session_id,
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

  return jsonb_build_object('session_id', v_session_id, 'workouts', v_created_workouts);
end;
$$;

revoke all on function public.complete_workout_session(jsonb) from public;
revoke all on function public.complete_workout_session(jsonb) from anon;
grant execute on function public.complete_workout_session(jsonb) to authenticated;
