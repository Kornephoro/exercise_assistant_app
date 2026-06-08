-- ==========================================================
-- Incremental fix: allow non-weight / non-rep recording modes.
-- Run this if complete_workout_session fails with:
-- null value in column "weight_kg" of relation "workout_sets"
-- ==========================================================

-- Summary workout rows: reps-only, duration-only, and distance-only
-- records may not have a meaningful external weight or planned reps.
alter table public.workouts
  alter column weight_kg drop not null,
  alter column planned_reps drop not null;

-- Detail set rows: duration/distance records store duration_seconds or
-- distance_meters instead of weight_kg / planned_reps / actual_reps.
alter table public.workout_sets
  alter column weight_kg drop not null,
  alter column planned_reps drop not null,
  alter column actual_reps drop not null;

-- Optional sanity check. is_nullable should now be YES for these columns.
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('workouts', 'workout_sets')
  and column_name in ('weight_kg', 'planned_reps', 'actual_reps')
order by table_name, column_name;
