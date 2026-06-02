-- ============================================
-- 训练计划体系 — 第二步：数据迁移
-- 在运行 supabase_programs_v1.sql 之后执行此脚本
-- 将现有 GZCLP 用户数据迁移到新表结构
-- ============================================

-- 1. 为现有用户创建 GZCLP user_programs 记录
-- 假设只有一个用户（当前 app 是单用户模式）
-- 从最后一个 workout 推断当前训练日，从旧配置表读取自定义设置

DO $$
DECLARE
  gzclp_id BIGINT;
  last_day TEXT;
  user_program_id BIGINT;
  exercise_config_json JSONB := '{}';
  rec RECORD;
BEGIN
  -- 获取 GZCLP program id
  SELECT id INTO gzclp_id FROM public.programs WHERE slug = 'gzclp';
  
  IF gzclp_id IS NULL THEN
    RAISE EXCEPTION 'GZCLP program not found in programs table';
  END IF;

  -- 从最后一个 workout 推断当前训练日
  SELECT training_day INTO last_day
  FROM public.workouts
  ORDER BY created_at DESC
  LIMIT 1;

  -- 如果有训练记录，用 getNextDay 逻辑推断下一个训练日
  IF last_day IS NOT NULL THEN
    CASE last_day
      WHEN 'Day1' THEN last_day := 'Day2';
      WHEN 'Day2' THEN last_day := 'Day3';
      WHEN 'Day3' THEN last_day := 'Day4';
      WHEN 'Day4' THEN last_day := 'Day1';
      ELSE last_day := 'Day1';
    END CASE;
  ELSE
    last_day := 'Day1';
  END IF;

  -- 从 user_settings 读取自定义初始重量
  FOR rec IN SELECT exercise, initial_weight FROM public.user_settings
  LOOP
    exercise_config_json := jsonb_set(
      exercise_config_json,
      ARRAY[rec.exercise],
      jsonb_build_object('initial_weight', rec.initial_weight)
    );
  END LOOP;

  -- 从 exercise_progression_settings 读取自定义步长和门槛
  FOR rec IN SELECT exercise, tier, increment, target_reps FROM public.exercise_progression_settings
  LOOP
    IF rec.target_reps IS NOT NULL THEN
      exercise_config_json := jsonb_set(
        exercise_config_json,
        ARRAY[rec.exercise],
        (exercise_config_json->rec.exercise) || jsonb_build_object(
          'increment_' || lower(rec.tier), rec.increment,
          'target_reps', rec.target_reps
        )
      );
    ELSE
      exercise_config_json := jsonb_set(
        exercise_config_json,
        ARRAY[rec.exercise],
        (exercise_config_json->rec.exercise) || jsonb_build_object(
          'increment_' || lower(rec.tier), rec.increment
        )
      );
    END IF;
  END LOOP;

  -- 创建 user_programs 记录
  INSERT INTO public.user_programs (program_id, is_active, program_state, exercise_config)
  VALUES (
    gzclp_id,
    true,
    jsonb_build_object('current_day', last_day, 'scheme_index', '{}'::jsonb),
    exercise_config_json
  )
  RETURNING id INTO user_program_id;

  -- 给现有 workouts 打 program_id
  UPDATE public.workouts SET program_id = gzclp_id WHERE program_id IS NULL;

  RAISE NOTICE 'Migration complete. user_programs.id = %, exercise_config = %', user_program_id, exercise_config_json;
END $$;
