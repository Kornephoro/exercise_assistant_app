-- ==========================================================
-- Auth upgrade SQL
-- 总共两步：先跑「第一步」检查，确认全部 0 后再跑「第二步」
-- ==========================================================

-- ==========================================================
-- 第一步：检查 null user_id（只读查询，不会修改任何数据）
-- 把下面从 "select" 到结尾分号全部选中，点击 Run
-- ==========================================================
select 'user_profiles' as tbl, count(*) as nulls from public.user_profiles where user_id is null
union all select 'user_programs', count(*) from public.user_programs where user_id is null
union all select 'workouts', count(*) from public.workouts where user_id is null
union all select 'workout_sets', count(*) from public.workout_sets where user_id is null
union all select 'one_rm_records', count(*) from public.one_rm_records where user_id is null
union all select 'body_metrics', count(*) from public.body_metrics where user_id is null
union all select 'diet_logs', count(*) from public.diet_logs where user_id is null
union all select 'user_nutrition_configs', count(*) from public.user_nutrition_configs where user_id is null
union all select 'workout_templates (此项>0正常)', count(*) from public.workout_templates where user_id is null;

-- ==========================================================
-- 第二步：执行变更（确认第一步全部 0 后，选中下面全部，点击 Run）
-- ==========================================================

-- 2a. 开启 user_id NOT NULL
alter table public.user_profiles alter column user_id set not null;
alter table public.user_programs alter column user_id set not null;
alter table public.workouts alter column user_id set not null;
alter table public.workout_sets alter column user_id set not null;
alter table public.one_rm_records alter column user_id set not null;
alter table public.body_metrics alter column user_id set not null;
alter table public.diet_logs alter column user_id set not null;
alter table public.user_nutrition_configs alter column user_id set not null;

-- 2b. user_profiles 补 email 字段（用于"我的"页面展示绑定邮箱）
alter table public.user_profiles add column if not exists email text;

-- 2c. 唯一索引
create unique index if not exists idx_user_profiles_user_id_unique
  on public.user_profiles (user_id);

drop index if exists idx_user_nutrition_configs_user_active;
create unique index if not exists idx_user_nutrition_configs_user_id_active
  on public.user_nutrition_configs (user_id)
  where user_id is not null and is_active = true;

-- 2d. 刷新 RPC 权限
revoke all on function public.complete_workout_session(jsonb) from public, anon;
grant execute on function public.complete_workout_session(jsonb) to authenticated;
