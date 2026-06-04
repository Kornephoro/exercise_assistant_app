-- ============================================
-- 身体数据记录表 (Body Metrics)
-- 在 Supabase SQL Editor 中运行此脚本以完成部署
-- ============================================

CREATE TABLE IF NOT EXISTS public.body_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  waist_cm NUMERIC,
  heart_rate INT,
  sleep_hours NUMERIC,
  fatigue_rating INT CHECK (fatigue_rating BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建唯一约束索引，确保单个用户在同一天内只有一条记录
-- 兼容 user_id 为 NULL 的沙盒化使用场景
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_metrics_user_date 
  ON public.body_metrics (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

-- 启用行级安全政策 (RLS)
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- 允许公用访问，适配前端直连沙盒架构
DROP POLICY IF EXISTS "allow_public_select" ON public.body_metrics;
CREATE POLICY "allow_public_select" ON public.body_metrics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_public_insert" ON public.body_metrics;
CREATE POLICY "allow_public_insert" ON public.body_metrics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_update" ON public.body_metrics;
CREATE POLICY "allow_public_update" ON public.body_metrics
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_delete" ON public.body_metrics;
CREATE POLICY "allow_public_delete" ON public.body_metrics
  FOR DELETE USING (true);
