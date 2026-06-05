import { supabase } from '../supabaseClient';

/**
 * 获取用户的身高画像
 */
export const fetchUserHeight = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('height_cm')
    .limit(1);

  if (error) throw error;
  return data?.[0]?.height_cm || null;
};

/**
 * 获取特定日期的身体记录
 * @param {string} date - YYYY-MM-DD
 */
export const fetchBodyMetrics = async (date) => {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * 保存或更新特定日期的身体数据记录
 * @param {Object} entry - 身体状态记录 payload
 */
export const saveBodyMetrics = async (entry) => {
  const { error } = await supabase
    .from('body_metrics')
    .upsert(entry, { onConflict: 'date' });

  if (error) throw error;
};

/**
 * 物理删除特定的身体数据记录
 * @param {number} id - 记录的自增主键 ID
 */
export const deleteBodyMetrics = async (id) => {
  const { error } = await supabase
    .from('body_metrics')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

/**
 * 获取全量身体状态历史记录 (按日期降序)
 */
export const fetchHistoryBodyMetrics = async () => {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
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
  const { error } = await supabase
    .from('body_metrics')
    .insert(array);

  if (error) throw error;
};
