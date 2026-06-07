import { supabase, getCurrentUserId, withUserId, withUserIdPayload } from '../supabaseClient';

/**
 * 获取特定日期的饮食对账记录
 * @param {string} date - YYYY-MM-DD
 */
export const fetchDietLog = async (date) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('diet_logs')
    .select('*')
    
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
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('diet_logs')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'date, user_id' });

  if (error) throw error;
};

/**
 * 物理删除特定日期的饮食对账记录（仅允许删除本人的）
 * @param {string} date - YYYY-MM-DD
 */
export const deleteDietLog = async (date) => {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('diet_logs')
    .delete()
    
    .eq('date', date);

  if (error) throw error;
};

/**
 * 获取最近几天的历史饮食对账单记录
 * @param {number} limit
 */
export const fetchHistoryDietLogs = async (limit = 7) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('diet_logs')
    .select('*')
    
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * 保存并激活新的饮食配置方案 (会将其他活跃方案置为未激活)
 * @param {Object} config - 饮食配置 payload
 */
export const saveUserNutritionConfig = async (config) => {
  const userId = await getCurrentUserId();

  // 1. 获取当前活跃配置的 ID，如果更新失败可以进行回退
  const { data: activeConfigs, error: queryErr } = await supabase
    .from('user_nutrition_configs')
    .select('id')
    
    .eq('is_active', true);
  if (queryErr) throw queryErr;

  const activeIds = (activeConfigs || []).map(c => c.id);

  // 2. 将原先的激活方案设为不激活
  if (activeIds.length > 0) {
    const { error: deactivateErr } = await supabase
      .from('user_nutrition_configs')
      .update({ is_active: false })
      
      .in('id', activeIds);
    if (deactivateErr) throw deactivateErr;
  }

  // 3. 插入新的激活配置
  const { error: insertErr } = await supabase
    .from('user_nutrition_configs')
    .insert([{
      ...config,
      user_id: userId,
      is_active: true
    }]);

  // 4. 如果插入新方案失败，则回滚：恢复之前的激活状态
  if (insertErr) {
    if (activeIds.length > 0) {
      const { error: rollbackErr } = await supabase
        .from('user_nutrition_configs')
        .update({ is_active: true })
        
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
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('user_nutrition_configs')
    .select('*')
    
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};
