-- ============================================
-- 健身房全器械配重配置字段扩展脚本
-- 在 Supabase SQL Editor 中运行此脚本
-- 运行后可以在用户的个人画像（user_profiles）中存储和同步杠铃、哑铃、龙门架等可用配片规则
-- ============================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gym_equipment_config JSONB;

-- 验证列是否添加成功（可选）
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_profiles' AND column_name = 'gym_equipment_config';
