import { supabase } from '../supabaseClient';

/**
 * 拉取用户的基础画像配置
 */
export const fetchUserProfile = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

/**
 * 保存或更新用户的基础画像配置
 * @param {Object} profileData
 */
export const saveUserProfile = async (profileData) => {
  // 1. 查找是否存在已建档记录
  const { data: existing, error: queryError } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1);

  if (queryError) throw queryError;

  if (existing && existing.length > 0) {
    // 2. 存在则执行 update
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(profileData)
      .eq('id', existing[0].id);
    if (updateError) throw updateError;
  } else {
    // 3. 不存在则执行 insert
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert([profileData]);
    if (insertError) throw insertError;
  }
};
