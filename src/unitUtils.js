/**
 * 单位转换工具
 * 数据库统一存储 kg，前端根据用户设置显示
 */

import { MAIN_LIFT_KEYS } from './oneRmUtils';

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

/**
 * kg 转 lbs
 */
export function kgToLbs(kg) {
  return Math.round(kg * KG_TO_LBS * 2) / 2; // 四舍五入到 0.5
}

/**
 * lbs 转 kg
 */
export function lbsToKg(lbs) {
  return Math.round(lbs * LBS_TO_KG * 10) / 10; // 四舍五入到 0.1
}

/**
 * 根据单位转换重量
 * @param {number} weight - 重量值（数据库存储的 kg）
 * @param {string} unit - 'kg' | 'lbs'
 * @returns {number} 转换后的重量
 */
export function convertWeight(weight, unit) {
  if (weight == null || unit === 'kg') return weight;
  return kgToLbs(weight);
}

/**
 * 将显示重量转回数据库存储的 kg
 * @param {number} displayWeight - 用户输入的重量
 * @param {string} unit - 'kg' | 'lbs'
 * @returns {number} 存储到数据库的 kg 值
 */
export function toStorageWeight(displayWeight, unit) {
  if (displayWeight == null || unit === 'kg') return displayWeight;
  return lbsToKg(displayWeight);
}

// ==================== 配片/杆重硬映射表（模块级常量，避免每次调用重建） ====================

const PLATE_MAP_KG_TO_LBS = {
  '1.25': 2.5,
  '2.5': 5,
  '5': 2.5,
  '10': 4.5,
  '15': 7,
  '20': 9,
  '25': 11.5,
};

const PLATE_MAP_LBS_TO_KG = Object.fromEntries(
  Object.entries(PLATE_MAP_KG_TO_LBS).map(([k, v]) => [v.toString(), parseFloat(k)])
);

const BAR_MAP_KG_TO_LBS = {
  '20': 45,
  '15': 35,
};

const BAR_MAP_LBS_TO_KG = Object.fromEntries(
  Object.entries(BAR_MAP_KG_TO_LBS).map(([k, v]) => [v.toString(), parseInt(k)])
);

/**
 * 配片重量转换（特殊处理常见配片）
 */
export function convertPlateWeight(weight, fromUnit, toUnit) {
  if (fromUnit === toUnit) return weight;
  const key = weight.toString();
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return PLATE_MAP_KG_TO_LBS[key] ?? Math.round(weight * KG_TO_LBS * 2) / 2;
  } else {
    return PLATE_MAP_LBS_TO_KG[key] ?? Math.round(weight * LBS_TO_KG * 10) / 10;
  }
}

/**
 * 杆重转换（特殊处理常见杆重）
 */
export function convertBarWeight(weight, fromUnit, toUnit) {
  if (fromUnit === toUnit) return weight;
  const key = weight.toString();
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return BAR_MAP_KG_TO_LBS[key] ?? Math.round(weight * KG_TO_LBS);
  } else {
    return BAR_MAP_LBS_TO_KG[key] ?? Math.round(weight * LBS_TO_KG);
  }
}

/**
 * 获取动作的单位（动作级覆盖 > 全局默认）
 */
export function getExerciseUnit(exerciseName, exerciseUnits = {}, defaultUnit = 'kg') {
  return exerciseUnits[exerciseName] || defaultUnit;
}

// ==================== 健身房器材配重配置与圆整 ====================

export const DEFAULT_GYM_EQUIPMENT_CONFIG = {
  kg: {
    barbell: {
      bar_weight: 20.0,
      plates: [25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25, 0.5],
      enabled_plates: [25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25]
    },
    dumbbell: {
      rules: [
        { limit: 10.0, step: 2.0 },
        { limit: null, step: 2.5 }
      ]
    },
    cable: {
      step: 2.5
    }
  },
  lbs: {
    barbell: {
      bar_weight: 45.0,
      plates: [45.0, 35.0, 25.0, 10.0, 5.0, 2.5],
      enabled_plates: [45.0, 35.0, 25.0, 10.0, 5.0, 2.5]
    },
    dumbbell: {
      rules: [
        { limit: null, step: 5.0 }
      ]
    },
    cable: {
      step: 5.0
    }
  }
};

/**
 * 标准杠铃片规格集合，用于背包算法区分常用片和特殊片
 */
const ALL_STANDARD_PLATES = new Set([25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25, 0.5, 45.0, 35.0]);

function getPlateLimit(originalP, plateLimits, isStandard) {
  if (!plateLimits || typeof plateLimits !== 'object') {
    return isStandard ? Infinity : 1;
  }

  if (plateLimits[originalP] != null) {
    return parseInt(plateLimits[originalP], 10);
  }

  const strKey = parseFloat(originalP).toString();
  if (plateLimits[strKey] != null) {
    return parseInt(plateLimits[strKey], 10);
  }

  const floatKey1 = parseFloat(originalP).toFixed(1);
  if (plateLimits[floatKey1] != null) {
    return parseInt(plateLimits[floatKey1], 10);
  }

  const floatKey2 = parseFloat(originalP).toFixed(2);
  if (plateLimits[floatKey2] != null) {
    return parseInt(plateLimits[floatKey2], 10);
  }

  return isStandard ? Infinity : 1;
}

// ==================== 共享混合背包 DP 核心（避免 roundToClosestLoadable 与 getBarbellPlateBreakdown 重复 ~70 行） ====================

const DP_SCALE = 100; // 精确到 0.01kg

/**
 * 单侧杠铃片的混合背包 DP 求解
 * @param {number} eachSideTarget - 单侧目标重量
 * @param {number[]} sortedPlates - 已从大到小排序的可用配片列表
 * @param {Object} plateLimits - 各配片的数量限制
 * @returns {{ bestW: number, dp: number[], parent: number[] }}
 *   bestW 为单侧 DP 最优重量（缩放后），dp/parent 用于回溯路径
 */
function solveBarbellKnapsack(eachSideTarget, sortedPlates, plateLimits) {
  const maxPlate = sortedPlates[0];
  const maxReachable = eachSideTarget + maxPlate;

  const t = Math.round(eachSideTarget * DP_SCALE);
  const scaledPlates = sortedPlates.map(p => Math.round(p * DP_SCALE));
  const maxLimit = Math.round(maxReachable * DP_SCALE);

  // dp[w] = 拼装到重量 w 所需的最少受限片数量
  const dp = new Array(maxLimit + 1).fill(Infinity);
  const parent = new Array(maxLimit + 1).fill(-1);
  dp[0] = 0;

  for (let i = 0; i < scaledPlates.length; i++) {
    const p = scaledPlates[i];
    const originalP = sortedPlates[i];
    const isStandard = ALL_STANDARD_PLATES.has(originalP);

    let limit = getPlateLimit(originalP, plateLimits, isStandard);

    if (limit === Infinity) {
      // 无限制：完全背包（升序循环），受限片计数不变
      for (let w = p; w <= maxLimit; w++) {
        if (dp[w - p] !== Infinity && dp[w - p] < dp[w]) {
          dp[w] = dp[w - p];
          parent[w] = originalP;
        }
      }
    } else if (limit > 0) {
      // 有限限制：有界背包（limit 个 0-1 物品，降序循环），每次用受限片 +1 计数
      for (let k = 0; k < limit; k++) {
        for (let w = maxLimit; w >= p; w--) {
          if (dp[w - p] !== Infinity && dp[w - p] + 1 < dp[w]) {
            dp[w] = dp[w - p] + 1;
            parent[w] = originalP;
          }
        }
      }
    }
  }

  // 找到最接近目标且受限片数最少的解
  let bestW = 0;
  let bestDiff = Infinity;
  let bestCustomCount = Infinity;

  for (let w = 0; w <= maxLimit; w++) {
    if (dp[w] !== Infinity) {
      const diff = Math.abs(w - t);
      const customCount = dp[w];
      if (diff < bestDiff || (diff === bestDiff && customCount < bestCustomCount)) {
        bestDiff = diff;
        bestW = w;
        bestCustomCount = customCount;
      }
    }
  }

  return { bestW, dp, parent };
}

/**
 * 从 DP 结果反推配片列表
 * @param {number} bestW - 缩放后的最优重量
 * @param {number[]} parent - DP parent 数组
 * @returns {number[]} 单侧配片列表（从大到小）
 */
function reconstructPlates(bestW, parent) {
  const usedPlates = [];
  let curr = bestW;
  let safety = 0;
  while (curr > 0 && safety < 100) {
    safety++;
    const p = parent[curr];
    if (p === -1 || p === undefined || p <= 0) break;
    usedPlates.push(p);
    curr = Math.round(curr - p * DP_SCALE);
  }
  usedPlates.sort((a, b) => b - a);
  return usedPlates;
}

/**
 * 杠铃对称配片圆整算法
 */
export function roundToClosestLoadable(targetWeight, barWeight = 20, enabledPlates = [25, 20, 15, 10, 5, 2.5, 1.25], plateLimits = {}) {
  const bar = parseFloat(barWeight) || 0;
  if (targetWeight <= bar) return bar;
  const eachSideTarget = (targetWeight - bar) / 2;

  if (!enabledPlates || enabledPlates.length === 0) return targetWeight;
  const sortedPlates = [...enabledPlates].map(p => parseFloat(p)).sort((a, b) => b - a);

  const { bestW } = solveBarbellKnapsack(eachSideTarget, sortedPlates, plateLimits);
  return bar + 2 * (bestW / DP_SCALE);
}

/**
 * 哑铃多分段区间动态圆整算法
 */
export function roundToClosestDumbbell(target, rules) {
  const tVal = parseFloat(target);
  if (isNaN(tVal) || tVal <= 0) return 0;

  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return Math.round(tVal / 0.5) * 0.5;
  }

  const cleanRules = [...rules].sort((a, b) => {
    const limA = a.limit === null || a.limit === undefined ? Infinity : parseFloat(a.limit);
    const limB = b.limit === null || b.limit === undefined ? Infinity : parseFloat(b.limit);
    return limA - limB;
  });

  const options = [];
  let currentWeight = 0;
  const maxLimit = tVal + 20;

  for (const rule of cleanRules) {
    const step = parseFloat(rule.step) || 2.0;
    const limit = rule.limit === null || rule.limit === undefined ? Infinity : parseFloat(rule.limit);
    const endLimit = Math.min(limit, maxLimit);

    let w = currentWeight + step;
    while (w <= endLimit + 0.0001) {
      options.push(w);
      currentWeight = w;
      w += step;
    }
  }

  if (options.length === 0) return tVal;

  let closest = options[0];
  let minDiff = Math.abs(tVal - closest);
  for (const opt of options) {
    const diff = Math.abs(tVal - opt);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest;
}

/**
 * 龙门架/插销器械圆整算法
 */
export function roundToClosestCable(target, step = 2.5) {
  const tVal = parseFloat(target);
  if (isNaN(tVal) || tVal <= 0) return 0;
  const s = parseFloat(step) || 2.5;
  return Math.round(tVal / s) * s;
}

/**
 * 核心统一圆整分流器
 * 接收 KG 存储重量，并自动探测设备类型进行转换圆整，最后转回 KG 存储
 */
export function roundExerciseWeight(targetWeight, exerciseInfo, config, unit = 'kg') {
  const tVal = parseFloat(targetWeight);
  if (isNaN(tVal) || tVal <= 0) return 0;

  if (!config || !config[unit]) {
    return Math.round(tVal / 0.5) * 0.5;
  }

  const eqConfig = config[unit];
  const equipments = exerciseInfo?.equipment || [];
  const name = (exerciseInfo?.name || '').toLowerCase();

  const isBarbell = equipments.includes('barbell') ||
                    MAIN_LIFT_KEYS.includes(name);

  if (isBarbell) {
    const barWeight = eqConfig.barbell?.bar_weight ?? (unit === 'kg' ? 20 : 45);
    const enabledPlates = eqConfig.barbell?.enabled_plates || (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
    const plateLimits = eqConfig.barbell?.plate_limits || {};

    const targetInUnit = unit === 'lbs' ? convertWeight(tVal, 'lbs') : tVal;
    const roundedInUnit = roundToClosestLoadable(targetInUnit, barWeight, enabledPlates, plateLimits);
    return unit === 'lbs' ? toStorageWeight(roundedInUnit, 'lbs') : roundedInUnit;
  }

  const isDumbbell = equipments.includes('dumbbell');
  if (isDumbbell) {
    const dbConfig = eqConfig.dumbbell || {};
    let rules = dbConfig.rules;
    if (!rules || !Array.isArray(rules)) {
      // 老版本双步长参数向后兼容转换
      const threshold = dbConfig.threshold ?? (unit === 'kg' ? 10 : 20);
      const smallStep = dbConfig.small_step ?? (unit === 'kg' ? 2 : 5);
      const largeStep = dbConfig.large_step ?? (unit === 'kg' ? 2.5 : 5);
      rules = [
        { limit: threshold, step: smallStep },
        { limit: null, step: largeStep }
      ];
    }

    const targetInUnit = unit === 'lbs' ? convertWeight(tVal, 'lbs') : tVal;
    const roundedInUnit = roundToClosestDumbbell(targetInUnit, rules);
    return unit === 'lbs' ? toStorageWeight(roundedInUnit, 'lbs') : roundedInUnit;
  }

  const isCableOrMachine = equipments.includes('cable') || equipments.includes('machine');
  if (isCableOrMachine) {
    const step = eqConfig.cable?.step ?? (unit === 'kg' ? 2.5 : 5);

    const targetInUnit = unit === 'lbs' ? convertWeight(tVal, 'lbs') : tVal;
    const roundedInUnit = roundToClosestCable(targetInUnit, step);
    return unit === 'lbs' ? toStorageWeight(roundedInUnit, 'lbs') : roundedInUnit;
  }

  return Math.round(tVal / 0.5) * 0.5;
}

/**
 * 分解空杆重与每侧配片列表
 */
export function getBarbellPlateBreakdown(totalWeight, barWeight = 20, enabledPlates = [25, 20, 15, 10, 5, 2.5, 1.25], plateLimits = {}) {
  const bar = parseFloat(barWeight) || 0;
  if (totalWeight <= bar) return { bar, plates: [] };
  const eachSideTarget = (totalWeight - bar) / 2;

  if (!enabledPlates || enabledPlates.length === 0) return { bar, plates: [] };
  const sortedPlates = [...enabledPlates].map(p => parseFloat(p)).sort((a, b) => b - a);

  const { bestW, parent } = solveBarbellKnapsack(eachSideTarget, sortedPlates, plateLimits);
  const plates = reconstructPlates(bestW, parent);

  return {
    bar,
    plates,
    totalCalculated: bar + 2 * (bestW / DP_SCALE)
  };
}
