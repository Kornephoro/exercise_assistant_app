-- ==========================================================
-- Incremental fix: allow workout_sets to reference workouts.
-- Run this if complete_workout_session fails with:
-- column "workout_id" of relation "workout_sets" does not exist
-- ==========================================================

alter table public.workout_sets
  add column if not exists workout_id bigint references public.workouts(id);

create index if not exists idx_workout_sets_workout_id
  on public.workout_sets (workout_id);

-- Optional sanity check. Should return one row with column_exists = true.
select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'workout_sets'
    and column_name = 'workout_id'
) as column_exists;
