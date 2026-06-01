/**
 * GZCLP 力量训练计划进步算法及配置 (支持自定义初始重量、动作级步长以及 T3 动作扩展)
 */

// 1. 默认初始重量（无历史记录时使用，包含 T1/T2 及 T3 动作）
export const INITIAL_WEIGHTS = {
  // T1 / T2 核心动作
  squat: 40.0,
  bench: 30.0,
  deadlift: 50.0,
  press: 20.0,
  
  // T3 辅助动作
  pullup: 10.0,
  abdominal: 10.0,
  bicep_curl: 10.0,
  face_pull: 10.0
};

// 2. 动作中文名称映射
export const EXERCISE_NAMES_CN = {
  // 核心动作
  squat: '深蹲 (Squat)',
  bench: '卧推 (Bench Press)',
  deadlift: '硬拉 (Deadlift)',
  press: '推举 (Overhead Press)',
  
  // T3 辅助动作
  pullup: '引体向上 (Pull-up)',
  abdominal: '悬垂举腿/腹部 (Abdominal)',
  bicep_curl: '二头肌弯举 (Bicep Curl)',
  face_pull: '面拉 (Face Pull)'
};

// 3. GZCLP 四天循环动作映射 (T1 / T2)
export const DAY_WORKOUT_MAP = {
  Day1: { T1: 'squat', T2: 'bench' },
  Day2: { T1: 'deadlift', T2: 'press' },
  Day3: { T1: 'bench', T2: 'squat' },
  Day4: { T1: 'press', T2: 'deadlift' }
};

// 4. GZCLP 四天循环 T3 动作映射
export const DAY_T3_MAP = {
  Day1: 'pullup',
  Day2: 'abdominal',
  Day3: 'bicep_curl',
  Day4: 'face_pull'
};

/**
 * 根据最后一次训练日获取下一个训练日
 * @param {string|null} lastDay 
 * @returns {string} 
 */
export function getNextDay(lastDay) {
  if (!lastDay) return 'Day1';
  switch (lastDay) {
    case 'Day1': return 'Day2';
    case 'Day2': return 'Day3';
    case 'Day3': return 'Day4';
    case 'Day4': return 'Day1';
    default: return 'Day1';
  }
}

/**
 * 辅助函数：将重量保留一位小数
 */
function roundWeight(weight) {
  return Math.round(weight * 10) / 10;
}

/**
 * 计算 T1 动作的今日训练建议
 * 
 * T1 规则：
 * - 无历史记录：
 *     - 采用 5×3 方案 (planned_reps = 3)
 *     - 重量优先采用用户自定义初始重量，若无则采用默认初始重量
 * - 有历史记录（取最后一条）：
 *     - 若上次 planned_reps 为 3 (5×3)：
 *         - 最后一组完成次数 >= 3 (成功)：重量增加 increment，保持 5×3 (planned_reps = 3)
 *         - 最后一组完成次数 < 3 (失败)：重量不变，降级为 6×2 方案 (planned_reps = 2)
 *     - 若上次 planned_reps 为 2 (6×2)：
 *         - 最后一组完成次数 >= 2 (成功)：重量增加 increment，重置回 5×3 方案 (planned_reps = 3)
 *         - 最后一组完成次数 < 2 (失败)：重量不变，降级为 10×1 方案 (planned_reps = 1)
 *     - 若上次 planned_reps 为 1 (10×1)：
 *         - 无论完成多少个：升级，重量增加 increment，重置回 5×3 方案 (planned_reps = 3)
 * 
 * @param {string} exercise 动作名 ('squat', 'bench', 'deadlift', 'press')
 * @param {Array} history 该动作在该 Tier 的全部历史记录（按时间升序排列）
 * @param {number} [customInitialWeight] 用户自定义初始重量
 * @param {number} [increment=2.5] 用户自定义的进阶加重步长
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
export function getT1Progression(exercise, history, customInitialWeight, increment = 2.5) {
  const defaultWeight = (customInitialWeight !== undefined && customInitialWeight !== null)
    ? Number(customInitialWeight)
    : (INITIAL_WEIGHTS[exercise] || 20.0);

  const step = Number(increment);

  // 1. 无历史记录，使用初始设置：5x3 @ 初始重量
  if (!history || history.length === 0) {
    return {
      weight_kg: defaultWeight,
      planned_reps: 3,
      scheme_text: '5组 × 3次 (最后一组 AMRAP，即尽量多做)'
    };
  }

  // 获取最后一次训练记录
  const lastRecord = history[history.length - 1];
  const lastWeight = Number(lastRecord.weight_kg);
  const lastPlannedReps = Number(lastRecord.planned_reps);
  const lastActualLastSet = Number(lastRecord.actual_last_set_reps);

  let nextWeight = lastWeight;
  let nextPlannedReps = 3;
  let schemeText = '';

  // 2. 根据上次的计划次数与成功标准计算加重和方案流转
  if (lastPlannedReps === 3) {
    // 5x3 方案
    if (lastActualLastSet >= 3) {
      // 成功：最后一组完成次数 >= 计划次数 3 ➔ 增加进阶步长重量
      nextWeight = lastWeight + step;
      nextPlannedReps = 3;
    } else {
      // 失败：最后一组完成次数 < 3 ➔ 重量保持不变，计划次数降级为 6x2
      nextWeight = lastWeight;
      nextPlannedReps = 2;
    }
  } else if (lastPlannedReps === 2) {
    // 6x2 方案
    if (lastActualLastSet >= 2) {
      // 成功：最后一组完成次数 >= 2 ➔ 增加进阶步长重量，并升回 5x3 方案
      nextWeight = lastWeight + step;
      nextPlannedReps = 3;
    } else {
      // 失败：重量不变，降级为 10x1 方案
      nextWeight = lastWeight;
      nextPlannedReps = 1;
    }
  } else if (lastPlannedReps === 1) {
    // 10x1 方案
    // 无论最后一组次数多少，完成 10x1 后均增加进阶步长重量，并重置回 5x3
    nextWeight = lastWeight + step;
    nextPlannedReps = 3;
  } else {
    // 兼容异常
    nextWeight = lastWeight;
    nextPlannedReps = 3;
  }

  nextWeight = roundWeight(nextWeight);

  if (nextPlannedReps === 3) {
    schemeText = '5组 × 3次 (最后一组 AMRAP，即尽量多做)';
  } else if (nextPlannedReps === 2) {
    schemeText = '6组 × 2次 (最后一组 AMRAP，即尽量多做)';
  } else {
    schemeText = '10组 × 1次 (最后一组 AMRAP，即尽量多做)';
  }

  return {
    weight_kg: nextWeight,
    planned_reps: nextPlannedReps,
    scheme_text: schemeText
  };
}

/**
 * 计算 T2 动作的今日训练建议
 * 
 * T2 规则：
 * - 无历史记录：
 *     - 采用 3×10 方案 (planned_reps = 10)
 *     - 重量优先采用用户自定义初始重量，若无则采用默认初始重量
 * - 有历史记录（取最后一条）：
 *     - 首先计算上次总次数：total_reps = 2 * planned_reps + actual_last_set_reps
 *     - 若上次 planned_reps 为 10 (3×10)：
 *         - 总次数 >= 25 (成功)：重量增加 increment，保持 3×10 (planned_reps = 10)
 *         - 总次数 < 25 (失败)：重量不变，降级为 3×8 (planned_reps = 8)
 *     - 若上次 planned_reps 为 8 (3×8)：
 *         - 总次数 >= 20 (成功)：重量增加 increment，保持 3×8 (planned_reps = 8)
 *         - 总次数 < 20 (失败)：重量不变，降级为 3×6 (planned_reps = 6)
 *     - 若上次 planned_reps 为 6 (3×6)：
 *         - 总次数 >= 15 (成功)：重量增加 increment，重置回到 3×10 (planned_reps = 10)
 *         - 总次数 < 15 (失败)：重量不变，保持 3×6 (planned_reps = 6)
 * 
 * @param {string} exercise 动作名 ('squat', 'bench', 'deadlift', 'press')
 * @param {Array} history 该动作在该 Tier 的全部历史记录（按时间升序排列）
 * @param {number} [customInitialWeight] 用户自定义初始重量
 * @param {number} [increment=2.5] 用户自定义的进阶加重步长
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
export function getT2Progression(exercise, history, customInitialWeight, increment = 2.5) {
  const defaultWeight = (customInitialWeight !== undefined && customInitialWeight !== null)
    ? Number(customInitialWeight)
    : (INITIAL_WEIGHTS[exercise] || 20.0);

  const step = Number(increment);

  // 1. 无历史记录，使用初始设置：3x10 @ 初始重量
  if (!history || history.length === 0) {
    return {
      weight_kg: defaultWeight,
      planned_reps: 10,
      scheme_text: '3组 × 10次 (最后一组 AMRAP，即尽量多做)'
    };
  }

  // 获取最后一次训练记录
  const lastRecord = history[history.length - 1];
  const lastWeight = Number(lastRecord.weight_kg);
  const lastPlannedReps = Number(lastRecord.planned_reps);
  const lastActualLastSet = Number(lastRecord.actual_last_set_reps);

  // 计算总次数
  const totalReps = (lastPlannedReps * 2) + lastActualLastSet;

  let nextWeight = lastWeight;
  let nextPlannedReps = 10;
  let schemeText = '';

  // 2. 根据上次的计划次数及总次数达标情况计算增重与降级
  if (lastPlannedReps === 10) {
    // 3x10 方案
    if (totalReps >= 25) {
      // 成功：总次数 >= 25 ➔ 增加进阶步长，保持 3x10
      nextWeight = lastWeight + step;
      nextPlannedReps = 10;
    } else {
      // 失败：重量不变，降级为 3x8
      nextWeight = lastWeight;
      nextPlannedReps = 8;
    }
  } else if (lastPlannedReps === 8) {
    // 3x8 方案
    if (totalReps >= 20) {
      // 成功：总次数 >= 20 ➔ 增加进阶步长，保持 3x8
      nextWeight = lastWeight + step;
      nextPlannedReps = 8;
    } else {
      // 失败：重量不变，降级为 3x6
      nextWeight = lastWeight;
      nextPlannedReps = 6;
    }
  } else if (lastPlannedReps === 6) {
    // 3x6 方案
    if (totalReps >= 15) {
      // 成功：总次数 >= 15 ➔ 增加进阶步长，回到 3x10 方案
      nextWeight = lastWeight + step;
      nextPlannedReps = 10;
    } else {
      // 失败：重量不变，保持 3x6 方案不变
      nextWeight = lastWeight;
      nextPlannedReps = 6;
    }
  } else {
    // 兼容异常
    nextWeight = lastWeight;
    nextPlannedReps = 10;
  }

  nextWeight = roundWeight(nextWeight);

  if (nextPlannedReps === 10) {
    schemeText = '3组 × 10次 (最后一组 AMRAP，即尽量多做)';
  } else if (nextPlannedReps === 8) {
    schemeText = '3组 × 8次 (最后一组 AMRAP，即尽量多做)';
  } else {
    schemeText = '3组 × 6次 (最后一组 AMRAP，即尽量多做)';
  }

  return {
    weight_kg: nextWeight,
    planned_reps: nextPlannedReps,
    scheme_text: schemeText
  };
}

/**
 * 计算 T3 动作的今日训练建议
 * 
 * T3 规则：
 * - 无历史记录：
 *     - 采用 3×15 方案 (planned_reps = 15)
 *     - 重量优先采用用户自定义初始重量，若无则采用默认初始重量 (10.0kg)
 * - 有历史记录（取最后一条）：
 *     - 首先计算上次总次数：total_reps = 2 * planned_reps + actual_last_set_reps = 30 + actual_last_set_reps
 *     - 若总次数 >= 25 (成功)：重量增加 increment，方案保持 3x15 (planned_reps = 15)
 *     - 若总次数 < 25 (失败)：重量不变，方案保持 3x15 (planned_reps = 15)
 *     - 无降级，方案永远为 3×15
 * 
 * @param {string} exercise 动作名 ('pullup', 'abdominal', 'bicep_curl', 'face_pull')
 * @param {Array} history 该动作在该 Tier 的全部历史记录（按时间升序排列）
 * @param {number} [customInitialWeight] 用户自定义初始重量
 * @param {number} [increment=2.5] 用户自定义的进阶加重步长
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
/**
 * 计算 T3 动作的今日训练建议
 * 
 * T3 规则：
 * - 无历史记录：
 *     - 采用 3×15 方案 (planned_reps = 15)
 *     - 重量优先采用用户自定义初始重量，若无则采用默认初始重量 (10.0kg)
 * - 有历史记录（取最后一条）：
 *     - 首先计算上次总次数：total_reps = 2 * planned_reps + actual_last_set_reps = 30 + actual_last_set_reps
 *     - 若总次数 >= targetReps (成功)：重量增加 increment，方案保持 3x15 (planned_reps = 15)
 *     - 若总次数 < targetReps (失败)：重量不变，方案保持 3x15 (planned_reps = 15)
 *     - 无降级，方案永远为 3×15
 * 
 * @param {string} exercise 动作名
 * @param {Array} history 该动作在该 Tier 的全部历史记录
 * @param {number} [customInitialWeight] 用户自定义初始重量
 * @param {number} [increment=2.5] 用户自定义的进阶加重步长
 * @param {number} [targetReps=25] 用户自定义的进阶达标门槛总次数
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
export function getT3Progression(exercise, history, customInitialWeight, increment = 2.5, targetReps = 25) {
  const defaultWeight = (customInitialWeight !== undefined && customInitialWeight !== null)
    ? Number(customInitialWeight)
    : (INITIAL_WEIGHTS[exercise] || 10.0);

  const step = Number(increment);
  const targetThreshold = Number(targetReps);

  // 1. 无历史记录，使用初始设置：3x15 @ 初始重量
  if (!history || history.length === 0) {
    return {
      weight_kg: defaultWeight,
      planned_reps: 15,
      scheme_text: '3组 × 15次 (最后一组 AMRAP，即尽量多做)'
    };
  }

  // 获取最后一次训练记录
  const lastRecord = history[history.length - 1];
  const lastWeight = Number(lastRecord.weight_kg);
  const lastPlannedReps = Number(lastRecord.planned_reps);
  const lastActualLastSet = Number(lastRecord.actual_last_set_reps);

  // 计算总次数 (对于 T3 预定次数为 15)
  const totalReps = (lastPlannedReps * 2) + lastActualLastSet;

  let nextWeight = lastWeight;

  // 2. 根据总次数达标情况计算增重 (T3 无降级，方案恒定 3x15)
  if (totalReps >= targetThreshold) {
    // 成功：总次数 >= targetThreshold ➔ 增加进阶步长重量
    nextWeight = lastWeight + step;
  } else {
    // 失败：重量保持不变
    nextWeight = lastWeight;
  }

  nextWeight = roundWeight(nextWeight);

  return {
    weight_kg: nextWeight,
    planned_reps: 15,
    scheme_text: '3组 × 15次 (最后一组 AMRAP，即尽量多做)'
  };
}
