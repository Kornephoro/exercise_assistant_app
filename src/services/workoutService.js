import { supabase, requireCurrentUserId, withUserIdPayload } from '../supabaseClient';

/**
 * 获取特定计划自起止日期后的所有历史记录
 * @param {number} programId
 * @param {string} sinceDate - ISO Date String
 */
export const fetchProgramWorkoutsHistory = async (programId, sinceDate) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 获取特定日期（今日）打卡汇总
 * @param {string} todayStartISO - ISO Date String
 */
export const fetchTodayWorkouts = async (todayStartISO) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', todayStartISO)
    .order('created_at');

  if (error) throw error;
  return data || [];
};

/**
 * 保存单个/多个打卡动作记录
 * @param {Array<Object>|Object} workoutRecords
 */
export const saveWorkout = async (workoutRecords) => {
  const userId = await requireCurrentUserId();
  const payload = withUserIdPayload(Array.isArray(workoutRecords) ? workoutRecords : [workoutRecords], userId);
  const { data, error } = await supabase
    .from('workouts')
    .insert(payload)
    .select('id, exercise, tier');

  if (error) throw error;
  return data || [];
};

/**
 * 批量保存打卡动作的训练组记录
 * @param {Array<Object>} setsToInsert
 */
export const saveWorkoutSets = async (setsToInsert) => {
  if (!setsToInsert || setsToInsert.length === 0) return;

  const userId = await requireCurrentUserId();
  const payload = withUserIdPayload(setsToInsert, userId);
  const { error } = await supabase
    .from('workout_sets')
    .insert(payload);

  if (error) throw error;
};

/**
 * 查询指定主项当前最新的 1RM 纪录（常用于自动测算过滤）
 * @param {Array<string>} exercises
 */
export const fetchLatestOneRmForExercises = async (exercises) => {
  if (!exercises || exercises.length === 0) return [];

  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('one_rm_records')
    .select('exercise, e1rm_kg, date, source')
    .eq('user_id', userId)
    .in('exercise', exercises)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * 批量插入 1RM 纪录 (用于训练自动推算写入)
 * @param {Array<Object>} rows
 */
export const saveOneRmRecords = async (rows) => {
  if (!rows || rows.length === 0) return;

  const userId = await requireCurrentUserId();
  const payload = withUserIdPayload(rows, userId);
  const { error } = await supabase
    .from('one_rm_records')
    .insert(payload);

  if (error) throw error;
};

/**
 * 事务化完成一次训练保存。数据库函数负责写入 workouts、workout_sets、
 * one_rm_records，并推进 user_programs.program_state。
 * @param {Object} payload
 */
export const completeWorkoutSession = async (payload) => {
  await requireCurrentUserId();
  const { data, error } = await supabase.rpc('complete_workout_session', { payload });

  if (error) throw error;
  return data;
};

/**
 * 日历按月拉取训练打卡日期
 * @param {string} startDate - ISO Date String
 * @param {string} endDate - ISO Date String
 */
export const fetchWorkoutsForMonth = async (startDate, endDate) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workouts')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .lt('created_at', endDate);

  if (error) throw error;
  return data || [];
};

/**
 * 日历按日拉取训练动作详情
 * @param {string} dayStart - ISO Date String
 * @param {string} dayEnd - ISO Date String
 */
export const fetchWorkoutsForDay = async (dayStart, dayEnd) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 拉取 1RM 的完整历史纪录列表
 */
export const fetchOneRmHistory = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('one_rm_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * 手动新增一条 1RM 纪录
 * @param {Object} record
 */
export const saveOneRmRecord = async (record) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('one_rm_records')
    .insert([withUserIdPayload(record, userId)])
    .select();

  if (error) throw error;
  return data;
};

/**
 * 物理删除一条指定的 1RM 纪录（仅允许删除本人的）
 * @param {number} id
 */
export const deleteOneRmRecord = async (id) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('one_rm_records')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};
