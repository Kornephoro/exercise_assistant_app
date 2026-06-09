-- ============================================
-- 为 user_profiles 添加 nickname 字段
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 验证列是否添加成功（可选）
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'user_profiles' AND column_name = 'nickname';
