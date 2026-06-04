/**
 * 饮食与能量代谢计算引擎 (Diet & Nutrition Manager Engine)
 */

// 1. 力量训练能耗映射
export const STRENGTH_ENERGY_COST = {
  male: {
    none: 0,
    beginner: 150,
    intermediate: 200,
    advanced: 250,
  },
  female: {
    none: 0,
    beginner: 100,
    intermediate: 150,
    advanced: 200,
  },
  other: {
    none: 0,
    beginner: 125,
    intermediate: 175,
    advanced: 225,
  }
};

/**
 * 计算基础代谢率 (BMR) - 使用 Mifflin-St Jeor 公式
 * @param {number} weight - 体重 (kg)
 * @param {number} height - 身高 (cm)
 * @param {number} age - 年龄 (岁)
 * @param {string} gender - 'male' | 'female' | 'other'
 * @returns {number} BMR (kcal)
 */
export function calcBMR(weight, height, age, gender = 'male') {
  if (!weight || !height || !age) return 0;
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseFloat(age);

  if (gender === 'female') {
    return 9.99 * w + 6.25 * h - 4.92 * a - 161;
  }
  // male 或 other 默认采用男性公式 (或稍微加权)
  return 9.99 * w + 6.25 * h - 4.92 * a + 5;
}

/**
 * 根据配置和当天性质计算 TDEE 与热量预算
 * @param {Object} profile - 用户画像 (age, gender, height_cm)
 * @param {number} currentWeight - 最新录入体重 (kg)
 * @param {Object} config - 饮食配置 (neat_tef_factor, strength_level, deficit_slider, plan_type, cardio_weekly_kcal)
 * @param {boolean} isStrengthDay - 是否为训练日
 * @returns {Object} TDEE 与热量预算
 */
export function calcCalorieBudget(profile, currentWeight, config, isStrengthDay = true) {
  const w = currentWeight || profile?.weight_kg || 0;
  const h = profile?.height_cm || 0;
  const a = profile?.age || 0;
  const gender = profile?.gender || 'male';

  const bmr = calcBMR(w, h, a, gender);
  if (bmr <= 0) return { bmr: 0, tdee: 0, budget: 0 };

  const neatFactor = parseFloat(config?.neat_tef_factor) || 1.10;
  const baseMetabolism = bmr * neatFactor; // 无运动能耗

  // 1. 力量训练能耗
  let strengthCost = 0;
  const level = config?.strength_level || 'beginner';
  if (level === 'custom') {
    strengthCost = parseInt(config?.custom_strength_kcal, 10) || 0;
  } else {
    const genderCost = STRENGTH_ENERGY_COST[gender] || STRENGTH_ENERGY_COST.male;
    strengthCost = genderCost[level] || 0;
  }

  // 2. 有氧运动日均能耗
  const cardioDailyCost = (parseInt(config?.cardio_weekly_kcal, 10) || 0) / 7;

  // 3. 计算 TDEE
  // 如果是分日计划 (Split)，训练日加力训消耗，休息日不加
  // 如果是统一计划 (Unified)，力训消耗折算均值：每周以 4 天力训（GZCLP常规）计算均值，即 strengthCost * 4 / 7
  let activeStrengthCost = 0;
  if (config?.plan_type === 'unified') {
    activeStrengthCost = (strengthCost * 4) / 7;
  } else {
    activeStrengthCost = isStrengthDay ? strengthCost : 0;
  }

  const tdee = baseMetabolism + cardioDailyCost + activeStrengthCost;
  const deficitSlider = parseFloat(config?.deficit_slider) || 0.80;
  const budget = tdee * deficitSlider;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    budget: Math.round(budget),
  };
}

/**
 * 根据计算模式计算三大营养素目标克数
 * @param {number} calorieBudget - 预算热量 (kcal)
 * @param {number} currentWeight - 体重 (kg)
 * @param {Object} config - 饮食配置 (calc_mode, ratio_*, multiple_config, custom_config)
 * @param {boolean} isStrengthDay - 今天是否为训练日
 * @returns {Object} 碳水、蛋白、脂肪目标 (g) 与热量总计
 */
export function calcMacronutrientTargets(calorieBudget, currentWeight, config, isStrengthDay = true) {
  const w = parseFloat(currentWeight) || 70; // 默认体重 fallback
  const mode = config?.calc_mode || 'ratio';
  const dayKey = isStrengthDay ? 'strength_day' : 'rest_day';

  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let totalKcal = 0;

  if (mode === 'ratio') {
    // 占比法
    const rc = parseInt(config?.ratio_carbs, 10) || 50;
    const rp = parseInt(config?.ratio_protein, 10) || 30;
    const rf = parseInt(config?.ratio_fat, 10) || 20;

    carbs = (calorieBudget * (rc / 100)) / 4;
    protein = (calorieBudget * (rp / 100)) / 4;
    fat = (calorieBudget * (rf / 100)) / 9;
    totalKcal = calorieBudget;
  } else if (mode === 'weight_multiple') {
    // 体重倍数法
    const mConfig = config?.multiple_config?.[dayKey] || { carbs: 3.0, protein: 2.0, fat: 0.8 };
    carbs = w * (parseFloat(mConfig.carbs) || 3.0);
    protein = w * (parseFloat(mConfig.protein) || 2.0);
    fat = w * (parseFloat(mConfig.fat) || 0.8);
    totalKcal = carbs * 4 + protein * 4 + fat * 9;
  } else {
    // 进阶自定义克数
    const cConfig = config?.custom_config?.[dayKey] || { carbs: 250, protein: 140, fat: 60 };
    carbs = parseFloat(cConfig.carbs) || 250;
    protein = parseFloat(cConfig.protein) || 140;
    fat = parseFloat(cConfig.fat) || 60;
    totalKcal = carbs * 4 + protein * 4 + fat * 9;
  }

  return {
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    calories: Math.round(totalKcal),
  };
}

/**
 * 饮食营养安全红线检测
 * @param {number} totalKcal - 预算/实际热量 (kcal)
 * @param {number} bmr - 基础代谢 (kcal)
 * @param {number} proteinG - 蛋白质 (g)
 * @param {number} fatG - 脂肪 (g)
 * @param {number} currentWeight - 体重 (kg)
 * @param {string} gender - 性别
 * @returns {Array} 警告信息列表 ({ type: 'danger'|'warning', message: string })
 */
export function auditNutritionSafety(totalKcal, bmr, proteinG, fatG, currentWeight, gender = 'male') {
  const w = parseFloat(currentWeight) || 70;
  const warnings = [];

  // 1. 热量赤字警告 (低于 BMR 基础代谢)
  if (totalKcal > 0 && bmr > 0 && totalKcal < bmr) {
    warnings.push({
      type: 'danger',
      message: `⚠️ 热量预算 (${Math.round(totalKcal)} kcal) 低于您的基础代谢率 BMR (${Math.round(bmr)} kcal)。长期摄入低于基础代谢可能导致严重的代谢适应性损伤、体能崩溃及免疫力下降。`,
    });
  }

  // 2. 蛋白质安全红线 (低于 1.4 g/kg)
  const proteinPerKg = proteinG / w;
  if (proteinG > 0 && proteinPerKg < 1.4) {
    warnings.push({
      type: 'warning',
      message: `⚠️ 蛋白质配比 (${proteinG}g, 约 ${proteinPerKg.toFixed(2)} g/kg) 低于减脂/增力期肌肉保留安全线 1.4 g/kg。这可能会导致训练后肌肉无法有效修复，增加瘦体重（肌肉）流失的风险。`,
    });
  }

  // 3. 脂肪安全红线 (低于 0.5 g/kg，或男 < 50g, 女 < 40g)
  const fatPerKg = fatG / w;
  const minFatAbs = gender === 'female' ? 40 : 50;
  if (fatG > 0 && (fatPerKg < 0.5 || fatG < minFatAbs)) {
    warnings.push({
      type: 'danger',
      message: `⚠️ 脂肪配比 (${fatG}g, 约 ${fatPerKg.toFixed(2)} g/kg) 过低。成年人脂肪摄入长期低于 0.5 g/kg 或绝对值低于 ${minFatAbs}g，易引发内分泌失调、脂溶性维生素吸收不良及激素（如睾酮/雌激素）分泌受损。`,
    });
  }

  return warnings;
}

/**
 * 依据用户近期反馈，给出 AI 体感配比优化方案
 * @param {string} feedbackType - 'difficult' | 'plateau' | 'gain'
 * @param {Object} currentGrams - 当前克数配置 { carbs, protein, fat }
 * @returns {Object} 优化建议克数及推荐解释
 */
export function getAiDietTuneUp(feedbackType, currentGrams) {
  const c = parseInt(currentGrams?.carbs, 10) || 200;
  const p = parseInt(currentGrams?.protein, 10) || 120;
  const f = parseInt(currentGrams?.fat, 10) || 50;

  switch (feedbackType) {
    case 'difficult':
      return {
        suggestion: { carbs: c + 40, protein: p, fat: f },
        reason: '💡 检测到您近期训练体感偏疲惫或体重下降过快。AI 建议：上调 40g 碳水化合物以迅速补足肌糖原，改善运动体能与中枢疲劳。蛋白质和脂肪建议锁定不动。',
      };
    case 'plateau':
      return {
        suggestion: { carbs: Math.max(80, c - 30), protein: p, fat: f },
        reason: '💡 检测到您近期减脂进度停滞（进入平台期）。AI 建议：在保留高蛋白质防御肌肉流失的前提下，温和下调 30g 碳水化合物，制造微量的额外热量缺口打破平台。',
      };
    case 'gain':
      return {
        suggestion: { carbs: c + 60, protein: p + 10, fat: f },
        reason: '💡 检测到您转为增肌/增力期，需要合成代谢热量。AI 建议：大幅上调 60g 碳水化合物以充盈合成代谢环境，并上调 10g 蛋白质作为肌纤维肥大的原料。',
      };
    default:
      return {
        suggestion: { carbs: c, protein: p, fat: f },
        reason: '维持当前营养配比。',
      };
  }
}
