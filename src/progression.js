/**
 * GZCLP 力量训练计划进步算法及配置
 */

// 1. 默认初始重量（无历史记录时使用）
export const INITIAL_WEIGHTS = {
  squat: 40.0,
  bench: 30.0,
  deadlift: 50.0,
  press: 20.0
};

// 2. 动作中文名称映射
export const EXERCISE_NAMES_CN = {
  squat: '深蹲 (Squat)',
  bench: '卧推 (Bench Press)',
  deadlift: '硬拉 (Deadlift)',
  press: '推举 (Overhead Press)'
};

// 3. GZCLP 四天循环动作映射
// Day1: T1 squat, T2 bench
// Day2: T1 deadlift, T2 press
// Day3: T1 bench, T2 squat
// Day4: T1 press, T2 deadlift
export const DAY_WORKOUT_MAP = {
  Day1: { T1: 'squat', T2: 'bench' },
  Day2: { T1: 'deadlift', T2: 'press' },
  Day3: { T1: 'bench', T2: 'squat' },
  Day4: { T1: 'press', T2: 'deadlift' }
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
 *     - 重量采用初始重量
 * - 有历史记录（取最后一条）：
 *     - 若上次 planned_reps 为 3 (5×3)：
 *         - 最后一组完成次数 >= 5：重量增加 5kg，保持 5×3 (planned_reps = 3)
 *         - 最后一组完成次数 >= 3 且 < 5：重量增加 2.5kg，保持 5×3 (planned_reps = 3)
 *         - 最后一组完成次数 < 3：代表失败，重量不变，降级为 6×2 方案 (planned_reps = 2)
 *     - 若上次 planned_reps 为 2 (6×2)：
 *         - 最后一组完成次数 >= 2：代表成功，重量增加 2.5kg，升级/重置回 5×3 方案 (planned_reps = 3)
 *         - 最后一组完成次数 < 2：代表失败，重量不变，降级为 10×1 方案 (planned_reps = 1)
 *     - 若上次 planned_reps 为 1 (10×1)：
 *         - 不论完成多少个，重量增加 2.5kg，升级/重置回 5×3 方案 (planned_reps = 3)
 * 
 * @param {string} exercise 动作名 ('squat', 'bench', 'deadlift', 'press')
 * @param {Array} history 该动作在该 Tier 的全部历史记录（按时间升序排列）
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
export function getT1Progression(exercise, history) {
  const defaultWeight = INITIAL_WEIGHTS[exercise] || 20.0;

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

  // 2. 根据上次的计划次数（方案）应用不同的升降级规则
  if (lastPlannedReps === 3) {
    // 5x3 方案
    if (lastActualLastSet >= 5) {
      // 最后一组表现极佳，大幅增加 5kg
      nextWeight = lastWeight + 5.0;
      nextPlannedReps = 3;
    } else if (lastActualLastSet >= 3) {
      // 成功完成，但未达到额外加重标准，增加 2.5kg
      nextWeight = lastWeight + 2.5;
      nextPlannedReps = 3;
    } else {
      // 最后一组次数少于 3，说明 5x3 失败，重量保持不变，降级为 6x2
      nextWeight = lastWeight;
      nextPlannedReps = 2;
    }
  } else if (lastPlannedReps === 2) {
    // 6x2 方案
    if (lastActualLastSet >= 2) {
      // 成功完成，增加 2.5kg 并重置回 5x3 方案
      nextWeight = lastWeight + 2.5;
      nextPlannedReps = 3;
    } else {
      // 最后一组次数少于 2，说明 6x2 失败，重量保持不变，降级为 10x1
      nextWeight = lastWeight;
      nextPlannedReps = 1;
    }
  } else if (lastPlannedReps === 1) {
    // 10x1 方案
    // 无论最后一组完成几个，在 10x1 完成后都增加 2.5kg，并重置回 5x3 方案
    nextWeight = lastWeight + 2.5;
    nextPlannedReps = 3;
  } else {
    // 兼容其他意外情况，默认回到 5x3
    nextWeight = lastWeight;
    nextPlannedReps = 3;
  }

  // 确保重量格式正确
  nextWeight = roundWeight(nextWeight);

  // 设定方案描述文本
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
 *     - 重量采用初始重量
 * - 有历史记录（取最后一条）：
 *     - 首先计算上次总次数：total_reps = (3-1) * planned_reps + actual_last_set_reps = 2 * planned_reps + actual_last_set_reps
 *     - 若上次 planned_reps 为 10 (3×10)：
 *         - 总次数 >= 25：代表成功，重量增加 2.5kg，保持 3×10 (planned_reps = 10)
 *         - 总次数 < 25：代表失败，重量不变，降级为 3×8 (planned_reps = 8)
 *     - 若上次 planned_reps 为 8 (3×8)：
 *         - 总次数 >= 20：代表成功，重量增加 2.5kg，保持 3×8 (planned_reps = 8)
 *         - 总次数 < 20：代表失败，重量不变，降级为 3×6 (planned_reps = 6)
 *     - 若上次 planned_reps 为 6 (3×6)：
 *         - 总次数 >= 15：代表成功，重量增加 2.5kg，重置回到 3×10 (planned_reps = 10)
 *         - 总次数 < 15：代表失败，重量不变，保持 3×6 (planned_reps = 6)
 * 
 * @param {string} exercise 动作名 ('squat', 'bench', 'deadlift', 'press')
 * @param {Array} history 该动作在该 Tier 的全部历史记录（按时间升序排列）
 * @returns {Object} { weight_kg: number, planned_reps: number, scheme_text: string }
 */
export function getT2Progression(exercise, history) {
  const defaultWeight = INITIAL_WEIGHTS[exercise] || 20.0;

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

  // 计算前两组完成计划次数，加最后一组实际次数得到的总次数
  const totalReps = (lastPlannedReps * 2) + lastActualLastSet;

  let nextWeight = lastWeight;
  let nextPlannedReps = 10;
  let schemeText = '';

  // 2. 根据上次的计划次数应用升降级规则
  if (lastPlannedReps === 10) {
    // 3x10 方案
    if (totalReps >= 25) {
      // 总次数达标，增加 2.5kg，保持 3x10
      nextWeight = lastWeight + 2.5;
      nextPlannedReps = 10;
    } else {
      // 失败，重量保持不变，降级为 3x8
      nextWeight = lastWeight;
      nextPlannedReps = 8;
    }
  } else if (lastPlannedReps === 8) {
    // 3x8 方案
    if (totalReps >= 20) {
      // 总次数达标，增加 2.5kg，保持 3x8
      nextWeight = lastWeight + 2.5;
      nextPlannedReps = 8;
    } else {
      // 失败，重量不变，降级为 3x6
      nextWeight = lastWeight;
      nextPlannedReps = 6;
    }
  } else if (lastPlannedReps === 6) {
    // 3x6 方案
    if (totalReps >= 15) {
      // 总次数达标，增加 2.5kg，按标准 GZCLP 重置回到 3x10 方案
      nextWeight = lastWeight + 2.5;
      nextPlannedReps = 10;
    } else {
      // 失败，重量不变，继续保持 3x6
      nextWeight = lastWeight;
      nextPlannedReps = 6;
    }
  } else {
    // 其他异常，默认设为 3x10 方案
    nextWeight = lastWeight;
    nextPlannedReps = 10;
  }

  // 确保重量格式正确
  nextWeight = roundWeight(nextWeight);

  // 设定方案描述文本
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
