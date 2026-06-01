-- ============================================
-- 动作库数据库搭建
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 创建枚举类型（幂等，重复运行不报错）
DO $$ BEGIN
  CREATE TYPE movement_pattern AS ENUM (
    '水平推','水平拉','垂直推','垂直拉',
    '蹲','髋铰链','弓步/单腿','核心与整合',
    '抗伸展','抗旋转','旋转','负重行走'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recording_method AS ENUM (
    'standard','reps_only','duration_only',
    'bodyweight_added','bodyweight_assisted'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. 创建肌群参考表
CREATE TABLE IF NOT EXISTS public.muscle_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_name TEXT REFERENCES public.muscle_groups(name),
  display_order INT2 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.muscle_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select" ON public.muscle_groups
  FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON public.muscle_groups
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON public.muscle_groups
  FOR UPDATE USING (true) WITH CHECK (true);

-- 3. 插入肌群种子数据
INSERT INTO public.muscle_groups (name, parent_name, display_order) VALUES
  ('颈部肌群',   NULL, 1),
  ('胸肌',       NULL, 2),
  ('中上斜方肌', NULL, 3),
  ('菱形肌',     NULL, 4),
  ('肩袖肌群',   NULL, 5),
  ('背阔肌',     NULL, 6),
  ('竖脊肌',     NULL, 7),
  ('三角肌',     NULL, 8),
  ('肱二头肌',   NULL, 9),
  ('肱三头肌',   NULL, 10),
  ('小臂肌群',   NULL, 11),
  ('腹肌',       NULL, 12),
  ('侧腹',       NULL, 13),
  ('臀部肌群',   NULL, 14),
  ('内收肌群',   NULL, 15),
  ('股四头肌',   NULL, 16),
  ('髂胫束',     NULL, 17),
  ('腘绳肌',     NULL, 18),
  ('小腿肌群',   NULL, 19),
  ('上胸',   '胸肌', 20),
  ('中下胸', '胸肌', 21),
  ('三角肌前束', '三角肌', 22),
  ('三角肌中束', '三角肌', 23),
  ('三角肌后束', '三角肌', 24),
  ('肱二头肌内侧', '肱二头肌', 25),
  ('肱二头肌外侧', '肱二头肌', 26),
  ('臀大肌', '臀部肌群', 27),
  ('臀中肌', '臀部肌群', 28)
ON CONFLICT (name) DO NOTHING;

-- 4. 扩展 exercises 表（新增动作库字段）
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS movement_pattern movement_pattern,
  ADD COLUMN IF NOT EXISTS recording_method recording_method NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] NOT NULL DEFAULT '{}';
