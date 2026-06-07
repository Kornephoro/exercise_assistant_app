/**
 * 身体状态与健康指标评估算法 (BMI/WHtR)
 */

/**
 * BMI（身体质量指数）评估计算
 * @param {number} weight - 体重 (kg)
 * @param {number} heightCm - 身高 (cm)
 * @returns {Object|null} 评估结果，包含 bmi, label, badgeColor
 */
export const getBmiInfo = (weight, heightCm) => {
  if (!weight || !heightCm) return null;
  const bmi = weight / ((heightCm / 100) ** 2);
  let label;
  let badgeColor;
  if (bmi < 18.5) {
    label = '偏瘦';
    badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  } else if (bmi < 24) {
    label = '标准';
    badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
  } else if (bmi < 28) {
    label = '超重';
    badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  } else {
    label = '肥胖';
    badgeColor = 'bg-red-500/10 text-red-500 border-red-500/20';
  }
  return { bmi: Math.round(bmi * 10) / 10, label, badgeColor };
};

/**
 * WHtR（腰围身高比）评估计算
 * @param {number} waistCm - 腰围 (cm)
 * @param {number} heightCm - 身高 (cm)
 * @returns {Object|null} 评估结果，包含 whtr, label, badgeColor
 */
export const getWhtrInfo = (waistCm, heightCm) => {
  if (!waistCm || !heightCm) return null;
  const whtr = waistCm / heightCm;
  let label;
  let badgeColor;
  if (whtr < 0.46) {
    label = '消瘦';
    badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  } else if (whtr < 0.51) {
    label = '理想';
    badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
  } else if (whtr < 0.57) {
    label = '超重';
    badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  } else {
    label = '腹部肥胖';
    badgeColor = 'bg-red-500/10 text-red-500 border-red-500/20';
  }
  return { whtr: Math.round(whtr * 1000) / 1000, label, badgeColor };
};
