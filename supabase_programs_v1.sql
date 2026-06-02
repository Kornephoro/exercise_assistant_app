-- ============================================
-- 训练计划体系 — 第一步：创建表 + 种子数据
-- 在 Supabase SQL Editor 中运行此脚本
-- 运行前请确认：programs 和 user_programs 表不存在
-- ============================================

-- 1. 创建 programs 表
CREATE TABLE IF NOT EXISTS public.programs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  difficulty TEXT,
  days_per_week INT2,
  category TEXT,
  features TEXT[],
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select" ON public.programs
  FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON public.programs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON public.programs
  FOR UPDATE USING (true) WITH CHECK (true);

-- 2. 创建 user_programs 表
CREATE TABLE IF NOT EXISTS public.user_programs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  program_id BIGINT NOT NULL REFERENCES public.programs(id),
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  program_state JSONB NOT NULL DEFAULT '{}',
  exercise_config JSONB,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select" ON public.user_programs
  FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON public.user_programs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON public.user_programs
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_public_delete" ON public.user_programs
  FOR DELETE USING (true);

-- 3. workouts 表新增 program_id 列
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES public.programs(id);

CREATE INDEX IF NOT EXISTS idx_workouts_program_exercise
  ON public.workouts(program_id, exercise, tier, created_at);

-- 4. 插入计划种子数据

-- GZCLP
INSERT INTO public.programs (name, slug, description, difficulty, days_per_week, category, features, config) VALUES (
  'GZCLP',
  'gzclp',
  'GZCL 方法论的线性进阶版本。采用 T1/T2/T3 三层结构，适合初学者到中级者的力量训练计划。每次训练包含一个主要动作、一个辅助动作和一个补充动作。',
  'beginner',
  4,
  'strength',
  ARRAY['auto_progression', 'tier_system', 'amrap', 'linear_periodization'],
  '{
    "engine_type": "gzclp",
    "cycle_days": 4,
    "day_map": {
      "Day1": { "T1": "squat", "T2": "bench", "T3": ["pullup"] },
      "Day2": { "T1": "deadlift", "T2": "press", "T3": ["abdominal"] },
      "Day3": { "T1": "bench", "T2": "squat", "T3": ["bicep_curl"] },
      "Day4": { "T1": "press", "T2": "deadlift", "T3": ["face_pull"] }
    },
    "t1_schemes": [
      { "sets": 5, "reps": 3, "amrap_last": true, "fail_to": 1 },
      { "sets": 6, "reps": 2, "amrap_last": true, "fail_to": 2 },
      { "sets": 10, "reps": 1, "amrap_last": true, "fail_to": -1 }
    ],
    "t2_schemes": [
      { "sets": 3, "reps": 10, "amrap_last": true, "success_threshold": 25, "fail_to": 1 },
      { "sets": 3, "reps": 8, "amrap_last": true, "success_threshold": 20, "fail_to": 2 },
      { "sets": 3, "reps": 6, "amrap_last": true, "success_threshold": 15, "fail_to": -1 }
    ],
    "t3_scheme": { "sets": 3, "reps": 15, "amrap_last": true, "success_threshold": 25 },
    "default_increment": { "T1": 2.5, "T2": 2.5, "T3": 2.5 },
    "default_weights": {
      "squat": 40, "bench": 30, "deadlift": 50, "press": 20,
      "pullup": 10, "abdominal": 10, "bicep_curl": 10, "face_pull": 10
    },
    "config_fields": [
      { "key": "initial_weight", "label": "首训默认重量", "type": "weight", "tiers": ["T1","T2","T3"] },
      { "key": "increment", "label": "进阶加重步长", "type": "weight_step", "tiers": ["T1","T2","T3"] },
      { "key": "target_reps", "label": "T3 达标门槛", "type": "reps", "tiers": ["T3"], "default": 25 }
    ]
  }'::jsonb
);

-- Starting Strength（占位）
INSERT INTO public.programs (name, slug, description, difficulty, days_per_week, category, features, config) VALUES (
  'Starting Strength',
  'starting_strength',
  '经典新手线性进阶计划。每周 3 天，A/B 交替训练，专注于深蹲、卧推/推举、硬拉/力量翻的基础力量发展。每次训练只有 3 个动作，简单高效。',
  'beginner',
  3,
  'strength',
  ARRAY['linear_progression', 'ab_rotation', 'simple'],
  '{
    "engine_type": "starting_strength",
    "cycle_length": 2,
    "day_map": {
      "A": [
        { "exercise": "squat", "sets": 3, "reps": 5 },
        { "exercise": "bench", "sets": 3, "reps": 5 },
        { "exercise": "deadlift", "sets": 1, "reps": 5 }
      ],
      "B": [
        { "exercise": "squat", "sets": 3, "reps": 5 },
        { "exercise": "press", "sets": 3, "reps": 5 },
        { "exercise": "power_clean", "sets": 5, "reps": 3 }
      ]
    },
    "default_increment": { "squat": 2.5, "bench": 1.25, "deadlift": 2.5, "press": 1.25, "power_clean": 1.25 },
    "default_weights": { "squat": 40, "bench": 30, "deadlift": 50, "press": 20, "power_clean": 20 },
    "max_fail_attempts": 3,
    "deload_percentage": 10,
    "config_fields": [
      { "key": "initial_weight", "label": "首训默认重量", "type": "weight" },
      { "key": "increment", "label": "进阶加重步长", "type": "weight_step" }
    ],
    "note": "UI 入口占位，进度逻辑待实现"
  }'::jsonb
);
