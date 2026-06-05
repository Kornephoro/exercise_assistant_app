/**
 * 单位转换工具
 * 数据库统一存储 kg，前端根据用户设置显示
 */

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
  if (!weight || unit === 'kg') return weight;
  return kgToLbs(weight);
}

/**
 * 将显示重量转回数据库存储的 kg
 * @param {number} displayWeight - 用户输入的重量
 * @param {string} unit - 'kg' | 'lbs'
 * @returns {number} 存储到数据库的 kg 值
 */
export function toStorageWeight(displayWeight, unit) {
  if (!displayWeight || unit === 'kg') return displayWeight;
  return lbsToKg(displayWeight);
}

/**
 * 配片重量转换（特殊处理常见配片）
 */
export function convertPlateWeight(weight, fromUnit, toUnit) {
  if (fromUnit === toUnit) return weight;
  const plateMap = {
    '1.25': 2.5,
    '2.5': 5,
    '5': 2.5,
    '10': 4.5,
    '15': 7,
    '20': 9,
    '25': 11.5,
  };
  const key = weight.toString();
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return plateMap[key] || Math.round(weight * KG_TO_LBS * 2) / 2;
  } else {
    const reverseMap = Object.fromEntries(Object.entries(plateMap).map(([k, v]) => [v.toString(), parseFloat(k)]));
    return reverseMap[key] || Math.round(weight * LBS_TO_KG * 10) / 10;
  }
}

/**
 * 杆重转换（特殊处理常见杆重）
 */
export function convertBarWeight(weight, fromUnit, toUnit) {
  if (fromUnit === toUnit) return weight;
  const barMap = {
    '20': 45,
    '15': 35,
    '45': 20,
    '35': 15,
  };
  const key = weight.toString();
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return barMap[key] || Math.round(weight * KG_TO_LBS);
  } else {
    const reverseMap = Object.fromEntries(Object.entries(barMap).map(([k, v]) => [v.toString(), parseInt(k)]));
    return reverseMap[key] || Math.round(weight * LBS_TO_KG);
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
 * 杠铃对称配片圆整算法 (完全背包/可达背包搜索最临近组合)
 */
export function roundToClosestLoadable(targetWeight, barWeight = 20, enabledPlates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const bar = parseFloat(barWeight) || 0;
  if (targetWeight <= bar) return bar;
  const eachSideTarget = (targetWeight - bar) / 2;
  
  if (!enabledPlates || enabledPlates.length === 0) return targetWeight;
  const sortedPlates = [...enabledPlates].map(p => parseFloat(p)).sort((a, b) => b - a);
  
  const maxPlate = sortedPlates[0];
  const maxReachable = eachSideTarget + maxPlate;
  
  const scale = 100;
  const t = Math.round(eachSideTarget * scale);
  const scaledPlates = sortedPlates.map(p => Math.round(p * scale));
  const maxLimit = Math.round(maxReachable * scale);
  
  const dp = new Array(maxLimit + 1).fill(false);
  dp[0] = true;
  
  for (const p of scaledPlates) {
    for (let w = p; w <= maxLimit; w++) {
      if (dp[w - p]) {
        dp[w] = true;
      }
    }
  }
  
  let bestW = 0;
  let bestDiff = Infinity;
  for (let w = 0; w <= maxLimit; w++) {
    if (dp[w]) {
      const diff = Math.abs(w - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestW = w;
      }
    }
  }
  
  return bar + 2 * (bestW / scale);
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
  
  // 确保规则按限制排序，无上限的放在最后
  const cleanRules = [...rules].sort((a, b) => {
    const limA = a.limit === null || a.limit === undefined ? Infinity : parseFloat(a.limit);
    const limB = b.limit === null || b.limit === undefined ? Infinity : parseFloat(b.limit);
    return limA - limB;
  });
  
  const options = [];
  let currentWeight = 0;
  const maxLimit = tVal + 20; // 适当生成比目标大的一些规格
  
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
                    ['squat', 'bench', 'deadlift', 'press'].includes(name);
                    
  if (isBarbell) {
    const barWeight = eqConfig.barbell?.bar_weight ?? (unit === 'kg' ? 20 : 45);
    const enabledPlates = eqConfig.barbell?.enabled_plates || (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
    
    const targetInUnit = unit === 'lbs' ? convertWeight(tVal, 'lbs') : tVal;
    const roundedInUnit = roundToClosestLoadable(targetInUnit, barWeight, enabledPlates);
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
export function getBarbellPlateBreakdown(totalWeight, barWeight = 20, enabledPlates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const bar = parseFloat(barWeight) || 0;
  if (totalWeight <= bar) return { bar, plates: [] };
  const eachSideTarget = (totalWeight - bar) / 2;
  
  if (!enabledPlates || enabledPlates.length === 0) return { bar, plates: [] };
  const sortedPlates = [...enabledPlates].map(p => parseFloat(p)).sort((a, b) => b - a);
  
  const maxPlate = sortedPlates[0];
  const maxReachable = eachSideTarget + maxPlate;
  
  const scale = 100;
  const t = Math.round(eachSideTarget * scale);
  const scaledPlates = sortedPlates.map(p => Math.round(p * scale));
  const maxLimit = Math.round(maxReachable * scale);
  
  const dp = new Array(maxLimit + 1).fill(false);
  const parent = new Array(maxLimit + 1).fill(-1);
  dp[0] = true;
  
  for (let i = 0; i < scaledPlates.length; i++) {
    const p = scaledPlates[i];
    const originalP = sortedPlates[i];
    for (let w = p; w <= maxLimit; w++) {
      if (dp[w - p]) {
        dp[w] = true;
        parent[w] = originalP;
      }
    }
  }
  
  let bestW = 0;
  let bestDiff = Infinity;
  for (let w = 0; w <= maxLimit; w++) {
    if (dp[w]) {
      const diff = Math.abs(w - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestW = w;
      }
    }
  }
  
  const usedPlates = [];
  let curr = bestW;
  let safety = 0;
  while (curr > 0 && safety < 100) {
    safety++;
    const p = parent[curr];
    if (p === -1 || p === undefined) break;
    usedPlates.push(p);
    curr = Math.round(curr - p * scale);
  }
  
  usedPlates.sort((a, b) => b - a);
  
  return {
    bar,
    plates: usedPlates,
    totalCalculated: bar + 2 * (bestW / scale)
  };
}
