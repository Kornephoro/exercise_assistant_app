-- ==========================================================
-- GZCLP 热身、拉伸与模板库数据表及种子数据搭建 (已根据用户反馈更新)
-- 在 Supabase SQL Editor 中运行此脚本
-- ==========================================================

-- 1. 给 exercises 表新增 exercise_type（动作流派/类别）字段，默认为 'strength' (力量训练)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'strength';

-- 确保已有的动作不会为空，全部归入 'strength'
UPDATE public.exercises 
  SET exercise_type = 'strength' 
  WHERE exercise_type IS NULL OR exercise_type = '';

-- 2. 给 workout_sets 表新增 is_warmup 标记字段（区分热身组与工作组）
ALTER TABLE public.workout_sets
  ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN NOT NULL DEFAULT false;

-- 3. 创建 workout_templates 表（模板库）
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'warmup' (热身), 'stretching' (拉伸), 'custom' (自定义)
  target_body_parts TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb, -- 包含动作英文 slug、组数、次数/时长、记录模式等
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
CREATE POLICY "allow_public_select" ON public.workout_templates FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON public.workout_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON public.workout_templates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_public_delete" ON public.workout_templates FOR DELETE USING (true);

-- 4. 插入拉伸、动物流与激活相关动作数据到动作库 (区分静态/动态，且拆分为独立动作)
-- 静态版本: duration_only (仅记录时长)
-- 动态/弹振版本: reps_only (仅记录次数)
INSERT INTO public.exercises (name, name_cn, equipment, movement_pattern, recording_method, primary_muscles, secondary_muscles, exercise_type) VALUES
  -- 静态拉伸 (Stretching - duration_only)
  ('child_pose', '婴儿式拉伸', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['背阔肌', '中上斜方肌', '臀部肌群'], ARRAY['颈部肌群'], 'stretching'),
  ('hamstring_stretch_static', '腘绳肌拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['腘绳肌'], ARRAY['臀部肌群', '小腿肌群'], 'stretching'),
  ('quadriceps_stretch_static', '股四头肌拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['股四头肌'], ARRAY['髂胫束'], 'stretching'),
  ('chest_stretch_static', '胸肌拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['胸肌'], ARRAY['三角肌前束'], 'stretching'),
  ('shoulder_stretch_static', '三角肌拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['三角肌'], ARRAY['中上斜方肌'], 'stretching'),
  ('glute_stretch_static', '臀部拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['臀部肌群'], ARRAY['腘绳肌'], 'stretching'),
  ('calf_stretch_static', '小腿拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['小腿肌群'], ARRAY['腘绳肌'], 'stretching'),
  ('hip_flexor_stretch', '髂腰肌拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['臀部肌群'], ARRAY['股四头肌'], 'stretching'),
  ('cobra_stretch', '眼镜蛇式拉伸 (静态)', ARRAY['bodyweight'], NULL, 'duration_only', ARRAY['腹肌'], ARRAY['胸肌', '三角肌'], 'stretching'),
  
  -- 动态/弹振拉伸 (Stretching - reps_only)
  ('hamstring_stretch_dynamic', '腘绳肌拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['腘绳肌'], ARRAY['臀部肌群', '小腿肌群'], 'stretching'),
  ('quadriceps_stretch_dynamic', '股四头肌拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['股四头肌'], ARRAY['髂胫束'], 'stretching'),
  ('chest_stretch_dynamic', '胸肌拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['胸肌'], ARRAY['三角肌前束'], 'stretching'),
  ('shoulder_stretch_dynamic', '三角肌拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['三角肌'], ARRAY['中上斜方肌'], 'stretching'),
  ('glute_stretch_dynamic', '臀部拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['臀部肌群'], ARRAY['腘绳肌'], 'stretching'),
  ('calf_stretch_dynamic', '小腿拉伸 (动态弹振)', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['小腿肌群'], ARRAY['腘绳肌'], 'stretching'),

  -- 泡沫轴/筋膜放松 (Myofascial Release - duration_only)
  ('foam_roller_back', '泡沫轴滚背', ARRAY['foam_roller'], NULL, 'duration_only', ARRAY['背阔肌', '中上斜方肌', '菱形肌'], ARRAY['三角肌后束'], 'myofascial_release'),
  
  -- 动态关节活动/激活 (Mobility - reps_only)
  ('cat_cow', '猫狗式', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['中上斜方肌', '竖脊肌'], ARRAY['背阔肌', '腹肌'], 'mobility'),
  ('world_greatest_stretch', '世界上最伟大的拉伸', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['臀部肌群', '腘绳肌', '胸肌'], ARRAY['背阔肌', '腹肌', '三角肌'], 'mobility'),
  ('arm_circles', '手臂绕环', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['三角肌'], ARRAY['肩袖肌群'], 'mobility'),
  ('glute_bridge', '臀桥', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['臀部肌群', '臀大肌'], ARRAY['腘绳肌', '腹肌'], 'mobility'),
  ('bodyweight_squat', '自重深蹲', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['股四头肌', '臀大肌'], ARRAY['腘绳肌', '小腿肌群'], 'mobility'),
  ('lateral_cossack_squat', '哥萨克蹲', ARRAY['bodyweight'], NULL, 'reps_only', ARRAY['内收肌群', '股四头肌'], ARRAY['臀大肌', '腘绳肌'], 'mobility'),
  
  -- 动物流动作 (Animal Flow - 独立流派)
  ('beast_crawl', '兽姿爬行', ARRAY['bodyweight'], '核心与整合', 'duration_only', ARRAY['腹肌', '肩袖肌群', '股四头肌'], ARRAY['三角肌', '侧腹'], 'animal_flow'),
  ('crab_reach', '蟹姿伸展', ARRAY['bodyweight'], '核心与整合', 'reps_only', ARRAY['臀大肌', '肩袖肌群', '中上斜方肌'], ARRAY['三角肌后束', '腹肌'], 'animal_flow'),
  ('scorpion_reach', '蝎姿伸展', ARRAY['bodyweight'], '核心与整合', 'reps_only', ARRAY['臀部肌群', '腹肌', '肩袖肌群'], ARRAY['腘绳肌', '三角肌'], 'animal_flow'),
  ('under_switch', '兽姿转体', ARRAY['bodyweight'], '核心与整合', 'reps_only', ARRAY['腹肌', '侧腹', '肩袖肌群'], ARRAY['三角肌', '肱三头肌'], 'animal_flow'),
  ('side_traveling_beast', '侧步兽姿', ARRAY['bodyweight'], '核心与整合', 'duration_only', ARRAY['腹肌', '肩袖肌群', '股四头肌'], ARRAY['三角肌', '侧腹'], 'animal_flow')
ON CONFLICT (name) DO NOTHING;

-- 5. 插入系统内置热身与拉伸模板 (更新引用的拉伸动作名)
INSERT INTO public.workout_templates (name, type, target_body_parts, description, exercises) VALUES
  (
    '全身练前热身', 
    'warmup', 
    ARRAY['全身', '肩部', '髋部'], 
    '适合在任何力量训练前进行的全身性关节活动与核心激活。', 
    '[
      {"exercise": "arm_circles", "sets": 2, "reps": 15, "recording_method": "reps_only"},
      {"exercise": "cat_cow", "sets": 2, "reps": 10, "recording_method": "reps_only"},
      {"exercise": "world_greatest_stretch", "sets": 2, "reps": 8, "recording_method": "reps_only"}
    ]'::jsonb
  ),
  (
    '下肢激活热身', 
    'warmup', 
    ARRAY['下肢', '臀部', '膝关节'], 
    '针对深蹲、硬拉等下肢训练日的练前激活，重点活动髋关节和激活臀肌。', 
    '[
      {"exercise": "glute_bridge", "sets": 2, "reps": 12, "recording_method": "reps_only"},
      {"exercise": "bodyweight_squat", "sets": 2, "reps": 10, "recording_method": "reps_only"},
      {"exercise": "lateral_cossack_squat", "sets": 2, "reps": 8, "recording_method": "reps_only"}
    ]'::jsonb
  ),
  (
    '练后全身拉伸', 
    'stretching', 
    ARRAY['全身', '背部', '下肢'], 
    '力量训练后进行的全身静态拉伸，缓解肌肉紧张，促进恢复。', 
    '[
      {"exercise": "child_pose", "sets": 2, "reps": 30, "recording_method": "duration_only"},
      {"exercise": "hamstring_stretch_static", "sets": 2, "reps": 30, "recording_method": "duration_only"},
      {"exercise": "quadriceps_stretch_static", "sets": 2, "reps": 30, "recording_method": "duration_only"},
      {"exercise": "cobra_stretch", "sets": 2, "reps": 30, "recording_method": "duration_only"}
    ]'::jsonb
  ),
  (
    '肩袖与上肢热身', 
    'warmup', 
    ARRAY['上肢', '肩部', '胸部'], 
    '针对卧推、推举等上肢训练日，重点激活肩袖肌群，预防运动损伤。', 
    '[
      {"exercise": "arm_circles", "sets": 2, "reps": 15, "recording_method": "reps_only"},
      {"exercise": "shoulder_stretch_static", "sets": 1, "reps": 30, "recording_method": "duration_only"},
      {"exercise": "chest_stretch_static", "sets": 1, "reps": 30, "recording_method": "duration_only"}
    ]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;
