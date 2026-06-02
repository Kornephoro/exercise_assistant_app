-- ============================================
-- 训练计划体系 — 第三步：清理旧表
-- 警告：请在确认迁移数据正确后才执行此脚本
-- 执行后 user_settings 和 exercise_progression_settings 将被永久删除
-- ============================================

DROP TABLE IF EXISTS public.user_settings;
DROP TABLE IF EXISTS public.exercise_progression_settings;
