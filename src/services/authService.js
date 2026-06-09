import { supabase, getCurrentSessionUser } from '../supabaseClient';

// ==================== 认证状态查询 ====================

/**
 * 获取当前认证状态摘要
 * @returns {{ userId: string|null, email: string|null, isAnonymous: boolean, provider: string|null }}
 */
export async function getAuthState() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return { userId: null, email: null, isAnonymous: true, provider: null };
  }
  return {
    userId: user.id,
    email: user.email || null,
    isAnonymous: user.is_anonymous || false,
    provider: user.app_metadata?.provider || null,
  };
}

/**
 * 监听认证状态变化
 * @param {(state: { userId: string|null, email: string|null, isAnonymous: boolean }) => void} callback
 * @returns {Object} subscription (调用 .unsubscribe() 取消)
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      const user = session?.user;
      callback({
        userId: user?.id || null,
        email: user?.email || null,
        isAnonymous: user ? (user.is_anonymous || false) : true,
      });
    }
  );
  return subscription;
}

// ==================== 邮箱/密码注册与登录 ====================

/**
 * 邮箱注册（新建正式账号）
 * @returns {{ user, session }}
 */
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * 邮箱登录
 * @returns {{ user, session }}
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ==================== 匿名升级为正式账号 ====================

/**
 * 将当前匿名用户升级为邮箱正式用户。
 * 关键：调用 updateUser 为当前匿名 session 绑定 email+password，
 * auth.users.id 保持不变，所有现有 user_id 数据自然保留。
 *
 * 前置条件：当前用户必须是匿名登录状态。
 *
 * @returns {{ user }}
 */
export async function upgradeAnonymousWithEmail(email, password) {
  // 验证当前是匿名用户
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) {
    throw new Error('当前无登录会话，无法升级');
  }
  if (!currentUser.is_anonymous) {
    throw new Error('当前已是正式账号，无需升级');
  }

  // updateUser 为匿名用户添加 email identity
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;

  return data;
}

// ==================== OAuth 预留 ====================

/**
 * Google OAuth 登录
 * 如果当前是匿名用户，使用 linkIdentity 绑定 Google
 */
export async function signInWithGoogle() {
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (currentUser?.is_anonymous) {
    // 匿名用户：使用 linkIdentity 绑定 Google provider
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
    });
    if (error) throw error;
    return data;
  }

  // 非匿名或无会话：标准 OAuth 登录
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/#me`,
    },
  });
  if (error) throw error;
  return data;
}

// ==================== 登出 ====================

/**
 * 登出当前用户。
 * 登出后需要调用方决定是重新创建匿名用户还是停留在未登录状态。
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ==================== 工具 ====================

/**
 * 判断邮箱是否已被注册
 * @returns {boolean}
 */
export async function isEmailRegistered(email) {
  // 尝试用该邮箱登录（空密码会直接失败），通过错误信息判断
  try {
    await supabase.auth.signInWithPassword({ email, password: '__probe__' });
    return false; // 不会走到这里
  } catch (err) {
    const msg = err?.message || '';
    // "Invalid login credentials" 意味着用户存在但密码错误 → 已注册
    // "Email not confirmed" 意味着用户注册了但邮箱未验证
    return msg.includes('Invalid login credentials') || msg.includes('Email not confirmed');
  }
}
