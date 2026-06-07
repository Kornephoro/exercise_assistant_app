import { supabase } from '../supabaseClient';

/**
 * 获取某个计划当前活跃的订阅记录
 * @param {number} programId
 */
export const fetchActiveUserProgram = async (programId) => {
  const { data, error } = await supabase
    .from('user_programs')
    .select('id, exercise_config, schedule, day_map')
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
  const { data, error } = await supabase
    .from('user_programs')
    .select('exercise_config, schedule, day_map')
    .eq('program_id', programId)
    .eq('is_active', false)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

/**
 * 获取全量系统动作库
 */
export const fetchExercises = async () => {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, name_cn, primary_muscles, secondary_muscles, equipment, exercise_type, recording_method')
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有的 1RM 纪录 (按日期降序)
 */
export const fetchOneRmRecords = async () => {
  const { data, error } = await supabase
    .from('one_rm_records')
    .select('exercise, e1rm_kg, date, weight_kg, reps, formula, source')
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
  if (userProgramId) {
    const { data, error } = await supabase
      .from('user_programs')
      .update(upData)
      .eq('id', userProgramId);
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('user_programs')
      .insert([{ program_id: programId, ...upData }]);
    if (error) throw error;
    return data;
  }
};

/**
 * 获取所有被激活的可选计划
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
  const { data, error } = await supabase
    .from('user_programs')
    .select('*');

  if (error) throw error;
  return data || [];
};

/**
 * 获取全量系统动作，按动作模式和英文名称升序排列（用于动作库展示）
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
 * 获取全量训练模板
 */
export const fetchWorkoutTemplates = async () => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * 保存或更新训练模板
 * @param {Object} template - 模板载荷
 */
export const saveWorkoutTemplate = async (template) => {
  if (template.id) {
    const { data, error } = await supabase
      .from('workout_templates')
      .update(template)
      .eq('id', template.id);
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('workout_templates')
      .insert([template]);
    if (error) throw error;
    return data;
  }
};

/**
 * 删除训练模板
 * @param {number} templateId - 模板 ID
 */
export const deleteWorkoutTemplate = async (templateId) => {
  const { data, error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;
  return data;
};
