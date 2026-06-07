import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 获取当前认证用户的 ID（应用层数据隔离必需）
 * 若未登录则返回 null，由调用方根据场景决定是静默跳过还是提示登录
 * @returns {Promise<string|null>} 当前用户的 UUID，或 null
 */
export async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

/**
 * 条件性添加 user_id 过滤：若已认证则添加 .eq('user_id', userId) 提供应用层隔离，
 * 若未认证则跳过（回退到 RLS 或允许匿名访问）。
 * @param {Object} query - Supabase query builder
 * @param {string|null} userId
 * @returns {Object} query builder (with or without user_id filter)
 */
export function withUserId(query, userId) {
  return userId ? query.eq('user_id', userId) : query;
}

/**
 * 条件性附加 user_id 到 payload：若已认证则注入，否则保持原样。
 * @param {Object|Array} payload
 * @param {string|null} userId
 * @returns {Object|Array}
 */
export function withUserIdPayload(payload, userId) {
  if (!userId) return payload;
  if (Array.isArray(payload)) return payload.map(r => ({ ...r, user_id: userId }));
  return { ...payload, user_id: userId };
}
