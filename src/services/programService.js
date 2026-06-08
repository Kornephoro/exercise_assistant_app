import { supabase, requireCurrentUserId, withUserIdPayload } from '../supabaseClient';

/**
 * 获取某个计划当前活跃的订阅记录
 * @param {number} programId
 */
export const fetchActiveUserProgram = async (programId) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_programs')
    .select('id, exercise_config, schedule, day_map')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('is_active', true)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

/**
 * 获取最近结束的某个计划的订阅记录 (用于配置页面数据回填)
 * 只返回已结束的计划（is_active = false 且 ended_at 不为空），按结束时间降序
 * @param {number} programId
 */
export const fetchLastEndedUserProgram = async (programId) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_programs')
    .select('exercise_config, schedule, day_map')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('is_active', false)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

/**
 * 获取全量系统动作库（系统级表，无需 user_id）
 */
export const fetchExercises = async () => {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, name_cn, category, movement_pattern, primary_muscles, secondary_muscles, equipment, exercise_type, recording_method')
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有的 1RM 纪录 (按日期降序)
 */
export const fetchOneRmRecords = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('one_rm_records')
    .select('exercise, e1rm_kg, date, weight_kg, reps, formula, source')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * 保存或更新用户计划配置
 * @param {number|null} userProgramId - user_programs 表的 ID，如果为 null 则新增，否则更新
 * @param {number} programId - 计划 ID (programs.id)
 * @param {Object} upData - 配置 payload
 */
export const saveUserProgram = async (userProgramId, programId, upData) => {
  const userId = await requireCurrentUserId();
  if (userProgramId) {
    const { data, error } = await supabase
      .from('user_programs')
      .update(upData)
      .eq('id', userProgramId)
      .eq('user_id', userId)
      .select();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('user_programs')
    .insert([{ program_id: programId, ...withUserIdPayload(upData, userId) }])
    .select();
  if (error) throw error;
  return data;
};

/**
 * 获取所有被激活的可选计划（系统级模板表，无需 user_id）
 */
export const fetchActivePrograms = async () => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * 获取用户的所有训练计划记录 (包含历史和当前的)
 */
export const fetchAllUserPrograms = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_programs')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
};

/**
 * 获取全量系统动作，按动作模式和英文名称升序排列（系统级表，无需 user_id）
 */
export const fetchExercisesForLibrary = async () => {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('movement_pattern', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 获取可见训练模板：系统内置模板 + 当前用户自定义模板
 */
export const fetchWorkoutTemplates = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * 保存或更新训练模板
 * @param {Object} template - 模板载荷
 */
export const saveWorkoutTemplate = async (template) => {
  const userId = await requireCurrentUserId();
  const { id, ...templatePayload } = template;

  if (id) {
    const { data, error } = await supabase
      .from('workout_templates')
      .update({ ...templatePayload, user_id: userId })
      .eq('id', id)
      .eq('user_id', userId)
      .select();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('workout_templates')
    .insert([{ ...templatePayload, user_id: userId }])
    .select();
  if (error) throw error;
  return data;
};

/**
 * 删除训练模板（仅允许删除本人的）
 * @param {number} templateId - 模板 ID
 */
export const deleteWorkoutTemplate = async (templateId) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId)
    .select();

  if (error) throw error;
  return data;
};
