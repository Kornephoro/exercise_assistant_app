import { supabase, requireCurrentUserId } from '../supabaseClient';

/**
 * 拉取用户的基础画像配置
 */
export const fetchUserProfile = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

/**
 * 保存或更新用户的基础画像配置
 * - 使用 upsert + onConflict: 'user_id' 消除 TOCTOU 竞态：
 *   两个并发调用将原子性地 upsert 到同一 user_id 行，不会创建重复记录。
 * @param {Object} profileData
 */
export const saveUserProfile = async (profileData) => {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ ...profileData, user_id: userId }, { onConflict: 'user_id' });

  if (error) throw error;
};
