import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let ensureUserPromise = null;

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
 * 确保应用有一个 Supabase Auth 用户。
 * 当前产品还没有显式登录系统，因此优先使用匿名登录提供 auth.uid()
 * 给 RLS 和 user_id 隔离使用。匿名登录需要在 Supabase Auth 设置中启用。
 * @returns {Promise<string>} 当前用户 UUID
 */
export async function ensureAppUser() {
  if (ensureUserPromise) return ensureUserPromise;

  ensureUserPromise = (async () => {
    const existingUserId = await getCurrentUserId();
    if (existingUserId) return existingUserId;

    if (typeof supabase.auth.signInAnonymously !== 'function') {
      throw new Error('当前 Supabase SDK 不支持匿名登录，请先接入正式登录系统。');
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(`无法创建匿名用户：${error.message}。请在 Supabase Authentication 设置中启用匿名登录。`);
    }

    const userId = data?.user?.id || data?.session?.user?.id;
    if (!userId) {
      throw new Error('匿名登录成功但未返回用户 ID，请检查 Supabase Auth 配置。');
    }
    return userId;
  })();

  try {
    return await ensureUserPromise;
  } finally {
    ensureUserPromise = null;
  }
}

/**
 * 获取当前认证用户的 ID。用户私有数据访问必须使用该方法，
 * 避免在未登录时回退到匿名读写。
 * @returns {Promise<string>} 当前用户 UUID
 */
export async function requireCurrentUserId() {
  const userId = await ensureAppUser();
  if (!userId) {
    throw new Error('请先登录后再同步个人数据');
  }
  return userId;
}

/**
 * 添加 user_id 过滤。调用方必须传入已认证 userId。
 * @param {Object} query - Supabase query builder
 * @param {string} userId
 * @returns {Object} query builder
 */
export function withUserId(query, userId) {
  if (!userId) throw new Error('缺少用户身份，无法访问个人数据');
  return query.eq('user_id', userId);
}

/**
 * 附加 user_id 到 payload。调用方必须传入已认证 userId。
 * @param {Object|Array} payload
 * @param {string} userId
 * @returns {Object|Array}
 */
export function withUserIdPayload(payload, userId) {
  if (!userId) throw new Error('缺少用户身份，无法写入个人数据');
  if (Array.isArray(payload)) return payload.map(r => ({ ...r, user_id: userId }));
  return { ...payload, user_id: userId };
}
