/**
 * 1RM 估算工具
 * 与插件 BodyPage.tsx / App.tsx 中算法保持一致
 */

/**
 * 根据 重量 + 次数 估算 1RM
 * @param {number} weightKg 实际测试重量 (kg)
 * @param {number} reps 完成次数
 * @returns {{ e1rm: number, formula: string, valid: boolean }}
 *   - reps === 1: 实际重量
 *   - 1 < reps <= 10: Epley = w * (1 + r/30)
 *   - 10 < reps < 36: Brzycki = w * (36 / (37 - r))
 *   - reps >= 36 或 weight<=0 或 reps<=0: 无效
 */
export function calcE1RM(weightKg, reps) {
  const w = Number(weightKg);
  const r = Number(reps);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) {
    return { e1rm: 0, formula: null, valid: false };
  }
  if (r === 1) {
    return { e1rm: w, formula: 'actual', valid: true };
  }
  if (r <= 10) {
    const e1rm = Math.round(w * (1 + r / 30) * 10) / 10;
    return { e1rm, formula: 'epley', valid: true };
  }
  if (r < 36) {
    const e1rm = Math.round((w * (36 / (37 - r))) * 10) / 10;
    return { e1rm, formula: 'brzycki', valid: true };
  }
  return { e1rm: 0, formula: null, valid: false };
}

export const FORMULA_LABEL = {
  actual: '实际重量',
  epley: 'Epley',
  brzycki: 'Brzycki (改良)',
};

export const FORMULA_DESC = {
  actual: 'reps = 1，直接使用实际重量',
  epley: 'e1RM = 重量 × (1 + 次数/30)，适用于 1 < reps ≤ 10',
  brzycki: 'e1RM = 重量 × 36 / (37 - 次数)，适用于 10 < reps < 36',
};

/**
 * 用 1RM 推导训练起始重量 (round to 0.5kg)
 * @param {number} oneRm 1RM (kg)
 * @param {number} ratio 比例 (0.85 for T1, 0.65 for T2)
 */
export function deriveStartFromOneRm(oneRm, ratio) {
  if (!oneRm || oneRm <= 0) return 0;
  return Math.round((oneRm * ratio) / 0.5) * 0.5;
}

export const MAIN_LIFTS = [
  { key: 'squat', cn: '深蹲', color: 'blue' },
  { key: 'bench', cn: '卧推', color: 'emerald' },
  { key: 'deadlift', cn: '硬拉', color: 'red' },
  { key: 'press', cn: '推举', color: 'purple' },
];

/**
 * 从历史记录中挑出每个主项的最新一条
 * @param {Array} records
 * @returns {Object} { squat: {weight,date,formula,source}, ... }
 */
export function pickLatestByLift(records) {
  const latest = {};
  for (const r of records) {
    if (!latest[r.exercise] || r.date > latest[r.exercise].date) {
      latest[r.exercise] = {
        weight: r.e1rm_kg,
        date: r.date,
        formula: r.formula,
        source: r.source,
        weight_actual: r.weight_kg,
        reps: r.reps,
      };
    }
  }
  return latest;
}
