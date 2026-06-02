-- ============================================
-- 为 user_programs 表新增 ended_at 列
-- 修复：结束计划时 JS 写 ended_at 报
--       "Could not find the 'ended_at' column of 'user_programs' in the schema cache"
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

ALTER TABLE public.user_programs
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- 状态语义：
--   is_active=true,  ended_at IS NULL                    → 活跃
--   is_active=false, ended_at IS NULL, paused_at NOT NULL → 已暂停
--   is_active=false, ended_at IS NOT NULL                → 已结束

-- 验证（可选）
-- SELECT id, program_id, is_active, paused_at, ended_at
-- FROM public.user_programs
-- ORDER BY updated_at DESC
-- LIMIT 10;
