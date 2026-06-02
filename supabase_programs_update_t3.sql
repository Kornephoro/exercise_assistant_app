-- ============================================
-- 训练计划体系 — 第四步：更新种子数据
-- 将 GZCLP 的 T3 动作改为空数组，由用户在配置页面选择
-- ============================================

-- 更新 GZCLP 计划的 day_map，将 T3 改为空数组
UPDATE public.programs
SET config = jsonb_set(
  config,
  '{day_map}',
  '{
    "Day1": { "T1": "squat", "T2": "bench", "T3": [] },
    "Day2": { "T1": "deadlift", "T2": "press", "T3": [] },
    "Day3": { "T1": "bench", "T2": "squat", "T3": [] },
    "Day4": { "T1": "press", "T2": "deadlift", "T3": [] }
  }'::jsonb
)
WHERE slug = 'gzclp';

-- 验证更新结果
SELECT id, name, slug, config->'day_map'->'Day1'->'T3' as day1_t3 FROM programs WHERE slug = 'gzclp';
