/**
 * 动作名 / 特性标签中文化工具
 *
 * 设计原则：
 * - 数据库 (exercises.name_cn) 是首选数据源
 * - 数据库查不到时，fallback 到这里的硬编码映射
 * - 仍查不到时，开发模式下输出带 🚧 标记的提示，方便补全
 * - 行业通行缩写 (T1/T2/T3, AMRAP) 不动
 */

// 动作 key → 中文 fallback（数据库 exercise_config / workouts 里常用 key 兜底）
export const FALLBACK_CN_NAMES = {
  squat: '深蹲',
  bench: '卧推',
  deadlift: '硬拉',
  press: '推举',
  pullup: '引体向上',
  abdominal: '仰卧起坐',
  bicep_curl: '二头弯举',
  face_pull: '面拉',
  power_clean: '力量翻',
  bent_over_row: '俯身划船',
  overhead_press: '推举',
  dead_hang: '悬垂',
  plank: '平板支撑',
  pushup: '俯卧撑',
  lunge: '弓步',
  squat_jump: '跳箱',
};

// 计划 features 标签 → 中文
export const FEATURE_LABELS = {
  auto_progression: '自动进阶',
  tier_system: 'T1/T2/T3 分层',
  amrap: 'AMRAP',
  linear_periodization: '线性周期',
  linear_progression: '线性进阶',
  ab_rotation: 'A/B 轮转',
  simple: '简单高效',
  auto_regulation: '自适应',
};

// 已告警过的 key，避免控制台刷屏
const warnedKeys = new Set();

/**
 * 获取动作的中文名
 * @param {string} exerciseKey 动作 key（英文 slug）
 * @param {Object} exercisesMap 从 exercises 表映射出来的对象 { [name]: {name, name_cn, ...} }
 * @returns {string} 中文名
 */
export function getCNName(exerciseKey, exercisesMap = {}) {
  if (!exerciseKey) return '未命名动作';

  // 1. 数据库优先
  const fromDb = exercisesMap[exerciseKey]?.name_cn;
  if (fromDb) return fromDb;

  // 2. 硬编码 fallback
  const fromFallback = FALLBACK_CN_NAMES[exerciseKey];
  if (fromFallback) return fromFallback;

  // 3. 开发模式提示：未配置该动作
  if (!warnedKeys.has(exerciseKey)) {
    warnedKeys.add(exerciseKey);
    // eslint-disable-next-line no-console
    console.warn(
      `[exerciseNames] 未找到动作 "${exerciseKey}" 的中文映射。请在 exercises 表的 name_cn 字段或 FALLBACK_CN_NAMES 中补全。`
    );
  }
  return `🚧 ${exerciseKey}`;
}
