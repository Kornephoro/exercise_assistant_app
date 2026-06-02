-- ============================================
-- 为 user_programs 表新增 day_map 列
-- 用于存储用户自定义的每日 T3 动作安排
-- 修复：用户在 ProgramConfig 修改每日 T3 后，今日训练不生效的 bug
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 新增 day_map 列（JSONB，可空）
-- 结构示例：{ "Day1": { "T1": "squat", "T2": "bench", "T3": ["lat_pulldown", "tricep_pushdown"] }, "Day2": { ... } }
ALTER TABLE public.user_programs
  ADD COLUMN IF NOT EXISTS day_map JSONB;

-- 验证（可选）
-- SELECT id, program_id, day_map FROM public.user_programs LIMIT 5;
