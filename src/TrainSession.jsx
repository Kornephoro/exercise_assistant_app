import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Minimize2, X, Check, Sparkles, SkipForward, Plus, FastForward, Dumbbell, Calculator } from 'lucide-react';
import { convertWeight, getBarbellPlateBreakdown, toStorageWeight } from './unitUtils';
import BarbellVisualizer from './BarbellVisualizer';
import { fetchLatestOneRmForExercises } from './services/workoutService';

const DEFAULT_REST_SECONDS = 90;

const TEMPO_PRESETS = [
  { label: '标准', values: [3, 1, 1, 0] },
  { label: '慢速离心', values: [4, 2, 1, 0] },
  { label: '爆发向心', values: [2, 0, 1, 0] },
  { label: '等长收缩', values: [3, 3, 1, 1] },
  { label: '自定义', values: null },
];

const TEMPO_LABELS = ['离心', '底部', '向心', '顶部'];

const RPE_PERCENTAGE_CHART = {
  1:  { 10: 1.0,   9.5: 0.978, 9: 0.955, 8.5: 0.939, 8: 0.922, 7.5: 0.907, 7: 0.892, 6.5: 0.878, 6: 0.864 },
  2:  { 10: 0.955, 9.5: 0.939, 9: 0.922, 8.5: 0.907, 8: 0.892, 7.5: 0.878, 7: 0.864, 6.5: 0.850, 6: 0.837 },
  3:  { 10: 0.922, 9.5: 0.907, 9: 0.892, 8.5: 0.878, 8: 0.864, 7.5: 0.850, 7: 0.837, 6.5: 0.824, 6: 0.811 },
  4:  { 10: 0.892, 9.5: 0.878, 9: 0.864, 8.5: 0.850, 8: 0.837, 7.5: 0.824, 7: 0.811, 6.5: 0.798, 6: 0.786 },
  5:  { 10: 0.863, 9.5: 0.850, 9: 0.837, 8.5: 0.824, 8: 0.811, 7.5: 0.799, 7: 0.786, 6.5: 0.774, 6: 0.762 },
  6:  { 10: 0.837, 9.5: 0.824, 9: 0.811, 8.5: 0.799, 8: 0.786, 7.5: 0.774, 7: 0.762, 6.5: 0.751, 6: 0.739 },
  7:  { 10: 0.811, 9.5: 0.799, 9: 0.786, 8.5: 0.774, 8: 0.762, 7.5: 0.751, 7: 0.739, 6.5: 0.723, 6: 0.707 },
  8:  { 10: 0.786, 9.5: 0.774, 9: 0.762, 8.5: 0.751, 8: 0.739, 7.5: 0.723, 7: 0.707, 6.5: 0.694, 6: 0.680 },
  9:  { 10: 0.762, 9.5: 0.751, 9: 0.739, 8.5: 0.723, 8: 0.707, 7.5: 0.694, 7: 0.680, 6.5: 0.667, 6: 0.653 },
  10: { 10: 0.739, 9.5: 0.723, 9: 0.707, 8.5: 0.694, 8: 0.680, 7.5: 0.667, 7: 0.653, 6.5: 0.640, 6: 0.626 },
  11: { 10: 0.707, 9.5: 0.694, 9: 0.680, 8.5: 0.667, 8: 0.653, 7.5: 0.640, 7: 0.626, 6.5: 0.613, 6: 0.599 },
  12: { 10: 0.680, 9.5: 0.667, 9: 0.653, 8.5: 0.640, 8: 0.626, 7.5: 0.613, 7: 0.599, 6.5: 0.586, 6: 0.573 }
};

// 水平循环滚动对齐选择器
function InfiniteScrollPicker({ options, value, onChange, label }) {
  const containerRef = useRef(null);
  const isTeleportingRef = useRef(false);
  const lastSelectedValueRef = useRef(value);

  // We repeat the options array 9 times to create an infinite scroll illusion.
  const repeatCount = 9;
  const repeatedOptions = useMemo(() => {
    let arr = [];
    for (let i = 0; i < repeatCount; i++) {
      arr = arr.concat(options);
    }
    return arr;
  }, [options]);

  const scrollToValue = (val, smooth = false) => {
    const container = containerRef.current;
    if (!container) return;
    const L = options.length;
    const itemIndex = options.indexOf(val);
    if (itemIndex === -1) return;
    const targetIndex = 4 * L + itemIndex;
    const children = container.children;
    const targetChild = children[targetIndex];
    if (targetChild) {
      const itemOffsetLeft = targetChild.offsetLeft;
      const itemWidth = targetChild.offsetWidth;
      const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;
      container.scrollTo({
        left: newScrollLeft,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  useEffect(() => {
    let timer;
    const align = () => {
      scrollToValue(value, false);
      lastSelectedValueRef.current = value;
    };
    align();
    timer = setTimeout(align, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (value !== lastSelectedValueRef.current) {
      scrollToValue(value, false);
      lastSelectedValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = () => {
    if (isTeleportingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let minDistance = Infinity;
    let closestIndex = -1;

    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      const childCenter = childRect.left + childRect.width / 2;
      const distance = Math.abs(childCenter - containerCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1) {
      const val = options[closestIndex % options.length];
      if (val !== undefined && val !== value) {
        lastSelectedValueRef.current = val;
        onChange(val);
      }

      const L = options.length;
      const activeCopy = Math.floor(closestIndex / L);
      if (activeCopy < 3 || activeCopy > 5) {
        const targetIndex = 4 * L + (closestIndex % L);
        const targetChild = children[targetIndex];
        if (targetChild) {
          const itemOffsetLeft = targetChild.offsetLeft;
          const itemWidth = targetChild.offsetWidth;
          const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;

          isTeleportingRef.current = true;
          container.scrollLeft = newScrollLeft;
          requestAnimationFrame(() => {
            setTimeout(() => {
              isTeleportingRef.current = false;
            }, 50);
          });
        }
      }
    }
  };

  const handleItemClick = (index, val) => {
    const container = containerRef.current;
    if (!container) return;
    const children = container.children;
    const targetChild = children[index];
    if (targetChild) {
      const itemOffsetLeft = targetChild.offsetLeft;
      const itemWidth = targetChild.offsetWidth;
      const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;
      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
      lastSelectedValueRef.current = val;
      onChange(val);
    }
  };

  const scrollbarHideStyle = `
    .scrollbar-none::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-none {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;

  return (
    <div className="flex flex-col gap-1 w-full">
      <style>{scrollbarHideStyle}</style>
      <span className="text-[10px] text-base-content/60 font-bold pl-1">
        {label}
      </span>
      <div className="relative w-full flex items-center bg-base-200/50 border border-base-300 rounded-xl h-12 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-primary/30 pointer-events-none z-10" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-base-100/40 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-base-100/40 to-transparent pointer-events-none z-10" />
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="scrollbar-none w-full h-full flex items-center gap-2 overflow-x-auto snap-x snap-mandatory"
          style={{ paddingLeft: 'calc(50% - 20px)', paddingRight: 'calc(50% - 20px)' }}
        >
          {repeatedOptions.map((opt, i) => {
            const isActive = opt === value;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleItemClick(i, opt)}
                className={`snap-center shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono text-sm transition-all cursor-pointer border-0 ${
                  isActive
                    ? 'bg-primary text-primary-content scale-110 shadow-md ring-2 ring-primary/20'
                    : 'text-base-content/60 hover:text-base-content hover:bg-base-200 bg-transparent'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ FIELD INPUT GROUP (hoisted outside) ============
const FieldInput = ({ kind, value, onChange, placeholder = '' }) => {
  const isInt = kind === 'reps' || kind === 'duration';
  const maxLen = { reps: 4, duration: 4, weight: 5, distance: 6 }[kind];
  return (
    <input
      type="text"
      inputMode={isInt ? 'numeric' : 'decimal'}
      pattern={isInt ? '[0-9]*' : undefined}
      maxLength={maxLen}
      placeholder={placeholder}
      className="input input-bordered text-center !text-center font-mono text-2xl font-bold w-full h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(isInt ? /\D/g : /[^\d.]/g, '');
        const cleaned = !isInt && raw.split('.').length > 2
          ? raw.slice(0, raw.lastIndexOf('.'))
          : raw;
        if (cleaned === '' || cleaned === '.') { onChange(''); return; }
        const num = isInt ? parseInt(cleaned, 10) : parseFloat(cleaned);
        onChange(isNaN(num) ? '' : num);
      }}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onClick={(e) => e.target.select()}
      onTouchStart={(e) => e.target.select()}
      onPaste={(e) => {
        const raw = (e.clipboardData.getData('text') || '').replace(isInt ? /\D/g : /[^\d.]/g, '').slice(0, maxLen);
        e.preventDefault();
        if (raw === '' || raw === '.') { onChange(''); return; }
        const num = isInt ? parseInt(raw, 10) : parseFloat(raw);
        onChange(isNaN(num) ? '' : num);
      }}
    />
  );
};

const FieldInputGroup = ({
  fields,
  valueMap,
  onChangeMap,
  fieldLabel,
  placeholderMap = {},
  showPlateHelperBtn = false,
  onShowPlateHelper = null,
  showCalcBtn = false,
  onShowCalculator = null
}) => {
  if (!fields || fields.length === 0) return null;
  return (
    <div className={fields.length === 1 ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-2.5'}>
      {fields.map((kind) => (
        <div key={kind} className="flex flex-col gap-1">
          <div className="flex items-center justify-between h-5 overflow-hidden">
            <label className="text-xs font-semibold text-base-content/50 whitespace-nowrap shrink-0">{fieldLabel[kind]}</label>
            {kind === 'weight' && (showPlateHelperBtn || showCalcBtn) && (
              <div className="flex items-center gap-1 shrink-0">
                {showCalcBtn && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-primary dark:text-primary-dark font-extrabold gap-1 px-1 py-0 min-h-0 h-auto cursor-pointer hover:bg-primary/10 rounded"
                    onClick={onShowCalculator}
                  >
                    <Calculator size={11} />
                    <span className="text-[10px]">估算</span>
                  </button>
                )}
                {showPlateHelperBtn && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-primary dark:text-primary-dark font-extrabold gap-1 px-1 py-0 min-h-0 h-auto cursor-pointer hover:bg-primary/10 rounded"
                    onClick={onShowPlateHelper}
                  >
                    <Dumbbell size={11} />
                    <span className="text-[10px]">配片</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <FieldInput kind={kind} value={valueMap[kind]} onChange={onChangeMap[kind]} placeholder={placeholderMap[kind] || ''} />
        </div>
      ))}
    </div>
  );
};

function TrainSession({
  currentDay,
  sessionState,
  setSessionState,
  todayWorkout,
  exercisesMap,
  getExerciseCNName,
  onMinimize,
  onSave,
  onCancel,
  gymEquipmentConfig = null,
  unit = 'kg',
}) {
  const [focusedSet, setFocusedSet] = useState(null);
  const [showSetCard, setShowSetCard] = useState(false);
  const [showRestCard, setShowRestCard] = useState(false);
  const [showPlateHelper, setShowPlateHelper] = useState(false);

  // 重量估算计算器状态
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTab, setCalcTab] = useState('rpe'); // 'rpe' | 'formula'
  const [calcBaseline1RM, setCalcBaseline1RM] = useState('');
  const [calcReps, setCalcReps] = useState(5); // RTS RPE 目标次数 (1-12)
  const [calcRpe, setCalcRpe] = useState(8);   // RTS RPE 目标 RPE (6-10)
  const [calcFormulaReps, setCalcFormulaReps] = useState(5); // 无 RPE 公式目标次数 (1-36)
  const [calcLoading, setCalcLoading] = useState(false);

  const [restTimer, setRestTimer] = useState({
    active: false,
    total: DEFAULT_REST_SECONDS,
    remaining: DEFAULT_REST_SECONDS,
    endTime: null
  });

  const [setDetails, setSetDetails] = useState({});
  const [customRestSeconds, setCustomRestSeconds] = useState(DEFAULT_REST_SECONDS);

  const handleOpenCalculator = async (ex, currentWeightVal) => {
    setCalcLoading(true);
    setCalcOpen(true);
    try {
      const records = await fetchLatestOneRmForExercises([ex.exercise]);
      const latestRecord = records.find(r => r.exercise === ex.exercise);
      if (latestRecord && latestRecord.e1rm_kg) {
        const valInUnit = unit === 'lbs' ? convertWeight(latestRecord.e1rm_kg, 'lbs') : latestRecord.e1rm_kg;
        setCalcBaseline1RM(valInUnit.toFixed(1));
      } else {
        const fallbackWeight = currentWeightVal ?? ex.weight ?? 0;
        const fallbackInUnit = unit === 'lbs' ? convertWeight(fallbackWeight, 'lbs') : fallbackWeight;
        setCalcBaseline1RM(fallbackInUnit > 0 ? fallbackInUnit.toFixed(1) : '');
      }
    } catch (err) {
      console.error('Failed to fetch latest 1RM:', err);
      const fallbackWeight = currentWeightVal ?? ex.weight ?? 0;
      const fallbackInUnit = unit === 'lbs' ? convertWeight(fallbackWeight, 'lbs') : fallbackWeight;
      setCalcBaseline1RM(fallbackInUnit > 0 ? fallbackInUnit.toFixed(1) : '');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleApplyWeight = (calculatedWeight) => {
    if (!focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    const weightKg = unit === 'lbs' ? toStorageWeight(calculatedWeight, 'lbs') : calculatedWeight;
    const finalWeight = Math.round(weightKg * 10) / 10;
    handleWeightChange(exerciseIdx, setIdx, finalWeight);
    setCalcOpen(false);
  };

  // 移到上方避免 hoisting 问题
  const openSetCard = (exerciseIdx, setIdx) => { setFocusedSet({ exerciseIdx, setIdx }); setShowSetCard(true); };
  const closeSetCard = () => { setShowSetCard(false); setFocusedSet(null); setShowPlateHelper(false); setCalcOpen(false); };

  const adjustCustomRest = (delta) => {
    setCustomRestSeconds(prev => Math.max(0, prev + delta));
  };

  const audioContextRef = useRef(null);
  const restTimerRef = useRef(null);
  const swipeStartRef = useRef(null);

  // 用 Ref 维护定时器内部需要读取的易变状态，避免频繁重置定时器
  const timerStateRef = useRef({ focusedSet, exercises: todayWorkout?.exercises, setsData: sessionState.setsData });
  useEffect(() => {
    timerStateRef.current = { focusedSet, exercises: todayWorkout?.exercises, setsData: sessionState.setsData };
  }, [focusedSet, todayWorkout, sessionState.setsData]);

  // 全屏左滑手势 → 触发 onMinimize（非破坏性操作）
  const handleSwipeStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleSwipeEnd = (e) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const end = e.changedTouches?.[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    // 左滑 dx < -80px 且水平方向为主（|dx| > |dy|*1.5）
    if (dx < -80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onMinimize();
    }
  };

  const getRecordingMethod = (exerciseKey) => exercisesMap?.[exerciseKey]?.recording_method || 'standard';

  const getTotalSets = () => (todayWorkout?.exercises || []).reduce((sum, ex, idx) => sum + (sessionState.setsData[idx]?.length || 0), 0);
  const getCompletedSets = () => Object.values(sessionState.setsData).flat().filter(s => s.completed).length;
  const getProgress = () => { const t = getTotalSets(); return t === 0 ? 0 : Math.round((getCompletedSets() / t) * 100); };
  const isSessionFinished = () => getProgress() === 100;

  const getSetKey = (exerciseIdx, setIdx) => {
    const ex = todayWorkout?.exercises?.[exerciseIdx];
    return ex ? `${ex.tier}_${exerciseIdx}_${setIdx}` : '';
  };

  const playBeep = useCallback((freq = 800, dur = 200) => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur / 1000);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur / 1000);
    } catch { /* ignore */ }
  }, []);

  const playRestEndSound = useCallback(() => {
    playBeep(600, 150);
    setTimeout(() => playBeep(800, 150), 200);
    setTimeout(() => playBeep(1000, 200), 400);
  }, [playBeep]);

  useEffect(() => {
    if (restTimer.active && restTimer.endTime) {
      restTimerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.round((restTimer.endTime - now) / 1000));

        setRestTimer(prev => {
          if (diff <= 0) { 
            clearInterval(restTimerRef.current); 
            playRestEndSound(); 
            setShowRestCard(false);
            
            // 自动打开下一组
            const currentFocused = timerStateRef.current.focusedSet;
            const currentExercises = timerStateRef.current.exercises;
            const currentSetsData = timerStateRef.current.setsData;
            if (currentFocused && currentExercises && currentSetsData) {
              const { exerciseIdx, setIdx } = currentFocused;
              const totalSets = currentSetsData[exerciseIdx].length;
              if (setIdx === totalSets - 1 && exerciseIdx < currentExercises.length - 1) {
                openSetCard(exerciseIdx + 1, 0);
              } else if (setIdx < totalSets - 1) {
                openSetCard(exerciseIdx, setIdx + 1);
              }
            }
            return { ...prev, active: false, remaining: 0, endTime: null }; 
          }
          return { ...prev, remaining: diff };
        });
      }, 1000);
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [restTimer.active, restTimer.endTime, playRestEndSound]);

  const handleToggleSet = (exIndex, setIndex) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          const completed = !set.completed;
          const actual_reps = (completed && (set.actual_reps === '' || set.actual_reps === undefined))
            ? set.planned_reps
            : set.actual_reps;
          return { ...set, completed, actual_reps };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleRepsChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, actual_reps: value === '' ? '' : parseInt(value, 10) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleWeightChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, weight_kg: value === '' ? '' : parseFloat(value) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleDurationChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, duration_seconds: value === '' ? 0 : parseInt(value, 10) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleDistanceChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, distance_meters: value === '' ? '' : parseFloat(value) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const completeSet = () => {
    if (!focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    handleToggleSet(exerciseIdx, setIdx);
    closeSetCard();

    // 解决异步状态更新滞后问题：提前预测并计算完成状态
    const targetSet = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!targetSet) return;
    const willBeCompleted = !targetSet.completed; // 点击后的新状态

    let completedCount = 0;
    let totalCount = 0;
    Object.keys(sessionState.setsData).forEach(exKey => {
      const sets = sessionState.setsData[exKey] || [];
      totalCount += sets.length;
      sets.forEach((set, sIdx) => {
        const isCurrent = Number(exKey) === exerciseIdx && sIdx === setIdx;
        const isCompleted = isCurrent ? willBeCompleted : set.completed;
        if (isCompleted) completedCount++;
      });
    });

    const isSessionFinishedNew = totalCount > 0 && completedCount === totalCount;
    const totalSets = sessionState.setsData[exerciseIdx].length;
    const isLastExercise = exerciseIdx === todayWorkout.exercises.length - 1;
    const isLastSet = setIdx === totalSets - 1;

    if (!(isSessionFinishedNew || (isLastSet && isLastExercise))) {
      setRestTimer({
        active: true,
        total: customRestSeconds,
        remaining: customRestSeconds,
        endTime: Date.now() + customRestSeconds * 1000
      });
      setShowRestCard(true);
    }
  };

  const skipRest = () => {
    setShowRestCard(false);
    setRestTimer({
      active: false,
      total: DEFAULT_REST_SECONDS,
      remaining: DEFAULT_REST_SECONDS,
      endTime: null
    });
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (focusedSet) {
      const { exerciseIdx, setIdx } = focusedSet;
      const totalSets = sessionState.setsData[exerciseIdx].length;
      if (setIdx === totalSets - 1 && exerciseIdx < todayWorkout.exercises.length - 1) openSetCard(exerciseIdx + 1, 0);
      else if (setIdx < totalSets - 1) openSetCard(exerciseIdx, setIdx + 1);
    }
  };

  const addRestTime = (seconds) => {
    setRestTimer(prev => {
      const nextRemaining = prev.remaining + seconds;
      const nextTotal = prev.total + seconds;
      const nextEndTime = prev.endTime ? prev.endTime + seconds * 1000 : null;
      return {
        ...prev,
        remaining: Math.max(0, nextRemaining),
        total: Math.max(0, nextTotal),
        endTime: nextEndTime
      };
    });
  };
  const updateSetDetail = (key, field, value) => setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const applyTempoPreset = (key, presetValues) => {
    if (presetValues) {
      setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], tempo_eccentric: presetValues[0], tempo_pause_bottom: presetValues[1], tempo_concentric: presetValues[2], tempo_pause_top: presetValues[3] } }));
    }
  };

  const handleAbort = () => {
    const confirmDiscard = window.confirm("确定要放弃本次训练吗？所有未保存的训练数据都将丢失！");
    if (confirmDiscard) {
      onCancel();
    }
  };

  // ============ FIELD INPUT GROUP (hoisted outside) ============

  // ============ SET DETAIL CARD (floating centered) ============
  const renderSetCard = () => {
    if (!showSetCard || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!set) return null;

    const exInfo = exercisesMap?.[ex.exercise];
    const isBarbell = exInfo?.equipment?.includes('barbell') || 
                      ['squat', 'bench', 'deadlift', 'press'].includes(ex.exercise.toLowerCase());

    const method = getRecordingMethod(ex.exercise);
    const setKey = getSetKey(exerciseIdx, setIdx);
    const detail = setDetails[setKey] || {};
    const rpeValue = detail.rpe ?? 7;
    const totalSets = sessionState.setsData[exerciseIdx].length;

    const METHOD_CONFIG = {
      standard:           { summary: (s, ex) => `${s.planned_reps} 次 @ ${ex.weight?.toFixed(1)}kg`,    fields: ['reps', 'weight'],        showTempo: true  },
      reps_only:          { summary: (s)     => `${s.planned_reps} 次`,                                  fields: ['reps'],                  showTempo: true  },
      duration_only:      { summary: (s)     => `${s.planned_reps} 秒`,                                  fields: ['duration'],              showTempo: false },
      distance_only:      { summary: (s)     => `${s.planned_reps} 米`,                                  fields: ['distance'],              showTempo: false },
      loaded_carry:       { summary: (s, ex) => `${s.planned_reps}m @ ${ex.weight?.toFixed(1)}kg`,      fields: ['weight', 'distance'],    showTempo: false },
      bodyweight_added:   { summary: (s, ex) => `${s.planned_reps} 次 @ +${ex.weight?.toFixed(1)}kg`,  fields: ['reps', 'weight'],        showTempo: true  },
      bodyweight_assisted:{ summary: (s, ex) => `${s.planned_reps} 次 @ -${ex.weight?.toFixed(1)}kg`,  fields: ['reps', 'weight'],        showTempo: true  },
    };
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.standard;

    const FIELD_LABEL = {
      reps:     '实际次数',
      weight:   method === 'bodyweight_added' ? '附加重量' : method === 'bodyweight_assisted' ? '辅助重量' : method === 'loaded_carry' ? '负重重量' : '实际重量',
      duration: '时长（秒）',
      distance: '距离（米）',
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={closeSetCard}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-3.5 flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-base-content/50">第 {set.set_number} 组 / 共 {totalSets} 组</span>
            </div>

            {/* Summary Line - Large Typography */}
            <div className="p-2.5 rounded-xl bg-base-200/50">
              <div className="text-xl font-bold text-base-content">
                {config.summary(set, ex)}
              </div>
              <div className="text-base font-semibold text-base-content/60 mt-0.5">
                RPE {set.planned_rpe ?? 7}
                {config.showTempo && <> | 节奏 {set.tempo ?? '3110'}</>}
                <> | 休息 {customRestSeconds}秒</>
              </div>
            </div>

            {/* Dynamic Input Area - method-aware */}
            <FieldInputGroup
              fields={config.fields}
              valueMap={{
                reps:     set.actual_reps,
                weight:   set.weight_kg ?? ex.weight,
                duration: set.duration_seconds,
                distance: set.distance_meters,
              }}
              onChangeMap={{
                reps:     (v) => handleRepsChange(exerciseIdx, setIdx, v),
                weight:   (v) => handleWeightChange(exerciseIdx, setIdx, v),
                duration: (v) => handleDurationChange(exerciseIdx, setIdx, v),
                distance: (v) => handleDistanceChange(exerciseIdx, setIdx, v),
              }}
              fieldLabel={FIELD_LABEL}
              placeholderMap={{
                reps: ex.amrap_last && (set.actual_reps === '' || set.actual_reps === undefined) ? 'AMRAP' : '',
              }}
              showPlateHelperBtn={isBarbell}
              onShowPlateHelper={() => setShowPlateHelper(true)}
              showCalcBtn={config.fields.includes('weight')}
              onShowCalculator={() => handleOpenCalculator(ex, set.weight_kg)}
            />

            <div className="divider my-0" />

            {/* RPE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between h-8">
                <div className="flex items-center gap-2 select-none">
                  <label className="text-xs font-semibold text-base-content/50">RPE</label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-xs rounded" 
                      checked={detail.record_rpe !== false} 
                      onChange={(e) => updateSetDetail(setKey, 'record_rpe', e.target.checked)} 
                    />
                    <span className="text-[11px] text-base-content/40 font-bold">记录</span>
                  </label>
                </div>
                {detail.record_rpe !== false ? (
                  <span className={`text-2xl font-bold font-mono ${getRpeColor(rpeValue)}`}>{rpeValue.toFixed(1)}</span>
                ) : (
                  <span className="text-xs font-semibold text-base-content/30">不记录</span>
                )}
              </div>
              <div className={`transition-all duration-200 ${detail.record_rpe === false ? 'opacity-30 pointer-events-none' : ''}`}>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.5" 
                  value={rpeValue} 
                  className="range range-primary w-full" 
                  disabled={detail.record_rpe === false}
                  onChange={(e) => updateSetDetail(setKey, 'rpe', parseFloat(e.target.value))} 
                />
                <div className="flex justify-between px-1 text-[10px] text-base-content/30 font-mono select-none"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
              </div>
            </div>

            {/* Tempo: presets left, fields right - method-aware visibility */}
            {config.showTempo && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between h-6">
                <div className="flex items-center gap-2 select-none">
                  <label className="text-xs font-semibold text-base-content/50">动作节奏</label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-xs rounded" 
                      checked={detail.record_tempo !== false} 
                      onChange={(e) => updateSetDetail(setKey, 'record_tempo', e.target.checked)} 
                    />
                    <span className="text-[11px] text-base-content/40 font-bold">记录</span>
                  </label>
                </div>
                {detail.record_tempo === false && (
                  <span className="text-xs font-semibold text-base-content/30">不记录</span>
                )}
              </div>
              <div className={`flex gap-2.5 items-stretch transition-all duration-200 ${detail.record_tempo === false ? 'opacity-30 pointer-events-none' : ''}`}>
                {/* 左侧：3 个预设按钮垂直排列，占 50%，均匀分布 */}
                <div className="flex-1 flex flex-col gap-1 justify-between">
                  {TEMPO_PRESETS.slice(0, 3).map((preset, idx) => (
                    <button 
                      key={idx} 
                      type="button" 
                      disabled={detail.record_tempo === false}
                      className={`btn btn-ghost h-6 min-h-0 px-2 text-xs w-full whitespace-nowrap rounded-full ${preset.values === null ? 'btn-outline' : ''}`} 
                      onClick={() => applyTempoPreset(setKey, preset.values)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {/* 右侧：4 个输入框横向并排，占 50% */}
                <div className="flex-1 grid grid-cols-4 gap-1.5">
                  {TEMPO_LABELS.map((label, idx) => {
                    const fields = ['tempo_eccentric', 'tempo_pause_bottom', 'tempo_concentric', 'tempo_pause_top'];
                    const defaults = [3, 1, 1, 0];
                    return (
                      <div key={fields[idx]} className="flex flex-col gap-1 items-center">
                        <span className="text-[10px] text-base-content/40">{label}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]"
                          maxLength={1}
                          disabled={detail.record_tempo === false}
                          className="input input-bordered text-center !text-center font-mono font-bold w-full h-12 text-xl rounded-md px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={detail[fields[idx]] ?? defaults[idx]}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(-1);
                            const v = raw === '' ? defaults[idx] : Math.min(9, Math.max(0, parseInt(raw, 10)));
                            updateSetDetail(setKey, fields[idx], v);
                          }}
                          onBeforeInput={(e) => {
                            if (e.data && !/^[0-9]$/.test(e.data)) e.preventDefault();
                          }}
                          onKeyDown={(e) => {
                            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onFocus={(e) => {
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onClick={(e) => e.target.select()}
                          onTouchStart={(e) => e.target.select()}
                          onPaste={(e) => {
                            const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(-1);
                            e.preventDefault();
                            const v = pasted === '' ? defaults[idx] : Math.min(9, Math.max(0, parseInt(pasted, 10)));
                            updateSetDetail(setKey, fields[idx], v);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* 组间休息调整 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/50">组间休息（秒）</label>
              <div className="flex items-stretch gap-1.5">
                <button type="button" onClick={() => adjustCustomRest(-30)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-base-content/70 hover:text-error hover:border-error/50 active:scale-95"
                  aria-label="减少 30 秒"
                >-30s</button>
                <button type="button" onClick={() => adjustCustomRest(-10)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-base-content/70 hover:text-error hover:border-error/50 active:scale-95"
                  aria-label="减少 10 秒"
                >-10s</button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className="input input-bordered text-center !text-center font-mono text-2xl font-bold flex-1 h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={customRestSeconds}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setCustomRestSeconds(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                      setCustomRestSeconds(0);
                    }
                  }}
                  onFocus={(e) => requestAnimationFrame(() => e.target.select())}
                  onClick={(e) => e.target.select()}
                  onTouchStart={(e) => e.target.select()}
                  onPaste={(e) => {
                    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
                    e.preventDefault();
                    setCustomRestSeconds(pasted === '' ? 0 : parseInt(pasted, 10));
                  }}
                />
                <button type="button" onClick={() => adjustCustomRest(10)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-primary hover:bg-primary hover:text-primary-content hover:border-primary active:scale-95"
                  aria-label="增加 10 秒"
                >+10s</button>
                <button type="button" onClick={() => adjustCustomRest(30)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-primary hover:bg-primary hover:text-primary-content hover:border-primary active:scale-95"
                  aria-label="增加 30 秒"
                >+30s</button>
              </div>
            </div>

            {/* 备注/感受 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/50">备注/感受</label>
              <textarea
                className="textarea textarea-bordered w-full h-16 text-xs"
                placeholder="记录本组感受..."
                value={detail.notes || ''}
                onChange={(e) => updateSetDetail(setKey, 'notes', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-primary flex-1 font-bold gap-2 h-12 text-base" onClick={completeSet}><Check size={18} />完成本组</button>
              <button type="button" className="btn btn-ghost btn-outline flex-1 font-semibold gap-2 h-12 text-base" onClick={() => { handleToggleSet(exerciseIdx, setIdx); closeSetCard(); }}><SkipForward size={18} />跳过</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ REST TIMER CARD ============
  const renderRestCard = () => {
    if (!showRestCard) return null;
    const progressValue = restTimer.total > 0 ? ((restTimer.total - restTimer.remaining) / restTimer.total) * 100 : 0;
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference * (1 - progressValue / 100);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex flex-col items-center gap-4 p-5">
            <span className="text-sm font-semibold text-base-content/60">组间休息</span>

            <div className="relative flex items-center justify-center" style={{ width: '8rem', height: '8rem' }}>
              <svg className="absolute inset-0" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-base-300"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="text-orange-500 transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="flex flex-col items-center z-10">
                <span className="text-4xl font-bold font-mono text-base-content">{restTimer.remaining}</span>
                <span className="text-sm text-base-content/40">秒</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <div className="flex gap-2 w-full">
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(-10)}>-10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(10)}>+10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(30)}><Plus size={16} />+30s</button>
              </div>
              <button type="button" className="btn btn-warning w-full font-bold gap-2 h-11 text-sm" onClick={skipRest}><FastForward size={16} />跳过休息</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ EXERCISE LIST (fully expanded, no stack) ============
  const renderExerciseList = () => {
    const exercises = todayWorkout?.exercises || [];
    if (exercises.length === 0) return null;

    return (
      <div className="flex flex-col gap-4">
        {exercises.map((ex, exIdx) => {
          const tier = ex.tier || 'T1';
          const sets = sessionState.setsData[exIdx] || [];
          const completedCount = sets.filter(s => s.completed).length;
          const isFullyCompleted = completedCount === sets.length && sets.length > 0;

          const tierBadge = tier === 'T1' ? 'bg-primary/10 text-primary' : tier === 'T2' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent';
          const tierBorder = tier === 'T1' ? 'border-l-primary' : tier === 'T2' ? 'border-l-secondary' : 'border-l-accent';

          return (
            <div key={exIdx} className={`card bg-base-100 border border-base-300 border-l-4 ${tierBorder} shadow-sm transition-all duration-300 ${isFullyCompleted ? 'opacity-50' : ''}`}>
              <div className="card-body p-3.5 gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                    <span className="text-sm font-bold text-base-content">{getExerciseCNName(ex.exercise)}</span>
                    <span className="text-xs font-mono font-bold text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded">
                      {unit === 'lbs' ? `${convertWeight(ex.weight, 'lbs').toFixed(1)}lbs` : `${ex.weight?.toFixed(1)}kg`}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-base-content/40">{completedCount}/{sets.length}</span>
                </div>

                {(() => {
                  const exInfo = exercisesMap?.[ex.exercise];
                  const isBarbell = exInfo?.equipment?.includes('barbell') || 
                                    ['squat', 'bench', 'deadlift', 'press'].includes(ex.exercise.toLowerCase());
                  if (!isBarbell || !gymEquipmentConfig) return null;
                  
                  const configForUnit = gymEquipmentConfig[unit] || gymEquipmentConfig.kg;
                  const barWeight = configForUnit.barbell?.bar_weight ?? (unit === 'kg' ? 20 : 45);
                  const enabledPlates = configForUnit.barbell?.enabled_plates || (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
                  const plateLimits = configForUnit.barbell?.plate_limits || {};
                  
                  const weightInUnit = unit === 'lbs' ? convertWeight(ex.weight, 'lbs') : ex.weight;
                  const breakdown = getBarbellPlateBreakdown(weightInUnit, barWeight, enabledPlates, plateLimits);
                   if (!breakdown || breakdown.plates.length === 0) {
                    return (
                      <div className="flex flex-col gap-1.5 mb-2 select-none w-full">
                        <div className="text-[10px] text-base-content/45 bg-base-200/50 px-2.5 py-1.5 rounded-lg font-semibold w-fit border border-base-300/40">
                          💡 配片: 空杆 {barWeight}{unit}
                        </div>
                      </div>
                    );
                  }
                  
                  const counts = {};
                  breakdown.plates.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
                  const plateTexts = Object.entries(counts)
                    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                    .map(([plate, count]) => `${plate}${unit} × ${count}`);
                  
                  return (
                    <div className="flex flex-col gap-1.5 mb-2 select-none w-full">
                      <div className="text-[10px] text-primary dark:text-primary-dark bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1 font-semibold">
                        <span>💡 配片建议:</span>
                        <span>{barWeight}{unit} 空杆 + 单侧 [{plateTexts.join(', ')}]</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-1.5">
                  {sets.map((set, setIdx) => {
                    const setKey = getSetKey(exIdx, setIdx);
                    const detail = setDetails[setKey] || {};
                    const isLastSet = setIdx === sets.length - 1;
                    return (
                      <button key={setIdx} type="button" className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all duration-200 text-left w-full ${set.completed ? 'border-green-500/30 bg-green-500/5' : isLastSet && !set.completed ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-200/30 hover:border-base-content/15'}`} onClick={() => openSetCard(exIdx, setIdx)}>
                        <div className="flex items-center gap-2.5">
                          {set.completed ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"><Check size={12} className="text-white" /></div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLastSet ? 'border-primary' : 'border-base-300'}`}><span className="text-[9px] font-bold text-base-content/40">{set.set_number}</span></div>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-xs font-semibold ${set.completed ? 'text-base-content/30 line-through' : 'text-base-content'}`}>第 {set.set_number} 组</span>
                            <span className="text-[10px] text-base-content/30">目标: {set.planned_reps}次</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {detail.record_rpe !== false && detail.rpe !== undefined && detail.rpe !== null && (
                            <span className={`text-[10px] font-bold font-mono ${getRpeColor(detail.rpe)}`}>RPE {detail.rpe.toFixed(1)}</span>
                          )}
                          {['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(getRecordingMethod(ex.exercise)) && (
                            <span className="text-xs font-mono font-bold text-base-content/50">
                              {unit === 'lbs' 
                                ? `${convertWeight(set.weight_kg || ex.weight, 'lbs').toFixed(1)}lbs` 
                                : `${(set.weight_kg || ex.weight)?.toFixed(1)}kg`
                              }
                            </span>
                          )}
                          {set.completed && <span className="text-xs font-mono font-bold text-green-500">{set.actual_reps ?? set.planned_reps}次</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const progress = getProgress();

  // ============ BOTTOM SHEET PLATE HELPER ============
  const renderPlateHelperSheet = () => {
    if (!showPlateHelper || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!set) return null;

    if (!gymEquipmentConfig) return null;

    const configForUnit = gymEquipmentConfig[unit] || gymEquipmentConfig.kg;
    const barWeight = configForUnit.barbell?.bar_weight ?? (unit === 'kg' ? 20 : 45);
    const enabledPlates = configForUnit.barbell?.enabled_plates || (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
    const plateLimits = configForUnit.barbell?.plate_limits || {};

    // 优先使用当前 logged weight，若无则使用动作计划重
    const currentWeight = set.weight_kg ?? ex.weight ?? 0;
    const weightInUnit = unit === 'lbs' ? convertWeight(currentWeight, 'lbs') : currentWeight;
    const breakdown = getBarbellPlateBreakdown(weightInUnit, barWeight, enabledPlates, plateLimits) || { plates: [] };

    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
        {/* Backdrop overlay */}
        <div 
          className="bottom-sheet-backdrop animate-sheet-fade-in"
          onClick={() => setShowPlateHelper(false)}
        />
        
        {/* Bottom sheet content card */}
        <div className="bottom-sheet-container animate-sheet-slide-up w-full flex flex-col gap-3.5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border-card/50 dark:border-border-card-dark/50">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">
                杠铃配片计算助手
              </span>
              <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                针对: {getExerciseCNName?.(ex.exercise) || ex.exercise} - 第 {set.set_number} 组
              </span>
            </div>
            <button 
              type="button" 
              className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark rounded-full"
              onClick={() => setShowPlateHelper(false)}
              aria-label="关闭配片"
            >
              <X size={16} />
            </button>
          </div>

          {/* Details / Summary */}
          <div className="flex justify-between items-center bg-bg-main/30 dark:bg-bg-main-dark/30 p-2.5 rounded-xl border border-border-card/50 dark:border-border-card-dark/50 animate-fadeIn">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">当前组录入重量</span>
              <span className="text-lg font-black font-mono text-primary">
                {weightInUnit.toFixed(1)}{unit}
              </span>
            </div>
            {breakdown.plates.length > 0 ? (
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">默认计算配片 (单侧)</span>
                <span className="text-[11px] font-bold text-text-main dark:text-text-main-dark">
                  {(() => {
                    const counts = {};
                    breakdown.plates.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
                    return Object.entries(counts)
                      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                      .map(([plate, count]) => `${plate}${unit} × ${count}`)
                      .join(' + ');
                  })()}
                </span>
              </div>
            ) : (
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">默认计算配片</span>
                <span className="text-[11px] font-bold text-text-secondary dark:text-text-secondary-dark">
                  仅需 {barWeight}{unit} 空杆
                </span>
              </div>
            )}
          </div>

          {/* Barbell Plate Visualizer */}
          <BarbellVisualizer
            plates={breakdown.plates}
            barWeight={barWeight}
            unit={unit}
            enabledPlates={enabledPlates}
            plateLimits={plateLimits}
          />
        </div>
      </div>
    );
  };

  const renderWeightCalculatorSheet = () => {
    if (!calcOpen || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!set) return null;

    const base1RM = parseFloat(calcBaseline1RM) || 0;
    
    // RTS RPE mode
    const P = RPE_PERCENTAGE_CHART[calcReps]?.[calcRpe] || 0;
    const computedRpeWeight = base1RM > 0 && P > 0 ? Math.floor(base1RM * P * 10) / 10 : 0;

    // Formula mode
    const repsF = parseInt(calcFormulaReps) || 0;
    let epleyWeight = 0;
    let brzyckiWeight = 0;
    if (base1RM > 0 && repsF > 0) {
      if (repsF === 1) {
        epleyWeight = base1RM;
        brzyckiWeight = base1RM;
      } else {
        epleyWeight = Math.floor((base1RM / (1 + repsF / 30)) * 10) / 10;
        if (repsF < 37) {
          brzyckiWeight = Math.floor((base1RM * (37 - repsF) / 36) * 10) / 10;
        }
      }
    }

    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
        {/* Backdrop overlay */}
        <div 
          className="bottom-sheet-backdrop animate-sheet-fade-in"
          onClick={() => setCalcOpen(false)}
        />
        
        {/* Bottom sheet content card */}
        <div className="bottom-sheet-container animate-sheet-slide-up w-full flex flex-col gap-3.5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-base-300">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-base-content">
                做组重量估算助手
              </span>
              <span className="text-[10px] text-base-content/50">
                针对: {getExerciseCNName?.(ex.exercise) || ex.exercise} - 第 {set.set_number} 组
              </span>
            </div>
            <button 
              type="button" 
              className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-300 rounded-full"
              onClick={() => setCalcOpen(false)}
              aria-label="关闭计算器"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-base-200/50 border border-base-300 rounded-lg p-0.5 gap-0.5 select-none">
            <button
              type="button"
              onClick={() => {
                setCalcTab('rpe');
              }}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border-0 ${
                calcTab === 'rpe'
                  ? 'bg-primary text-primary-content shadow-sm'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              RPE估算
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcTab('formula');
              }}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border-0 ${
                calcTab === 'formula'
                  ? 'bg-primary text-primary-content shadow-sm'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              无RPE估算
            </button>
          </div>

          {/* Tab Content with Unified Height Container */}
          <div className="h-[320px] flex flex-col justify-between animate-fadeIn">
            {calcTab === 'rpe' ? (
              <div className="flex flex-col gap-3.5 h-full justify-between">
                <div className="flex flex-col gap-3.5">
                  {/* Inputs with standard unified layout */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Baseline 1RM Input */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-base-content/50 select-none">基准 1RM ({unit})</label>
                        {calcLoading && <span className="text-[10px] text-primary animate-pulse">加载中...</span>}
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-base-200/50 border-base-300 focus-within:border-primary px-3 h-11 transition-colors">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1RM重量"
                          value={calcBaseline1RM}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, '');
                            const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                            setCalcBaseline1RM(cleaned);
                          }}
                          className="w-full bg-transparent font-mono font-semibold text-sm text-base-content focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm font-medium text-base-content/40 select-none">{unit}</span>
                      </div>
                    </div>

                    {/* 预估重量 (calculated target weight) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-base-content/50 select-none">预估重量 ({unit})</label>
                        <span className="badge badge-info badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-blue-500/15 text-blue-500 border border-blue-500/20">自动</span>
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-primary/5 border-primary/20 px-3 h-11 transition-colors select-none">
                        <div className="w-full font-mono font-black text-sm text-primary text-right pr-0.5">
                          {computedRpeWeight > 0 ? `${computedRpeWeight}` : `0`}
                        </div>
                        <span className="text-sm font-bold text-primary/70 select-none">{unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Infinite pickers */}
                  <div className="flex flex-col gap-2">
                    <InfiniteScrollPicker
                      options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                      value={calcReps}
                      onChange={(val) => setCalcReps(val)}
                      label="目标次数 (Reps)"
                    />
                    <InfiniteScrollPicker
                      options={[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6]}
                      value={calcRpe}
                      onChange={(val) => setCalcRpe(val)}
                      label="目标 RPE"
                    />
                  </div>
                </div>

                {/* Formula Annotation and Apply Button */}
                <div className="flex flex-col gap-1.5 mt-auto">
                  <div className="text-[9px] text-base-content/40 text-center leading-normal">
                    RTS RPE 公式: 目标重量 = e1RM 基准 × RTS百分比 (来自 Mike Tuchscherer 强度百分比表)
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-full h-11 min-h-0 font-bold"
                    disabled={!(computedRpeWeight > 0)}
                    onClick={() => handleApplyWeight(computedRpeWeight)}
                  >
                    应用此重量
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 h-full justify-between">
                <div className="flex flex-col gap-3.5">
                  {/* Inputs with standard unified layout */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Baseline 1RM Input */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-base-content/50 select-none">基准 1RM ({unit})</label>
                        {calcLoading && <span className="text-[10px] text-primary animate-pulse">加载中...</span>}
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-base-200/50 border-base-300 focus-within:border-primary px-3 h-11 transition-colors">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1RM重量"
                          value={calcBaseline1RM}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, '');
                            const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                            setCalcBaseline1RM(cleaned);
                          }}
                          className="w-full bg-transparent font-mono font-semibold text-sm text-base-content focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm font-medium text-base-content/40 select-none">{unit}</span>
                      </div>
                    </div>

                    {/* Target Reps Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-base-content/50 select-none">目标次数 (Reps)</label>
                      <div className="input input-bordered flex items-center gap-1 bg-base-200/50 border-base-300 focus-within:border-primary px-3 h-11 transition-colors">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          placeholder="次数 (1-36)"
                          value={calcFormulaReps}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            const val = raw === '' ? '' : Math.min(36, Math.max(1, parseInt(raw, 10)));
                            setCalcFormulaReps(val);
                          }}
                          className="w-full bg-transparent font-mono font-semibold text-sm text-base-content focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm font-medium text-base-content/40 select-none">次</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Calculation Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Epley Card */}
                    <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${base1RM > 0 && repsF > 0 ? 'bg-primary/5 border-primary/20' : 'bg-base-200/30 border-base-300'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-base-content">Epley 公式</span>
                        {repsF > 1 && repsF <= 10 && (
                          <span className="badge badge-success badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-green-500/10 text-green-500 border border-green-500/20">推荐</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-base-content/40 font-sans leading-none">估算重量</span>
                        <span className="text-xl font-black font-mono text-primary mt-1">
                          {epleyWeight > 0 ? `${epleyWeight} ${unit}` : `-- ${unit}`}
                        </span>
                      </div>
                      <span className="text-[9px] text-base-content/40 leading-normal">
                        Epley 逆向公式:<br />
                        目标重量 = e1RM / (1 + R/30)<br />
                        适合 1-10 次中低重复
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full h-8 min-h-8 rounded-lg text-xs mt-1 font-bold"
                        disabled={!(epleyWeight > 0)}
                        onClick={() => handleApplyWeight(epleyWeight)}
                      >
                        应用此重量
                      </button>
                    </div>

                    {/* Brzycki Card */}
                    <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${base1RM > 0 && repsF > 0 && repsF < 37 ? 'bg-primary/5 border-primary/20' : 'bg-base-200/30 border-base-300'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-base-content">Brzycki 公式</span>
                        {repsF > 10 && repsF <= 15 && (
                          <span className="badge badge-success badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-green-500/10 text-green-500 border border-green-500/20">推荐</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-base-content/40 font-sans leading-none">估算重量</span>
                        <span className="text-xl font-black font-mono text-primary mt-1">
                          {brzyckiWeight > 0 ? `${brzyckiWeight} ${unit}` : `-- ${unit}`}
                        </span>
                      </div>
                      <span className="text-[9px] text-base-content/40 leading-normal">
                        Brzycki 逆向公式:<br />
                        目标重量 = e1RM * (37 - R) / 36<br />
                        适合 10-15 次中高重复
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full h-8 min-h-8 rounded-lg text-xs mt-1 font-bold"
                        disabled={!(brzyckiWeight > 0)}
                        onClick={() => handleApplyWeight(brzyckiWeight)}
                      >
                        应用此重量
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-200/95 backdrop-blur-lg max-w-[480px] w-full mx-auto overflow-hidden"
         onTouchStart={handleSwipeStart}
         onTouchEnd={handleSwipeEnd}
    >
      {/* Navbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-base-100 border-b border-base-300">
        <button type="button" className="btn btn-ghost h-10 px-3 text-sm font-semibold text-base-content/70 hover:text-base-content gap-1.5 active:scale-95" onClick={onMinimize} aria-label="缩小训练窗口"><Minimize2 size={18} /><span>缩小</span></button>
        <div className="text-xs font-bold text-base-content pointer-events-none">实时训练中 ({currentDay})</div>
        <button type="button" className="btn btn-ghost h-10 px-3 text-sm font-semibold text-error hover:bg-error/10 gap-1.5 active:scale-95" onClick={handleAbort} aria-label="放弃训练"><X size={18} /><span>放弃</span></button>
      </div>

      {/* Progress */}
      <div className="px-4 py-1.5 bg-base-100 border-b border-base-300">
        <div className="flex items-center gap-3">
          <progress className="progress progress-primary flex-1 h-1.5" value={progress} max="100" />
          <span className="text-[10px] font-bold font-mono text-base-content/50 w-9 text-right">{progress}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 pb-24">
        {renderExerciseList()}
        {isSessionFinished() && (
          <div className="mt-2 animate-fadeIn">
            <button type="button" className="btn btn-success btn-lg btn-block text-success-content font-semibold gap-2 shadow-lg" onClick={() => onSave(setDetails)}><Sparkles size={18} />完成今日训练打卡</button>
          </div>
        )}
      </div>

      {renderSetCard()}
      {renderRestCard()}
      {renderPlateHelperSheet()}
      {renderWeightCalculatorSheet()}
    </div>
  );
}

export default TrainSession;
