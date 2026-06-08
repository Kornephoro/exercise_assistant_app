import { supabase, requireCurrentUserId, withUserIdPayload } from '../supabaseClient';

/**
 * 获取用户的身高画像
 */
export const fetchUserHeight = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('height_cm')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.height_cm || null;
};

/**
 * 获取特定日期的身体记录
 * @param {string} date - YYYY-MM-DD
 */
export const fetchBodyMetrics = async (date) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * 保存或更新特定日期的身体数据记录
 * - onConflict: ['date', 'user_id'] 确保同用户同日期唯一，不会覆盖其他用户
 * @param {Object} entry - 身体状态记录 payload
 */
export const saveBodyMetrics = async (entry) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('body_metrics')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'date,user_id' });

  if (error) throw error;
};

/**
 * 物理删除特定的身体数据记录（仅允许删除本人的）
 * @param {number} id - 记录的自增主键 ID
 */
export const deleteBodyMetrics = async (id) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('body_metrics')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * 获取全量身体状态历史记录 (按日期降序)
 */
export const fetchHistoryBodyMetrics = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(365);

  if (error) throw error;
  return data || [];
};

/**
 * 批量插入身体指标记录 (通常用于本地数据迁移)
 * @param {Array} array
 */
export const bulkInsertBodyMetrics = async (array) => {
  const userId = await requireCurrentUserId();
  const payload = withUserIdPayload(array, userId);
  const { error } = await supabase
    .from('body_metrics')
    .insert(payload);

  if (error) throw error;
};
