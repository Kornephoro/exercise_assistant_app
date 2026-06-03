/**
 * 参数化训练计划引擎
 * 根据 programs.config JSONB 配置计算今日训练和进阶结果
 * 支持 GZCLP（完整）和 Starting Strength（占位）
 */

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
function gzclpGetNextDay(config, lastDay, schedule, lastTrainingDate) {
  const days = Object.keys(config.day_map);
  if (!lastDay || !days.includes(lastDay)) return days[0];

  const scheduleType = schedule?.scheduleType || 'weekly';

  if (scheduleType === 'custom-ratio') {
    // 练 N 休 M 轮转模式
    const trainDays = schedule?.trainDays || 1;
    const restDays = schedule?.restDays || 1;
    const cycleLength = trainDays + restDays;

    // 计算从上次训练到今天经过了多少天
    if (lastTrainingDate) {
      const lastDate = new Date(lastTrainingDate);
      const today = new Date();
      lastDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (daysSinceLast > 0) {
        // 计算应该前进多少个训练日
        // 每 (trainDays + restDays) 天完成一个完整轮转
        const totalCycleDays = trainDays + restDays;
        const cyclesCompleted = Math.floor(daysSinceLast / totalCycleDays);
        const remainingDays = daysSinceLast % totalCycleDays;

        // 计算当前在轮转中的位置
        const lastDayIdx = days.indexOf(lastDay);
        let currentIdx = lastDayIdx;

        // 根据剩余天数推进
        for (let i = 0; i < remainingDays; i++) {
          // 判断当前是训练日还是休息日
          const positionInCycle = (lastDayIdx + i) % totalCycleDays;
          if (positionInCycle < trainDays) {
            // 这是训练日，推进到下一个训练日
            currentIdx = (currentIdx + 1) % days.length;
          }
          // 休息日不推进训练日索引
        }

        return days[currentIdx];
      }
    }

    // 默认：简单轮转（不考虑日期）
    const lastDayIdx = days.indexOf(lastDay);
    const positionInCycle = lastDayIdx % (trainDays + restDays);
    if (positionInCycle < trainDays - 1) {
      // 还在训练日内，推进到下一个训练日
      return days[(lastDayIdx + 1) % days.length];
    } else {
      // 训练日结束，需要跳过休息日
      const skipDays = restDays;
      return days[(lastDayIdx + skipDays + 1) % days.length];
    }
  } else {
    // 每周固定几天模式（原有逻辑）
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
    const todayWeekday = weekdaysEng[today.getDay()];
    const targetIndices = trainingDays.map(day => weekdaysEng.indexOf(day)).filter(idx => idx !== -1);
    if (targetIndices.length === 0) return '';
    
    const todayIdx = today.getDay();
    let nextDayIdx = targetIndices.find(idx => idx > todayIdx);
    let daysDiff = 0;
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

function gzclpGetTierProgression(exercise, history, schemes, initialWeight, increment, successThreshold) {
  const defaultWeight = (initialWeight !== undefined && initialWeight !== null)
    ? Number(initialWeight)
    : 20.0;
  const step = Number(increment);

  if (!history || history.length === 0) {
    const scheme = schemes[0];
    return {
      weight_kg: roundWeight(defaultWeight),
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
  let currentIdx = schemes.findIndex(s => s.reps === lastPlannedReps);
  if (currentIdx === -1) currentIdx = 0;
  const currentScheme = schemes[currentIdx];

  let nextWeight = lastWeight;
  let nextIdx = currentIdx;

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
    // 成功：回到 chain 的第一个阶段（基础阶段最重，但要先累积信心）
    // 原逻辑：成功时 nextIdx = 0 (从最低 reps 重新开始)
    nextIdx = 0;
  } else {
    nextWeight = lastWeight;
    // 失败：前进到下一阶段（更高 reps + 减重 + 保持重量）
    // 如果有 fail_to 且 >= 0：跳到该阶段
    // 如果有 fail_to === -1：保持当前阶段
    if (currentScheme.fail_to !== undefined && currentScheme.fail_to >= 0) {
      nextIdx = currentScheme.fail_to;
    } else if (currentScheme.fail_to === -1) {
      // 已经是最后方案，保持不变
      nextIdx = currentIdx;
    } else {
      // 自定义 chain 没有 fail_to 字段：失败时前进到 chain 下一阶段，末阶段循环
      if (schemes.length > 1) {
        nextIdx = (currentIdx + 1) % schemes.length;
      }
    }
  }

  const nextScheme = schemes[nextIdx];

  return {
    weight_kg: roundWeight(nextWeight),
    planned_reps: nextScheme.reps,
    scheme_text: gzclpGetSchemeText(nextScheme),
    scheme_index: nextIdx
  };
}

/**
 * 把用户的 chain 配置 (来自 exercise_config.{lift}.{tier}_chain)
 * 转换为 engine 用的 schemes 数组
 * 自动按 reps 推导 success_threshold（reps * 2.5 圆整到 5）
 */
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

function gzclpGetNextWorkout(config, userProgram, historyByExerciseTier) {
  const state = userProgram.program_state || {};
  const exConfig = userProgram.exercise_config || {};
  const schedule = userProgram.schedule || {};
  const effectiveDayMap = userProgram.day_map || config.day_map;
  const currentDay = state.current_day || Object.keys(effectiveDayMap)[0];
  const dayConfig = effectiveDayMap[currentDay];
  const lastTrainingDate = state.last_training_date || null;

  if (!dayConfig) return { exercises: [], dayLabel: currentDay, error: `未知训练日: ${currentDay}` };

  const exercises = [];

  // T1
  if (dayConfig.T1) {
    const ex = dayConfig.T1;
    const hist = (historyByExerciseTier[ex] && historyByExerciseTier[ex]['T1']) || [];
    const userEx = exConfig[ex] || {};
    const initWeight = userEx.initial_weight ?? config.default_weights?.[ex];
    const incr = userEx.increment_t1 ?? config.default_increment?.['T1'] ?? 2.5;
    // 优先使用用户自定义 chain，fallback 到程序默认
    const userSchemes = userChainToSchemes(userEx.t1_chain);
    const schemes = userSchemes || config.t1_schemes;
    const result = gzclpGetTierProgression(ex, hist, schemes, initWeight, incr, null);

    exercises.push({
      exercise: ex,
      tier: 'T1',
      sets: schemes[result.scheme_index].sets,
      reps: result.planned_reps,
      weight: result.weight_kg,
      scheme_text: result.scheme_text,
      amrap_last: schemes[result.scheme_index].amrap_last
    });
  }

  // T2
  if (dayConfig.T2) {
    const ex = dayConfig.T2;
    const hist = (historyByExerciseTier[ex] && historyByExerciseTier[ex]['T2']) || [];
    const userEx = exConfig[ex] || {};
    const initWeight = userEx.initial_weight ?? config.default_weights?.[ex];
    const incr = userEx.increment_t2 ?? config.default_increment?.['T2'] ?? 2.5;
    // 优先使用用户自定义 chain，fallback 到程序默认
    const userSchemes = userChainToSchemes(userEx.t2_chain);
    const schemes = userSchemes || config.t2_schemes;
    // 不传 threshold，让 gzclpGetTierProgression 从当前方案的 success_threshold 自动推导
    const result = gzclpGetTierProgression(ex, hist, schemes, initWeight, incr, null);

    exercises.push({
      exercise: ex,
      tier: 'T2',
      sets: schemes[result.scheme_index].sets,
      reps: result.planned_reps,
      weight: result.weight_kg,
      scheme_text: result.scheme_text,
      amrap_last: schemes[result.scheme_index].amrap_last
    });
  }

  // T3
  if (dayConfig.T3) {
    const t3Exercises = Array.isArray(dayConfig.T3) ? dayConfig.T3 : [dayConfig.T3];
    for (const ex of t3Exercises) {
      const hist = (historyByExerciseTier[ex] && historyByExerciseTier[ex]['T3']) || [];
      const userEx = exConfig[ex] || {};
      const initWeight = userEx.initial_weight ?? config.default_weights?.[ex] ?? 10;
      const incr = userEx.increment_t3 ?? config.default_increment?.['T3'] ?? 2.5;
      const threshold = userEx.target_reps ?? config.t3_scheme?.success_threshold ?? 25;
      const scheme = config.t3_scheme;
      const result = gzclpGetTierProgression(ex, hist, [scheme], initWeight, incr, threshold);

      exercises.push({
        exercise: ex,
        tier: 'T3',
        sets: scheme.sets,
        reps: result.planned_reps,
        weight: result.weight_kg,
        scheme_text: result.scheme_text,
        amrap_last: scheme.amrap_last
      });
    }
  }

  return {
    exercises,
    dayLabel: currentDay,
    nextDay: gzclpGetNextDay(config, currentDay, schedule, lastTrainingDate)
  };
}

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

function ssGetNextWorkout(config, userProgram, historyByExercise) {
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
    getNextDay: (config, lastDay, schedule, lastTrainingDate) => {
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

export function getNextWorkout(program, userProgram, historyByExerciseTier) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return { exercises: [], dayLabel: 'unknown', error: `未知引擎: ${program.config?.engine_type}` };
  return engine.getNextWorkout(program.config, userProgram, historyByExerciseTier);
}

export function calculateProgression(program, userProgram, exercise, tier, completedSets) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return { success: false, error: `未知引擎` };
  return engine.calculateProgression(program.config, userProgram, exercise, tier, completedSets);
}

export function getNextDay(program, lastDay, schedule, lastTrainingDate) {
  const engine = engines[program.config?.engine_type];
  if (!engine) return 'Day1';
  return engine.getNextDay(program.config, lastDay, schedule, lastTrainingDate);
}

export { isTodayTrainingDay, getNextTrainingDate, getDaysUntilStart };
