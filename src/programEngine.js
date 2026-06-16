/**
 * 参数化训练计划引擎
 * 根据 programs.config JSONB 配置计算今日训练和进阶结果
 * 支持 GZCLP（完整）和 Starting Strength（占位）
 */

import { roundExerciseWeight } from './unitUtils';
import { calcE1RM } from './oneRmUtils';

function roundWeight(weight) {
  return Math.round(weight * 10) / 10;
}

// ==================== GZCLP 引擎 ====================

/**
 * 计算下一个训练日
 * @param {Object} config - programs.config
 * @param {string} lastDay - 上次训练日标签 (e.g. 'Day1')
 * @param {Object} schedule - user_programs.schedule
 * @param {string} lastTrainingDate - 上次训练日期 ISO string
 * @returns {string} 下一个训练日标签
 */
function gzclpGetNextDay(config, lastDay, schedule, lastTrainingDate, startDate) {
  const days = Object.keys(config.day_map);
  if (!lastDay || !days.includes(lastDay)) return days[0];

  const scheduleType = schedule?.scheduleType || 'weekly';

  if (scheduleType === 'custom-ratio') {
    // 练 N 休 M 轮转模式
    const trainDays = schedule?.trainDays || 1;
    const restDays = schedule?.restDays || 1;

    // 计算从上次训练到今天经过了多少天
    if (lastTrainingDate) {
      const lastDate = new Date(lastTrainingDate);
      const today = new Date();
      lastDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (daysSinceLast > 0) {
        const totalCycleDays = trainDays + restDays;
        
        // 计算锚定基准位置
        const baseDate = startDate || lastTrainingDate;
        const base = new Date(baseDate);
        base.setHours(0, 0, 0, 0);
        const lastPosition = Math.floor((lastDate - base) / (1000 * 60 * 60 * 24)) % totalCycleDays;

        const lastDayIdx = days.indexOf(lastDay);
        let currentIdx = lastDayIdx;

        // 根据剩余天数推进：每一天的位置
        for (let i = 1; i <= daysSinceLast; i++) {
          const positionInCycle = (lastPosition + i) % totalCycleDays;
          if (positionInCycle < trainDays) {
            // 这是训练日，推进到下一个训练日标签
            currentIdx = (currentIdx + 1) % days.length;
          }
        }

        return days[currentIdx];
      }
    }

    // 无日期锚点时：简单轮转（例如首日启动）
    const lastDayIdx = days.indexOf(lastDay);
    return days[(lastDayIdx + 1) % days.length];
  } else {
    // 每每周固定几天模式（原有逻辑）
    const idx = days.indexOf(lastDay);
    return days[(idx + 1) % days.length];
  }
}

/**
 * 判断今天是否是训练日
 * @param {Object} schedule - user_programs.schedule
 * @param {string} lastTrainingDate - program_state.last_training_date
 * @param {string} startDate - program_state.start_date
 * @returns {boolean}
 */
function isTodayTrainingDay(schedule, lastTrainingDate, startDate) {
  const scheduleType = schedule?.scheduleType || 'weekly';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (scheduleType === 'custom-ratio') {
    const trainDays = schedule?.trainDays || 1;
    const restDays = schedule?.restDays || 1;
    const totalCycleDays = trainDays + restDays;
    
    const baseDate = startDate || lastTrainingDate;
    if (!baseDate) return true;
    
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    const daysSinceBase = Math.floor((today - base) / (1000 * 60 * 60 * 24));
    
    if (daysSinceBase < 0) return false;
    
    const positionInCycle = daysSinceBase % totalCycleDays;
    return positionInCycle < trainDays;
  } else {
    const trainingDays = schedule?.training_days || [];
    if (trainingDays.length === 0) return true;
    const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayWeekday = weekdaysEng[today.getDay()];
    return trainingDays.includes(todayWeekday);
  }
}

/**
 * 计算下次训练日期（格式化字符串）
 * @param {Object} schedule - user_programs.schedule
 * @param {string} lastTrainingDate - program_state.last_training_date
 * @param {string} startDate - program_state.start_date
 * @returns {string} 格式化的日期字符串
 */
function getNextTrainingDate(schedule, lastTrainingDate, startDate) {
  const scheduleType = schedule?.scheduleType || 'weekly';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (scheduleType === 'custom-ratio') {
    const trainDays = schedule?.trainDays || 1;
    const restDays = schedule?.restDays || 1;
    const totalCycleDays = trainDays + restDays;
    
    const baseDate = startDate || lastTrainingDate;
    if (!baseDate) return '';
    
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    const daysSinceBase = Math.floor((today - base) / (1000 * 60 * 60 * 24));
    
    if (daysSinceBase < 0) {
      return base.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }
    
    const positionInCycle = daysSinceBase % totalCycleDays;
    if (positionInCycle < trainDays) {
      return today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }
    
    const daysUntilNextTrain = totalCycleDays - positionInCycle;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilNextTrain);
    return nextDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  } else {
    const trainingDays = schedule?.training_days || [];
    if (trainingDays.length === 0) return '';
    const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetIndices = trainingDays.map(day => weekdaysEng.indexOf(day)).filter(idx => idx !== -1);
    if (targetIndices.length === 0) return '';
    
    const todayIdx = today.getDay();
    let nextDayIdx = targetIndices.find(idx => idx > todayIdx);
    let daysDiff;
    if (nextDayIdx !== undefined) {
      daysDiff = nextDayIdx - todayIdx;
    } else {
      const minIdx = Math.min(...targetIndices);
      daysDiff = 7 - todayIdx + minIdx;
    }
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysDiff);
    return nextDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }
}

/**
 * 计算距离开始还有多少天
 * @param {string} startDate - program_state.start_date
 * @returns {number} 天数（负数表示已开始）
 */
function getDaysUntilStart(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((start - today) / (1000 * 60 * 60 * 24));
}

function gzclpGetSchemeText(scheme) {
  const amrapText = scheme.amrap_last ? ' (最后一组 AMRAP，即尽量多做)' : '';
  return `${scheme.sets}组 × ${scheme.reps}次${amrapText}`;
}

function gzclpGetTierProgression(exercise, history, schemes, initialWeight, increment, successThreshold, gymEquipmentConfig = null, exerciseInfo = null, unit = 'kg') {
  const defaultWeight = (initialWeight !== undefined && initialWeight !== null)
    ? Number(initialWeight)
    : 20.0;
  const step = Number(increment);

  const safeSchemes = (schemes && schemes.length > 0)
    ? schemes
    : [{ sets: 3, reps: 5, amrap_last: true }];

  const getRoundedWeight = (w) => {
    if (gymEquipmentConfig && exerciseInfo) {
      return roundExerciseWeight(w, exerciseInfo, gymEquipmentConfig, unit);
    }
    return roundWeight(w);
  };

  if (!history || history.length === 0) {
    const scheme = safeSchemes[0];
    return {
      weight_kg: getRoundedWeight(defaultWeight),
      planned_reps: scheme.reps,
      scheme_text: gzclpGetSchemeText(scheme),
      scheme_index: 0
    };
  }

  const last = history[history.length - 1];
  const lastWeight = Number(last.weight_kg);
  const lastPlannedReps = Number(last.planned_reps);
  const lastActual = Number(last.actual_last_set_reps);

  // 找到当前方案：先按 reps 匹配，匹配不到则 fallback 到第一阶段
  let currentIdx = safeSchemes.findIndex(s => s.reps === lastPlannedReps);
  if (currentIdx === -1) currentIdx = 0;
  const currentScheme = safeSchemes[currentIdx];

  let nextWeight;
  // all code paths below reassign nextIdx; initial value is a safety fallback
  let nextIdx;

  // 判断成功/失败
  // 阈值优先级：传入参数（T3 按动作自定义）> 当前方案的 success_threshold（T2 自动推导）> 无（T1 按 AMRAP）
  const effectiveThreshold = successThreshold ?? currentScheme.success_threshold;
  let success;
  if (effectiveThreshold !== undefined && effectiveThreshold !== null) {
    // T2: actual_last_set_reps = 所有组实际总次数，需 ≥ threshold
    // T3: actual_last_set_reps = 所有组最小次数，每组都必须 ≥ threshold
    success = lastActual >= effectiveThreshold;
  } else {
    // T1: actual_last_set_reps = 所有组最小次数，每组都必须 ≥ planned_reps
    success = lastActual >= lastPlannedReps;
  }

  if (success) {
    nextWeight = lastWeight + step;
    // 成功时保持当前进阶节点并增加重量
    nextIdx = currentIdx;
  } else {
    nextWeight = lastWeight;
    // 失败时推进阶段
    if (currentScheme.fail_to !== undefined && currentScheme.fail_to >= 0) {
      nextIdx = currentScheme.fail_to;
    } else if (currentScheme.fail_to === -1) {
      nextIdx = currentIdx;
    } else {
      if (safeSchemes.length > 1) {
        nextIdx = Math.min(safeSchemes.length - 1, currentIdx + 1);
      } else {
        nextIdx = currentIdx;
      }
    }
  }

  const nextScheme = safeSchemes[nextIdx] || safeSchemes[0];

  // 判定是否处于进阶链末梢且失败（Stall 标记）
  const stalled = !success && (currentScheme.fail_to === -1 || currentIdx === safeSchemes.length - 1);

  return {
    weight_kg: getRoundedWeight(nextWeight),
    planned_reps: nextScheme.reps,
    scheme_text: gzclpGetSchemeText(nextScheme),
    scheme_index: nextIdx,
    stalled
  };
}

export function applyGlobalDeloadToExercise(exObj, userProgram, exerciseInfo, gymEquipmentConfig, unit) {
  if (!exObj) return null;

  const gdState = userProgram?.program_state?.global_deload || {};
  const gdConfig = userProgram?.exercise_config?._global_deload || {};

  const isDeloadActive = gdState.status === 'active';
  let transitionScale = 1.0;
  if (gdConfig.transition_policy === 'step_up' && gdState.last_deload_completed_at) {
    const completedTime = new Date(gdState.last_deload_completed_at);
    const diffMs = new Date() - completedTime;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      transitionScale = 0.9;
    }
  }

  if (!isDeloadActive && transitionScale === 1.0) {
    return exObj;
  }

  let finalWeight = exObj.weight;
  let finalSets = exObj.sets;
  let finalReps = exObj.reps;
  let finalAmrap = exObj.amrap_last;

  // 1. Calculate weight reduction
  if (isDeloadActive) {
    const intensityPct = gdConfig.intensity_pct ?? 20;
    const scale = (100 - intensityPct) / 100;
    finalWeight = finalWeight * scale;
  } else if (transitionScale === 0.9) {
    finalWeight = finalWeight * 0.9;
  }

  // Round weight
  if (gymEquipmentConfig && exerciseInfo) {
    finalWeight = roundExerciseWeight(finalWeight, exerciseInfo, gymEquipmentConfig, unit);
  } else {
    finalWeight = roundWeight(finalWeight);
  }

  // 2. Calculate volume reduction (only during active deload)
  const isAlreadyDeloaded = exObj.scheme_text?.includes('(减量)') || exObj.scheme_text?.includes('减量');
  
  if (isDeloadActive && !isAlreadyDeloaded) {
    const volType = gdConfig.volume_type || 'subtract_sets';
    const volValue = gdConfig.volume_value ?? 2;

    if (volType === 'subtract_sets') {
      finalSets = Math.max(2, finalSets - volValue);
      finalAmrap = false;
    } else if (volType === 'scale_sets_pct') {
      finalSets = Math.max(2, Math.round(finalSets * volValue / 100));
      finalAmrap = false;
    } else if (volType === 'scale_reps_pct') {
      finalReps = Math.max(1, Math.round(finalReps * 0.5));
      finalAmrap = false;
    } else if (volType === 'none') {
      finalAmrap = false;
    }
  } else if (isDeloadActive && isAlreadyDeloaded) {
    finalAmrap = false;
  }

  const recMethod = exerciseInfo?.recording_method || exObj.recording_method || 'reps_only';
  const unitLabel = recMethod === 'duration_only' ? '秒' : recMethod === 'distance_only' ? '米' : '次';

  let suffix = '';
  if (isDeloadActive) {
    suffix = ' (减量)';
  } else if (transitionScale === 0.9) {
    suffix = ' (过渡周)';
  }

  let finalSchemeText = '';
  if (recMethod === 'duration_only') {
    finalSchemeText = `${finalSets}组 × ${finalReps}秒${suffix}`;
  } else if (recMethod === 'distance_only') {
    finalSchemeText = `${finalSets}组 × ${finalReps}米${suffix}`;
  } else {
    finalSchemeText = `${finalSets}组 × ${finalReps}${unitLabel}${suffix}`;
  }

  return {
    ...exObj,
    weight: finalWeight,
    sets: finalSets,
    reps: finalReps,
    amrap_last: finalAmrap,
    scheme_text: finalSchemeText
  };
}

export function calculateDoubleProgression(exercise, history, userEx, initialWeight, increment, gymEquipmentConfig, exerciseInfo, unit, userProgram = null) {
  const minReps = Number(userEx.min_reps) || 12;
  const maxReps = Number(userEx.max_reps) || 15;
  const targetSets = Number(userEx.sets) || 3;
  const deloadMode = userEx.deload_mode || (Number(userEx.deload_frequency) > 0 ? 'sessions' : 'none');
  const deloadValue = Number(userEx.deload_value ?? userEx.deload_frequency) || 4;
  const recMethod = exerciseInfo?.recording_method || 'standard';
  const unitLabel = recMethod === 'duration_only' ? '秒' : recMethod === 'distance_only' ? '米' : '次';

  const getRoundedWeight = (w) => {
    if (gymEquipmentConfig && exerciseInfo) {
      return roundExerciseWeight(w, exerciseInfo, gymEquipmentConfig, unit);
    }
    return roundWeight(w);
  };

  const defaultWeight = getRoundedWeight(initialWeight ?? 10);

  // Check if overall program is in deload
  const isProgramDeload = userProgram?.program_state?.is_deload ||
                          userProgram?.program_state?.deload_active ||
                          (userProgram?.program_state?.global_deload?.status === 'active') ||
                          false;

  if (!history || history.length === 0) {
    if (deloadMode === 'follow_program' && isProgramDeload) {
      return {
        weight_kg: defaultWeight,
        planned_reps: minReps,
        sets: 2,
        scheme_text: `2组 × ${minReps}${unitLabel} (减量)`,
        amrap_last: false,
        stalled: false
      };
    }
    return {
      weight_kg: defaultWeight,
      planned_reps: minReps,
      sets: targetSets,
      scheme_text: `${targetSets}组 × ${minReps}${unitLabel} (区间: ${minReps}~${maxReps})`,
      amrap_last: false,
      stalled: false
    };
  }

  const last = history[history.length - 1];
  const lastWeight = Number(last.weight_kg);
  const lastPlannedReps = Number(last.planned_reps);

  // Extract actual values for worksets
  const lastWorkSets = last.sets?.filter(s => !s.is_warmup) || [];
  let lastActual;
  if (lastWorkSets.length > 0) {
    lastActual = Math.min(...lastWorkSets.map(s => {
      if (recMethod === 'duration_only') return Number(s.duration_seconds) || 0;
      if (recMethod === 'distance_only' || recMethod === 'loaded_carry') return Number(s.distance_meters) || 0;
      return Number(s.actual_reps ?? s.planned_reps) || 0;
    }));
  } else {
    lastActual = Number(last.actual_last_set_reps) || 0;
  }

  // Check if the last workout was a deload (either programmatic or local)
  const wasLastDeload = last.sets?.length === 2 || last.scheme_text?.includes('减量');

  // Find the last non-deload session's planned reps at the current weight
  let lastRegularPlannedReps = lastPlannedReps;
  if (wasLastDeload) {
    const lastRegular = [...history].reverse().find(h => {
      const isDel = h.sets?.length === 2 || h.scheme_text?.includes('减量');
      return !isDel;
    });
    lastRegularPlannedReps = lastRegular ? Number(lastRegular.planned_reps) : minReps;
  }

  // 1. Program-level Deload Mode
  if (deloadMode === 'follow_program' && isProgramDeload) {
    return {
      weight_kg: lastWeight,
      planned_reps: minReps,
      sets: 2,
      scheme_text: `2组 × ${minReps}${unitLabel} (减量)`,
      amrap_last: false,
      stalled: false
    };
  }

  // 2. Return to regular workouts if the last session was a deload
  if (wasLastDeload) {
    return {
      weight_kg: lastWeight,
      planned_reps: lastRegularPlannedReps,
      sets: targetSets,
      scheme_text: `${targetSets}组 × ${lastRegularPlannedReps}${unitLabel} (区间: ${minReps}~${maxReps})`,
      amrap_last: false,
      stalled: false
    };
  }

  // 3. Regular progression check
  const isSuccess = lastActual >= lastPlannedReps;
  let nextWeight = lastWeight;
  let nextPlannedReps = lastPlannedReps;

  if (isSuccess) {
    if (lastPlannedReps >= maxReps) {
      nextWeight = getRoundedWeight(lastWeight + increment);
      nextPlannedReps = minReps;
    } else {
      nextPlannedReps = lastPlannedReps + 1;
    }
  } else {
    nextWeight = lastWeight;
    nextPlannedReps = lastPlannedReps;
  }

  // 4. Local Deload mode checks for the upcoming session
  if (deloadMode === 'sessions') {
    const weightHist = history.filter(h => Number(h.weight_kg) === nextWeight);
    let lastDeloadIdx = -1;
    for (let i = weightHist.length - 1; i >= 0; i--) {
      const isDel = weightHist[i].sets?.length === 2 || weightHist[i].scheme_text?.includes('减量');
      if (isDel) {
        lastDeloadIdx = i;
        break;
      }
    }
    const sessionsSinceLastDeload = weightHist.length - (lastDeloadIdx + 1);
    if (sessionsSinceLastDeload >= (deloadValue - 1)) {
      return {
        weight_kg: nextWeight,
        planned_reps: minReps,
        sets: 2,
        scheme_text: `2组 × ${minReps}${unitLabel} (减量)`,
        amrap_last: false,
        stalled: false
      };
    }
  } else if (deloadMode === 'weeks') {
    const weightHist = history.filter(h => Number(h.weight_kg) === nextWeight);
    let lastDeloadIdx = -1;
    for (let i = weightHist.length - 1; i >= 0; i--) {
      const isDel = weightHist[i].sets?.length === 2 || weightHist[i].scheme_text?.includes('减量');
      if (isDel) {
        lastDeloadIdx = i;
        break;
      }
    }
    const startSession = weightHist[lastDeloadIdx + 1];
    if (startSession && startSession.created_at) {
      const startDate = new Date(startSession.created_at);
      const now = new Date();
      const diffDays = (now - startDate) / (1000 * 60 * 60 * 24);
      if (diffDays >= (deloadValue * 7 - 0.5)) {
        return {
          weight_kg: nextWeight,
          planned_reps: minReps,
          sets: 2,
          scheme_text: `2组 × ${minReps}${unitLabel} (减量)`,
          amrap_last: false,
          stalled: false
        };
      }
    }
  }

  return {
    weight_kg: nextWeight,
    planned_reps: nextPlannedReps,
    sets: targetSets,
    scheme_text: `${targetSets}组 × ${nextPlannedReps}${unitLabel} (区间: ${minReps}~${maxReps})`,
    amrap_last: false,
    stalled: false
  };
}

/**
 * 把用户的 chain 配置 (来自 exercise_config.{lift}.{tier}_chain)
 * 转换为 engine 用的 schemes 数组
 * 自动按 reps 推导 success_threshold（reps * 2.5 圆整到 5）
 */
// 兜底：防止 config.t3_scheme 未定义时引擎崩溃
const DEFAULT_T3_SCHEME = { sets: 3, reps: 15, amrap_last: true, success_threshold: 25 };

function userChainToSchemes(chain) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  return chain.map((stage, i) => {
    const reps = Number(stage.reps) || 0;
    const sets = Number(stage.sets) || 3;
    return {
      sets,
      reps,
      amrap_last: !!stage.amrap,
      // T2 链自动推导：reps * 2.5，圆整到 5
      success_threshold: Math.round((reps * 2.5) / 5) * 5,
      // 末阶段用 -1 表示「失败时保持」，否则链中失败时前进到下一阶段
      fail_to: i < chain.length - 1 ? i + 1 : -1,
    };
  });
}

function getWarmupSets(exKey, workingWeight, userExConfig, gymEquipmentConfig, exerciseInfo, unit) {
  if (!userExConfig?.warmup_enabled) return null;
  
  const getRoundedWeight = (w) => {
    if (gymEquipmentConfig && exerciseInfo) {
      return roundExerciseWeight(w, exerciseInfo, gymEquipmentConfig, unit);
    }
    return roundWeight(w);
  };

  const sets = userExConfig.warmup_sets && userExConfig.warmup_sets.length > 0
    ? userExConfig.warmup_sets
    : [{ pct: 50, reps: 5 }, { pct: 75, reps: 3 }]; // 默认 50% 5次，75% 3次

  return sets.map(s => ({
    weight: getRoundedWeight(workingWeight * (Number(s.pct || 50) / 100)),
    reps: Number(s.reps || 5),
    is_warmup: true
  }));
}

/**
 * 共享的 T1/T2 动作处理逻辑 — 消除 gzclpGetNextWorkout 中 ~20 行的重复代码
 * @param {'T1'|'T2'} tier
 * @returns {Object} exercises.push-ready 训练动作对象
 */
function processTierExercise(tier, ex, historyByExerciseTier, exConfig, config,
  gymEquipmentConfig, exercisesMap, unit, _getWarmupSets, _gzclpGetTierProgression, userProgram = null) {
  const hist = (historyByExerciseTier[ex] && historyByExerciseTier[ex][tier]) || [];
  const userEx = exConfig[ex] || {};
  const exUnit = userEx.unit || unit || 'kg';
  // 优先使用用户自定义 chain，fallback 到程序默认
  const chainKey = tier === 'T1' ? 't1_chain' : 't2_chain';
  const schemeKey = tier === 'T1' ? 't1_schemes' : 't2_schemes';
  const userSchemes = userChainToSchemes(userEx[chainKey]);
  const schemes = userSchemes || config[schemeKey];

  let weightVal;
  let schemeIdx;
  let needsRetest = false;

  const progState = userProgram?.program_state?.exercises?.[ex]?.[tier];
  if (progState && progState.weight !== undefined) {
    weightVal = Number(progState.weight);
    schemeIdx = Number(progState.scheme_index ?? 0);
    needsRetest = progState.status === 'needs_retest';
  } else {
    // 降级使用原有历史反推计算
    const initWeight = tier === 'T1'
      ? (userEx.initial_weight_t1 ?? userEx.initial_weight ?? config.default_weights?.[ex])
      : (userEx.initial_weight_t2 ?? userEx.initial_weight ?? config.default_weights?.[ex]);
    const incrKey = tier === 'T1' ? 'increment_t1' : 'increment_t2';
    const incrDefault = config.default_increment?.[tier] ?? 2.5;
    const incr = (userEx[incrKey]) ?? incrDefault;

    const result = _gzclpGetTierProgression(ex, hist, schemes, initWeight, incr, null, gymEquipmentConfig, exercisesMap[ex], exUnit);
    weightVal = result.weight_kg;
    schemeIdx = result.scheme_index;
    needsRetest = !!result.stalled;
  }

  const activeScheme = schemes[schemeIdx] || schemes[0];

  return {
    exercise: ex,
    tier,
    sets: activeScheme.sets,
    reps: activeScheme.reps,
    weight: weightVal,
    scheme_text: gzclpGetSchemeText(activeScheme),
    amrap_last: activeScheme.amrap_last,
    needs_retest: needsRetest,
    warmup_sets: _getWarmupSets(ex, weightVal, userEx, gymEquipmentConfig, exercisesMap[ex], exUnit)
  };
}

function gzclpGetNextWorkout(config, userProgram, historyByExerciseTier, gymEquipmentConfig = null, exercisesMap = {}) {
  const state = userProgram.program_state || {};
  const exConfig = userProgram.exercise_config || {};
  const schedule = userProgram.schedule || {};
  const effectiveDayMap = userProgram.day_map || config.day_map;
  const currentDay = state.current_day || Object.keys(effectiveDayMap)[0];
  const dayConfig = effectiveDayMap[currentDay];
  const lastTrainingDate = state.last_training_date || null;
  const unit = exConfig._unit || 'kg';

  if (!dayConfig) return { exercises: [], dayLabel: currentDay, error: `未知训练日: ${currentDay}` };

  const exercises = [];

  // 1. 练前热身动作 (Prepend)
  const todayWarmups = dayConfig.warmup || [];
  todayWarmups.forEach(w => {
    exercises.push({
      exercise: w.exercise,
      tier: 'warmup',
      sets: w.sets || 2,
      reps: w.reps || 10,
      weight: 0,
      recording_method: w.recording_method || exercisesMap[w.exercise]?.recording_method || 'reps_only',
      scheme_text: w.recording_method === 'duration_only' ? `${w.sets}组 × ${w.reps}秒` : `${w.sets}组 × ${w.reps}次`,
      amrap_last: false
    });
  });

  // T1
  if (dayConfig.T1) {
    const exObj = processTierExercise('T1', dayConfig.T1, historyByExerciseTier, exConfig, config,
      gymEquipmentConfig, exercisesMap, unit, getWarmupSets, gzclpGetTierProgression, userProgram);
    exercises.push(applyGlobalDeloadToExercise(exObj, userProgram, exercisesMap[dayConfig.T1], gymEquipmentConfig, unit));
  }

  // T2
  if (dayConfig.T2) {
    const exObj = processTierExercise('T2', dayConfig.T2, historyByExerciseTier, exConfig, config,
      gymEquipmentConfig, exercisesMap, unit, getWarmupSets, gzclpGetTierProgression, userProgram);
    exercises.push(applyGlobalDeloadToExercise(exObj, userProgram, exercisesMap[dayConfig.T2], gymEquipmentConfig, unit));
  }

  // T3
  if (dayConfig.T3) {
    const t3Exercises = Array.isArray(dayConfig.T3) ? dayConfig.T3 : [dayConfig.T3];
    const scheme = config.t3_scheme || DEFAULT_T3_SCHEME;
    for (const ex of t3Exercises) {
      const hist = (historyByExerciseTier[ex] && historyByExerciseTier[ex]['T3']) || [];
      const userEx = exConfig[ex] || {};
      const exUnit = userEx.unit || unit || 'kg';
      const initWeight = userEx.initial_weight ?? config.default_weights?.[ex] ?? 10;
      const incr = userEx.increment_t3 ?? config.default_increment?.['T3'] ?? 2.5;

      const isDoubleProg = userEx.progression_type === 'double_progression';
      const progState = userProgram?.program_state?.exercises?.[ex]?.['T3'];
      let targetSets = scheme.sets;
      let amrapLast = scheme.amrap_last;
      let plannedReps = scheme.reps;
      let weightVal;
      let needsRetest = false;

      if (progState && progState.weight !== undefined) {
        weightVal = Number(progState.weight);
        plannedReps = Number(progState.planned_reps ?? scheme.reps);
        targetSets = Number(progState.sets ?? scheme.sets);
        needsRetest = progState.status === 'needs_retest';
      } else {
        if (isDoubleProg) {
          const result = calculateDoubleProgression(ex, hist, userEx, initWeight, incr, gymEquipmentConfig, exercisesMap[ex], exUnit, userProgram);
          targetSets = result.sets;
          amrapLast = result.amrap_last;
          weightVal = result.weight_kg;
          plannedReps = result.planned_reps;
          needsRetest = !!result.stalled;
        } else {
          const threshold = userEx.target_reps ?? scheme.success_threshold ?? 25;
          const result = gzclpGetTierProgression(ex, hist, [scheme], initWeight, incr, threshold, gymEquipmentConfig, exercisesMap[ex], exUnit);
          weightVal = result.weight_kg;
          plannedReps = result.planned_reps;
          needsRetest = !!result.stalled;
        }
      }

      const t3RecordingMethod = exercisesMap[ex]?.recording_method || 'standard';
      const schemeText = t3RecordingMethod === 'duration_only' && !isDoubleProg
        ? `${targetSets}组 × ${plannedReps}秒`
        : t3RecordingMethod === 'distance_only' && !isDoubleProg
          ? `${targetSets}组 × ${plannedReps}米`
          : isDoubleProg
            ? `${targetSets}组 × ${plannedReps}次 (区间: ${userEx.min_reps || 12}~${userEx.max_reps || 15})`
            : `${targetSets}组 × ${plannedReps}次${amrapLast ? ' (最后一组 AMRAP，即尽量多做)' : ''}`;

      const exObj = {
        exercise: ex,
        tier: 'T3',
        sets: targetSets,
        reps: plannedReps,
        weight: weightVal,
        scheme_text: schemeText,
        amrap_last: amrapLast,
        needs_retest: needsRetest,
        recording_method: t3RecordingMethod
      };
      exercises.push(applyGlobalDeloadToExercise(exObj, userProgram, exercisesMap[ex], gymEquipmentConfig, unit));
    }
  }

  // 3. 练后拉伸动作 (Append)
  const todayStretching = dayConfig.stretching || [];
  todayStretching.forEach(s => {
    exercises.push({
      exercise: s.exercise,
      tier: 'stretching',
      sets: s.sets || 2,
      reps: s.reps || 30,
      weight: 0,
      recording_method: s.recording_method || exercisesMap[s.exercise]?.recording_method || 'duration_only',
      scheme_text: s.recording_method === 'duration_only' ? `${s.sets}组 × ${s.reps}秒` : `${s.sets}组 × ${s.reps}次`,
      amrap_last: false
    });
  });

  return {
    exercises,
    dayLabel: currentDay,
    nextDay: gzclpGetNextDay(config, currentDay, schedule, lastTrainingDate, state.start_date)
  };
}

/** @deprecated 当前未被调用，保留供将来独立进阶计算场景使用 */
function gzclpCalculateProgression(config, userProgram, exercise, tier, completedSets) {
  const scheme = tier === 'T1' ? config.t1_schemes
    : tier === 'T2' ? config.t2_schemes
    : [config.t3_scheme];
  const schemes = Array.isArray(scheme) ? scheme : [scheme];

  const lastSet = completedSets[completedSets.length - 1];
  const plannedReps = lastSet.planned_reps;
  const actualReps = lastSet.actual_reps;

  let currentIdx = schemes.findIndex(s => s.reps === plannedReps);
  if (currentIdx === -1) currentIdx = 0;
  const currentScheme = schemes[currentIdx];

  let success;
  if (tier === 'T1') {
    success = actualReps >= plannedReps;
  } else {
    const totalReps = (plannedReps * 2) + actualReps;
    const threshold = currentScheme.success_threshold || 25;
    success = totalReps >= threshold;
  }

  let nextIdx;
  if (success) {
    nextIdx = 0;
  } else if (currentScheme.fail_to !== undefined && currentScheme.fail_to >= 0) {
    nextIdx = currentScheme.fail_to;
  } else {
    nextIdx = currentIdx;
  }

  return {
    success,
    scheme_index: nextIdx,
    nextScheme: schemes[nextIdx]
  };
}

// ==================== Starting Strength 引擎（占位）====================

function ssGetNextWorkout(config, userProgram, _historyByExerciseTier) {
  void _historyByExerciseTier; // 统一接口签名，SS 引擎暂不使用历史数据
  const state = userProgram.program_state || {};
  const lastWorkout = state.last_workout || null;
  const cycleLength = config.cycle_length || 2;
  const effectiveDayMap = userProgram.day_map || config.day_map;
  const dayKeys = Object.keys(effectiveDayMap);

  let nextDayIdx;
  if (!lastWorkout) {
    nextDayIdx = 0;
  } else {
    const lastIdx = dayKeys.indexOf(lastWorkout);
    nextDayIdx = lastIdx >= 0 ? (lastIdx + 1) % cycleLength : 0;
  }
  const nextDay = dayKeys[nextDayIdx];
  const dayExercises = effectiveDayMap[nextDay] || [];

  const exercises = dayExercises.map(def => ({
    exercise: def.exercise,
    tier: null,
    sets: def.sets,
    reps: def.reps,
    weight: userProgram.exercise_config?.[def.exercise]?.initial_weight
      ?? config.default_weights?.[def.exercise]
      ?? 20,
    scheme_text: `${def.sets}组 × ${def.reps}次`,
    amrap_last: false
  }));

  return {
    exercises,
    dayLabel: nextDay,
    nextDay: dayKeys[(nextDayIdx + 1) % cycleLength],
    note: 'Starting Strength 进阶逻辑待实现'
  };
}

// ==================== 统一入口 ====================

const engines = {
  gzclp: {
    getNextWorkout: gzclpGetNextWorkout,
    calculateProgression: gzclpCalculateProgression,
    getNextDay: gzclpGetNextDay
  },
  starting_strength: {
    getNextWorkout: ssGetNextWorkout,
    calculateProgression: () => ({ success: true, note: 'SS 进阶逻辑待实现' }),
    getNextDay: (config, lastDay) => {
      const keys = Object.keys(config.day_map);
      if (!lastDay) return keys[0];
      const idx = keys.indexOf(lastDay);
      return idx >= 0 ? keys[(idx + 1) % keys.length] : keys[0];
    }
  }
};

export function getEngine(engineType) {
  return engines[engineType] || null;
}

export function getNextWorkout(program, userProgram, historyByExerciseTier, gymEquipmentConfig = null, exercisesMap = {}) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return { exercises: [], dayLabel: 'unknown', error: `未知引擎: ${program.config?.engine_type}` };
  return engine.getNextWorkout(program.config, userProgram, historyByExerciseTier, gymEquipmentConfig, exercisesMap);
}

export function calculateProgression(program, userProgram, exercise, tier, completedSets) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return { success: false, error: `未知引擎` };
  return engine.calculateProgression(program.config, userProgram, exercise, tier, completedSets);
}

export function getNextDay(program, lastDay, schedule, lastTrainingDate, startDate) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return 'Day1';
  return engine.getNextDay(program.config, lastDay, schedule, lastTrainingDate, startDate);
}

export function gzclpCalculateNextProgressionState(config, userProgram, todayWorkout, completedSetsData, historyByExerciseTier, gymEquipmentConfig = null, exercisesMap = {}) {
  const state = userProgram.program_state || {};
  const exConfig = userProgram.exercise_config || {};
  const unit = exConfig._unit || 'kg';
  const isDeloadActive = state.global_deload?.status === 'active';

  const nextExercises = { ...(state.exercises || {}) };

  (todayWorkout?.exercises || []).forEach((tierEx, exIdx) => {
    const ex = tierEx.exercise;
    const tier = tierEx.tier;
    if (tier === 'warmup' || tier === 'stretching') return;

    const sets = completedSetsData[exIdx] || [];
    if (sets.length === 0) return;

    if (!nextExercises[ex]) nextExercises[ex] = {};
    const prevExState = nextExercises[ex][tier] || {};
    const prevMajorCycle = prevExState.major_cycle ?? 1;

    // 1. 如果是减载日，不推进常规进度，保留原值
    if (isDeloadActive) {
      nextExercises[ex][tier] = {
        weight: prevExState.weight ?? tierEx.weight,
        scheme_index: prevExState.scheme_index ?? 0,
        status: prevExState.status ?? 'active',
        major_cycle: prevMajorCycle
      };
      if (tier === 'T3') {
        const userEx = exConfig[ex] || {};
        const isDoubleProg = userEx.progression_type === 'double_progression';
        if (isDoubleProg) {
          nextExercises[ex][tier].planned_reps = prevExState.planned_reps ?? tierEx.reps;
          nextExercises[ex][tier].sets = prevExState.sets ?? tierEx.sets;
        }
      }
      return;
    }

    // 2. 如果当前是极限重测状态，重测完成后将进入新周期
    if (tierEx.needs_retest) {
      const testSet = sets[sets.length - 1] || {};
      const newStartWeight = Number(testSet.weight_kg) || tierEx.weight;

      nextExercises[ex][tier] = {
        weight: newStartWeight,
        scheme_index: 0, // 重置回进阶链第0节点
        status: 'active', // 重测完成，恢复常规进阶
        major_cycle: prevMajorCycle + 1 // 大轮次加1
      };
      
      if (tier === 'T3') {
        const userEx = exConfig[ex] || {};
        nextExercises[ex][tier].planned_reps = userEx.min_reps ?? 12;
        nextExercises[ex][tier].sets = userEx.sets ?? 3;
      }
      return;
    }

    // 3. 常规进阶计算
    const userEx = exConfig[ex] || {};
    const exUnit = userEx.unit || unit || 'kg';
    const workSets = sets.filter(s => !s.is_warmup);

    const getFinalReps = (setObj) => {
      if (setObj.actual_reps === '' || setObj.actual_reps === undefined) return setObj.planned_reps;
      return parseInt(setObj.actual_reps, 10);
    };

    let actualLastReps = 0;
    if (tier === 'T2') {
      actualLastReps = workSets.reduce((sum, s) => sum + getFinalReps(s), 0);
    } else {
      actualLastReps = workSets.length > 0 ? Math.min(...workSets.map(s => getFinalReps(s))) : 0;
    }

    const lastSet = sets[sets.length - 1];
    const completedWeight = (lastSet && lastSet.weight_kg !== undefined && lastSet.weight_kg !== '') ? Number(lastSet.weight_kg) : tierEx.weight;

    const newHistoryRow = {
      weight_kg: completedWeight,
      planned_reps: tierEx.reps,
      actual_last_set_reps: actualLastReps,
      sets: workSets.map(s => ({
        is_warmup: false,
        planned_reps: s.planned_reps,
        actual_reps: getFinalReps(s),
        weight_kg: s.weight_kg !== undefined && s.weight_kg !== '' ? Number(s.weight_kg) : completedWeight
      }))
    };

    const hist = [...(historyByExerciseTier[ex]?.[tier] || []), newHistoryRow];

    if (tier === 'T1' || tier === 'T2') {
      const chainKey = tier === 'T1' ? 't1_chain' : 't2_chain';
      const schemeKey = tier === 'T1' ? 't1_schemes' : 't2_schemes';
      const userSchemes = userChainToSchemes(userEx[chainKey]);
      const schemes = userSchemes || config[schemeKey];

      const initWeight = tier === 'T1'
        ? (userEx.initial_weight_t1 ?? userEx.initial_weight ?? config.default_weights?.[ex])
        : (userEx.initial_weight_t2 ?? userEx.initial_weight ?? config.default_weights?.[ex]);
      const incrKey = tier === 'T1' ? 'increment_t1' : 'increment_t2';
      const incrDefault = config.default_increment?.[tier] ?? 2.5;
      const incr = (userEx[incrKey]) ?? incrDefault;

      const result = gzclpGetTierProgression(ex, hist, schemes, initWeight, incr, null, gymEquipmentConfig, exercisesMap[ex], exUnit);

      nextExercises[ex][tier] = {
        weight: result.weight_kg,
        scheme_index: result.scheme_index,
        status: result.stalled ? 'needs_retest' : 'active',
        major_cycle: prevMajorCycle
      };
    } else if (tier === 'T3') {
      const initWeight = userEx.initial_weight ?? config.default_weights?.[ex] ?? 10;
      const incr = userEx.increment_t3 ?? config.default_increment?.['T3'] ?? 2.5;
      const isDoubleProg = userEx.progression_type === 'double_progression';

      if (isDoubleProg) {
        const result = calculateDoubleProgression(ex, hist, userEx, initWeight, incr, gymEquipmentConfig, exercisesMap[ex], exUnit, userProgram);
        nextExercises[ex][tier] = {
          weight: result.weight_kg,
          planned_reps: result.planned_reps,
          sets: result.sets,
          status: result.stalled ? 'needs_retest' : 'active',
          major_cycle: prevMajorCycle
        };
      } else {
        const scheme = config.t3_scheme || DEFAULT_T3_SCHEME;
        const threshold = userEx.target_reps ?? scheme.success_threshold ?? 25;
        const result = gzclpGetTierProgression(ex, hist, [scheme], initWeight, incr, threshold, gymEquipmentConfig, exercisesMap[ex], exUnit);
        nextExercises[ex][tier] = {
          weight: result.weight_kg,
          planned_reps: result.planned_reps,
          sets: scheme.sets,
          status: result.stalled ? 'needs_retest' : 'active',
          major_cycle: prevMajorCycle
        };
      }
    }
  });

  return nextExercises;
}

export { isTodayTrainingDay, getNextTrainingDate, getDaysUntilStart };
