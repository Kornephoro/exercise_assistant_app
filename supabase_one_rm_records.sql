-- ============================================
-- 1RM 力量记录表
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

CREATE TABLE IF NOT EXISTS public.one_rm_records (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  exercise TEXT NOT NULL CHECK (exercise IN ('squat','bench','deadlift','press')),
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  reps INT NOT NULL,
  e1rm_kg NUMERIC NOT NULL,
  formula TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual','auto_from_workout')),
  source_workout_id BIGINT REFERENCES public.workouts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_one_rm_user_exercise_date
  ON public.one_rm_records(user_id, exercise, date DESC);

ALTER TABLE public.one_rm_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select" ON public.one_rm_records
  FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON public.one_rm_records
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON public.one_rm_records
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_public_delete" ON public.one_rm_records
  FOR DELETE USING (true);
