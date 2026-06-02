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
