-- ============================================
-- 饮食配置与对账表 (Diet & Nutrition Manager)
-- 在 Supabase SQL Editor 中运行此脚本以完成部署
-- ============================================

-- 1. 创建用户饮食配置表
CREATE TABLE IF NOT EXISTS public.user_nutrition_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  neat_tef_factor NUMERIC DEFAULT 1.10,
  strength_level TEXT DEFAULT 'beginner' CHECK (strength_level IN ('none','beginner','intermediate','advanced','custom')),
  custom_strength_kcal INT DEFAULT 0,
  cardio_weekly_kcal INT DEFAULT 0,
  deficit_slider NUMERIC DEFAULT 0.80,
  plan_type TEXT DEFAULT 'split' CHECK (plan_type IN ('split','unified')),
  calc_mode TEXT DEFAULT 'ratio' CHECK (calc_mode IN ('ratio','weight_multiple','custom')),
  ratio_carbs INT DEFAULT 50,
  ratio_protein INT DEFAULT 30,
  ratio_fat INT DEFAULT 20,
  multiple_config JSONB DEFAULT '{
    "strength_day": {"carbs": 3.0, "protein": 2.0, "fat": 0.8},
    "rest_day": {"carbs": 1.5, "protein": 2.0, "fat": 0.8}
  }'::jsonb,
  custom_config JSONB DEFAULT '{
    "strength_day": {"carbs": 250, "protein": 140, "fat": 60},
    "rest_day": {"carbs": 180, "protein": 140, "fat": 50}
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 每个用户只能有一个活跃配置 (兼容 user_id 为 NULL 的沙盒化场景)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_nutrition_configs_active 
  ON public.user_nutrition_configs (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  WHERE (is_active = true);

-- 启用行级安全 (RLS)
ALTER TABLE public.user_nutrition_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_public_select" ON public.user_nutrition_configs;
CREATE POLICY "allow_public_select" ON public.user_nutrition_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_public_insert" ON public.user_nutrition_configs;
CREATE POLICY "allow_public_insert" ON public.user_nutrition_configs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_update" ON public.user_nutrition_configs;
CREATE POLICY "allow_public_update" ON public.user_nutrition_configs FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_delete" ON public.user_nutrition_configs;
CREATE POLICY "allow_public_delete" ON public.user_nutrition_configs FOR DELETE USING (true);


-- 2. 创建每日饮食对账表
CREATE TABLE IF NOT EXISTS public.diet_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  date DATE NOT NULL,
  day_type TEXT NOT NULL DEFAULT 'strength_day' CHECK (day_type IN ('strength_day','rest_day')),
  entry_mode TEXT NOT NULL DEFAULT 'grams' CHECK (entry_mode IN ('grams','ratio')),
  actual_carbs_g NUMERIC DEFAULT 0,
  actual_protein_g NUMERIC DEFAULT 0,
  actual_fat_g NUMERIC DEFAULT 0,
  actual_calories NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 日期唯一约束索引 (限制每个用户每天只有一条对账日记)
CREATE UNIQUE INDEX IF NOT EXISTS idx_diet_logs_user_date 
  ON public.diet_logs (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

-- 启用行级安全 (RLS)
ALTER TABLE public.diet_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_public_select" ON public.diet_logs;
CREATE POLICY "allow_public_select" ON public.diet_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_public_insert" ON public.diet_logs;
CREATE POLICY "allow_public_insert" ON public.diet_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_update" ON public.diet_logs;
CREATE POLICY "allow_public_update" ON public.diet_logs FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_delete" ON public.diet_logs;
CREATE POLICY "allow_public_delete" ON public.diet_logs FOR DELETE USING (true);
