-- ============================================
-- 实时训练详细记录字段
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

ALTER TABLE public.workout_sets
  ADD COLUMN IF NOT EXISTS rpe NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS tempo_eccentric INT2,
  ADD COLUMN IF NOT EXISTS tempo_pause_bottom INT2,
  ADD COLUMN IF NOT EXISTS tempo_concentric INT2,
  ADD COLUMN IF NOT EXISTS tempo_pause_top INT2,
  ADD COLUMN IF NOT EXISTS rest_duration INT2;
