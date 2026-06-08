import { supabase, requireCurrentUserId } from '../supabaseClient';

/**
 * 获取特定日期的饮食对账记录
 * @param {string} date - YYYY-MM-DD
 */
export const fetchDietLog = async (date) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('diet_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * 保存或更新特定日期的饮食对账记录
 * - onConflict: ['date', 'user_id'] 确保同用户同日期唯一
 * @param {Object} entry - 饮食对账记录 payload
 */
export const saveDietLog = async (entry) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('diet_logs')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'date,user_id' });

  if (error) throw error;
};

/**
 * 物理删除特定日期的饮食对账记录（仅允许删除本人的）
 * @param {string} date - YYYY-MM-DD
 */
export const deleteDietLog = async (date) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('diet_logs')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);

  if (error) throw error;
};

/**
 * 获取最近几天的历史饮食对账单记录
 * @param {number} limit
 */
export const fetchHistoryDietLogs = async (limit = 7) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('diet_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * 保存并激活新的饮食配置方案 (会将自己的其他活跃方案置为未激活)
 * @param {Object} config - 饮食配置 payload
 */
export const saveUserNutritionConfig = async (config) => {
  const userId = await requireCurrentUserId();

  const { data: activeConfigs, error: queryErr } = await supabase
    .from('user_nutrition_configs')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (queryErr) throw queryErr;

  const activeIds = (activeConfigs || []).map(c => c.id);

  if (activeIds.length > 0) {
    const { error: deactivateErr } = await supabase
      .from('user_nutrition_configs')
      .update({ is_active: false })
      .eq('user_id', userId)
      .in('id', activeIds);
    if (deactivateErr) throw deactivateErr;
  }

  const { error: insertErr } = await supabase
    .from('user_nutrition_configs')
    .insert([{
      ...config,
      user_id: userId,
      is_active: true
    }]);

  if (insertErr) {
    if (activeIds.length > 0) {
      const { error: rollbackErr } = await supabase
        .from('user_nutrition_configs')
        .update({ is_active: true })
        .eq('user_id', userId)
        .in('id', activeIds);
      if (rollbackErr) {
        console.error('饮食配置回滚失败，系统可能处于无活跃配置状态:', rollbackErr);
      }
    }
    throw insertErr;
  }
};

/**
 * 获取当前活跃的饮食目标配置方案
 */
export const fetchActiveUserNutritionConfig = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_nutrition_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};
