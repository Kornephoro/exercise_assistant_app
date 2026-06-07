import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Minimize2, X, Check, Sparkles, SkipForward, Plus, FastForward, Dumbbell, Calculator, Play, Pause, Settings } from 'lucide-react';
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
      className="input input-bordered text-center !text-center font-mono text-2xl font-bold w-full h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-lg placeholder:font-black placeholder:text-base-content/40"
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
  setTodayWorkout,
  exercisesMap,
  getExerciseCNName,
  setDetails,
  setSetDetails,
  showSetCard,
  focusedSet,
  openSetCard,
  closeSetCard,
  onMinimize,
  onSave,
  onCancel,
  gymEquipmentConfig = null,
  unit = 'kg',
  restTimer,
  setRestTimer
}) {
  const getRecordingMethod = (exerciseKey) => exercisesMap?.[exerciseKey]?.recording_method || 'standard';

  const getTotalSets = () => (todayWorkout?.exercises || []).reduce((sum, ex, idx) => {
    const sets = sessionState.setsData[idx] || [];
    const nonSkipped = sets.filter(s => !s.skipped);
    return sum + nonSkipped.length;
  }, 0);
  const getCompletedSets = () => Object.values(sessionState.setsData).flat().filter(s => s.completed && !s.skipped).length;
  const getProgress = () => { const t = getTotalSets(); return t === 0 ? 0 : Math.round((getCompletedSets() / t) * 100); };
  const isSessionFinished = () => getProgress() === 100;


  const [showPlateHelper, setShowPlateHelper] = useState(false);

  // 重量估算计算器状态
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTab, setCalcTab] = useState('rpe'); // 'rpe' | 'formula'
  const [calcBaseline1RM, setCalcBaseline1RM] = useState('');
  const [calcReps, setCalcReps] = useState(5); // RTS RPE 目标次数 (1-12)
  const [calcRpe, setCalcRpe] = useState(8);   // RTS RPE 目标 RPE (6-10)
  const [calcFormulaReps, setCalcFormulaReps] = useState(5); // 无 RPE 公式目标次数 (1-36)
  const [calcLoading, setCalcLoading] = useState(false);



  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showSessionNotesModal, setShowSessionNotesModal] = useState(false);
  const [showSessionSettingsModal, setShowSessionSettingsModal] = useState(false);

  // Group settings state
  const [showSetSettingsModal, setShowSetSettingsModal] = useState(false);
  const [settingsSetIndex, setSettingsSetIndex] = useState(null);
  const [settingsExerciseIndex, setSettingsExerciseIndex] = useState(null);

  // Exercise settings state
  const [showExerciseSettingsModal, setShowExerciseSettingsModal] = useState(false);
  const [settingsExIdx, setSettingsExIdx] = useState(null);

  // Add exercise form state
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  const [chosenWeight, setChosenWeight] = useState(20);
  const [chosenSets, setChosenSets] = useState(3);
  const [chosenReps, setChosenReps] = useState(8);
  const [selectedExToAdd, setSelectedExToAdd] = useState(null);

  useEffect(() => {
    if (!sessionState.isActive) return;

    const calculateElapsed = () => {
      const start = sessionState.startTime || Date.now();
      const elapsed = sessionState.elapsedTime || 0;
      const paused = !!sessionState.isPaused;
      if (paused) {
        return elapsed;
      } else {
        return elapsed + Math.floor((Date.now() - start) / 1000);
      }
    };

    setSecondsElapsed(calculateElapsed());

    if (sessionState.isPaused) return;

    const interval = setInterval(() => {
      setSecondsElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState.isActive, sessionState.startTime, sessionState.elapsedTime, sessionState.isPaused]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const getNextSet = (currentExIdx, currentSetIdx, exercises, setsData) => {
    let exIdx = currentExIdx;
    let setIdx = currentSetIdx + 1;
    
    while (exIdx < exercises.length) {
      const sets = setsData[exIdx] || [];
      while (setIdx < sets.length) {
        if (!sets[setIdx].skipped) {
          return { exerciseIdx: exIdx, setIdx };
        }
        setIdx++;
      }
      exIdx++;
      setIdx = 0;
    }
    return null;
  };

  // 训练实时统计数据计算
  const totalSets = getTotalSets();
  const completedSets = getCompletedSets();

  const totalExercises = todayWorkout?.exercises?.length || 0;
  const completedExercises = useMemo(() => {
    return (todayWorkout?.exercises || []).reduce((count, ex, idx) => {
      const sets = sessionState.setsData[idx] || [];
      const nonSkipped = sets.filter(s => !s.skipped);
      if (nonSkipped.length > 0 && nonSkipped.every(s => s.completed)) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [todayWorkout?.exercises, sessionState.setsData]);

  const { displayPlannedVolume, displayCompletedVolume } = useMemo(() => {
    let totalPlannedVolume = 0;
    let completedVolume = 0;

    (todayWorkout?.exercises || []).forEach((ex, exIdx) => {
      const method = getRecordingMethod(ex.exercise);
      const sets = sessionState.setsData[exIdx] || [];
      
      const isWeightBased = ['standard', 'bodyweight_added', 'bodyweight_assisted', 'loaded_carry'].includes(method);
      if (!isWeightBased) return;

      sets.forEach(s => {
        if (s.skipped) return;
        
        const weightVal = s.weight_kg !== undefined && s.weight_kg !== '' ? Number(s.weight_kg) : (ex.weight || 0);
        
        let plannedReps = s.planned_reps || 0;
        if (method === 'loaded_carry') {
          plannedReps = s.planned_reps || 0;
        }
        
        const plannedVol = weightVal * plannedReps;
        totalPlannedVolume += plannedVol;

        if (s.completed) {
          let actualReps = s.actual_reps !== undefined && s.actual_reps !== '' ? Number(s.actual_reps) : (s.planned_reps || 0);
          if (method === 'loaded_carry') {
            actualReps = s.distance_meters !== undefined && s.distance_meters !== '' ? Number(s.distance_meters) : (s.planned_reps || 0);
          }
          completedVolume += weightVal * actualReps;
        }
      });
    });

    return {
      displayPlannedVolume: Math.round(unit === 'lbs' ? convertWeight(totalPlannedVolume, 'lbs') : totalPlannedVolume),
      displayCompletedVolume: Math.round(unit === 'lbs' ? convertWeight(completedVolume, 'lbs') : completedVolume)
    };
  }, [todayWorkout?.exercises, sessionState.setsData, unit]);


  useEffect(() => {
    if (!showSetCard) {
      setShowPlateHelper(false);
      setCalcOpen(false);
    }
  }, [showSetCard]);

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

  // openSetCard and closeSetCard are now props passed from App.jsx to sync with history popstate

  const adjustCustomRest = (delta) => {
    setCustomRestSeconds(prev => Math.max(0, prev + delta));
  };

  const audioContextRef = useRef(null);
  const swipeStartRef = useRef(null);

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

  // Helper methods moved to the top of the component body to avoid hoisting reference error

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
    
    const nextSet = getNextSet(exerciseIdx, setIdx, todayWorkout.exercises, sessionState.setsData);

    if (nextSet) {
      setRestTimer({
        active: true,
        total: customRestSeconds,
        remaining: customRestSeconds,
        endTime: Date.now() + customRestSeconds * 1000,
        isMinimized: false
      });
    }
  };

  const skipSetAction = (exIdx, setIdx) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIdx] || []).map((s, sIdx) => {
        if (sIdx === setIdx) {
          return { 
            ...s, 
            skipped: true,
            completed: false
          };
        }
        return s;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIdx]: nextSets }
      };
    });
    closeSetCard();

    // 解决异步状态更新滞后问题：提前预测并计算完成状态
    const nextSetsData = {
      ...sessionState.setsData,
      [exIdx]: (sessionState.setsData[exIdx] || []).map((s, sIdx) => {
        if (sIdx === setIdx) {
          return { ...s, skipped: true, completed: false };
        }
        return s;
      })
    };
    const nextSet = getNextSet(exIdx, setIdx, todayWorkout.exercises, nextSetsData);
    if (nextSet) {
      openSetCard(nextSet.exerciseIdx, nextSet.setIdx);
    }
  };

  const skipRest = () => {
    setRestTimer({
      active: false,
      total: DEFAULT_REST_SECONDS,
      remaining: DEFAULT_REST_SECONDS,
      endTime: null,
      isMinimized: false
    });
    if (focusedSet) {
      const { exerciseIdx, setIdx } = focusedSet;
      const next = getNextSet(exerciseIdx, setIdx, todayWorkout.exercises, sessionState.setsData);
      if (next) {
        openSetCard(next.exerciseIdx, next.setIdx);
      }
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

  const getRpeColor = (v) => v <= 4 ? 'text-green-500' : v <= 7 ? 'text-yellow-500' : 'text-red-500';

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
    const isSkipped = !!set.skipped;
    const isCompleted = !!set.completed;

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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsExerciseIndex(exerciseIdx);
                    setSettingsSetIndex(setIdx);
                    setShowSetSettingsModal(true);
                  }}
                  className="btn btn-ghost btn-xs text-primary font-bold gap-1 rounded hover:bg-primary/10 cursor-pointer text-[11px]"
                >
                  ⚙️ 组管理
                </button>
                <button 
                  type="button" 
                  onClick={closeSetCard}
                  className="btn btn-ghost btn-circle btn-xs h-7 w-7 text-base-content/50 hover:bg-base-200"
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>
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
                reps: set.is_amrap ? 'AMRAP' : String(set.planned_reps),
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
            <div className="flex gap-2.5 mt-2">
              {isSkipped ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-primary flex-1 font-bold gap-2 h-12 text-base" 
                    onClick={() => {
                      setSessionState(prev => {
                        const nextSets = (prev.setsData[exerciseIdx] || []).map((s, sIdx) => {
                          if (sIdx === setIdx) {
                            return { ...s, skipped: false, completed: false };
                          }
                          return s;
                        });
                        return {
                          ...prev,
                          setsData: { ...prev.setsData, [exerciseIdx]: nextSets }
                        };
                      });
                    }}
                  >
                    <Play size={18} />
                    恢复训练
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline border-base-300 flex-1 font-semibold gap-2 h-12 text-base text-base-content/70 hover:bg-base-200" 
                    onClick={closeSetCard}
                  >
                    <X size={18} />
                    关闭
                  </button>
                </>
              ) : isCompleted ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-primary flex-1 font-bold gap-2 h-12 text-base" 
                    onClick={closeSetCard}
                  >
                    <Check size={18} />
                    保存修改
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-error btn-outline flex-1 font-semibold gap-2 h-12 text-base" 
                    onClick={() => {
                      setSessionState(prev => {
                        const nextSets = (prev.setsData[exerciseIdx] || []).map((s, sIdx) => {
                          if (sIdx === setIdx) {
                            return { 
                              ...s, 
                              completed: false, 
                              actual_reps: '', 
                              duration_seconds: '',
                              distance_meters: ''
                            };
                          }
                          return s;
                        });
                        return {
                          ...prev,
                          setsData: { ...prev.setsData, [exerciseIdx]: nextSets }
                        };
                      });
                      closeSetCard();
                    }}
                  >
                    <X size={18} />
                    撤销完成
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn btn-primary flex-1 font-bold gap-2 h-12 text-base" 
                    onClick={completeSet}
                  >
                    <Check size={18} />
                    完成本组
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-outline flex-1 font-semibold gap-2 h-12 text-base" 
                    onClick={() => skipSetAction(exerciseIdx, setIdx)}
                  >
                    <SkipForward size={18} />
                    跳过
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ REST TIMER CARD ============
  const renderRestCard = () => {
    if (!restTimer.active || restTimer.isMinimized) return null;
    const progressValue = restTimer.total > 0 ? ((restTimer.total - restTimer.remaining) / restTimer.total) * 100 : 0;
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference * (1 - progressValue / 100);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-3">
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex flex-col items-center gap-4 p-5 relative">
            {/* 右上角最小化按钮 */}
            <button
              type="button"
              onClick={() => setRestTimer(prev => ({ ...prev, isMinimized: true }))}
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-full flex items-center justify-center cursor-pointer"
              title="最小化"
            >
              <span className="text-base">↘️</span>
            </button>

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
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(30)}>+30s</button>
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
              <div className="card-body px-0 py-3 gap-2">
                <div className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                    <span className="text-sm font-bold text-base-content">{getExerciseCNName(ex.exercise)}</span>
                    <span className="text-xs font-mono font-bold text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded">
                      {unit === 'lbs' ? `${convertWeight(ex.weight, 'lbs').toFixed(1)}lbs` : `${ex.weight?.toFixed(1)}kg`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-base-content/40">{completedCount}/{sets.length}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsExIdx(exIdx);
                        setShowExerciseSettingsModal(true);
                      }}
                      className="btn btn-ghost btn-circle btn-xs h-6 w-6 min-h-0 text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-full flex items-center justify-center cursor-pointer"
                      title="动作设置"
                    >
                      <Settings size={13} />
                    </button>
                  </div>
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
                      <div className="flex flex-col gap-1.5 mb-2 select-none w-full px-3">
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
                    <div className="flex flex-col gap-1.5 mb-2 select-none w-full px-3">
                      <div className="text-[10px] text-primary dark:text-primary-dark bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1 font-semibold">
                        <span>💡 配片建议:</span>
                        <span>{barWeight}{unit} 空杆 + 单侧 [{plateTexts.join(', ')}]</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-2.5">
                  {sets.map((set, setIdx) => {
                    const setKey = getSetKey(exIdx, setIdx);
                    const detail = setDetails[setKey] || {};
                    const isLastSet = setIdx === sets.length - 1;
                    const isSkipped = !!set.skipped;
                    const isExhausted = !!detail.is_exhausted;
                    
                    let btnClassName = `flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left w-full `;
                    if (isSkipped) {
                      btnClassName += `border-dashed border-base-300 bg-base-200/20 opacity-50`;
                    } else if (set.completed) {
                      btnClassName += `border-green-500/30 bg-green-500/5`;
                    } else if (isLastSet && !set.completed) {
                      btnClassName += `border-primary/40 bg-primary/5`;
                    } else {
                      btnClassName += `border-base-300 bg-base-200/30 hover:border-base-content/15`;
                    }

                    return (
                      <button key={setIdx} type="button" className={btnClassName} onClick={() => openSetCard(exIdx, setIdx)}>
                        <div className="flex items-center gap-3">
                          {isSkipped ? (
                            <div className="w-8 h-8 rounded-full border border-base-300 flex items-center justify-center"><span className="text-xs text-base-content/30 font-bold">⏭️</span></div>
                          ) : set.completed ? (
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><Check size={14} className="text-white" /></div>
                          ) : (
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isLastSet ? 'border-primary' : 'border-base-300'}`}><span className="text-xs font-bold text-base-content/40">{set.set_number}</span></div>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isSkipped ? 'text-base-content/40' : set.completed ? 'text-base-content/30 line-through' : 'text-base-content'}`}>
                              第 {set.set_number} 组
                              {isExhausted && <span className="text-[10px] text-warning ml-1">★ 力竭</span>}
                            </span>
                            <span className="text-xs font-semibold text-base-content/40">目标: {set.planned_reps}{set.is_amrap ? '+' : ''}次</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSkipped ? (
                            <span className="text-xs font-bold text-base-content/30">已跳过</span>
                          ) : (
                            <>
                              {detail.record_rpe !== false && detail.rpe !== undefined && detail.rpe !== null && (
                                <span className={`text-xs font-bold font-mono ${getRpeColor(detail.rpe)}`}>RPE {detail.rpe.toFixed(1)}</span>
                              )}
                              {['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(getRecordingMethod(ex.exercise)) && (
                                <span className="text-sm font-mono font-bold text-base-content/60">
                                  {unit === 'lbs' 
                                    ? `${convertWeight(set.weight_kg || ex.weight, 'lbs').toFixed(1)}lbs` 
                                    : `${(set.weight_kg || ex.weight)?.toFixed(1)}kg`
                                  }
                                </span>
                              )}
                              {set.completed && <span className="text-base font-mono font-black text-green-500">{set.actual_reps ?? set.planned_reps}次</span>}
                            </>
                          )}
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

  // ============ ADD EXERCISE MODAL ============
  const renderAddExerciseModal = () => {
    if (!showAddExerciseModal) return null;
    
    // Get all exercises from exercisesMap values
    const allExs = Object.values(exercisesMap || {});
    const filtered = allExs.filter(ex => 
      ex.name?.toLowerCase().includes(addExerciseSearch.toLowerCase()) ||
      getExerciseCNName(ex.name)?.includes(addExerciseSearch)
    );

    const handleConfirmAdd = () => {
      if (!selectedExToAdd) return;
      
      const newEx = {
        exercise: selectedExToAdd.name,
        tier: 'T3',
        weight: parseFloat(chosenWeight) || 0,
        sets: parseInt(chosenSets, 10) || 3,
        reps: parseInt(chosenReps, 10) || 8,
        recording_method: selectedExToAdd.recording_method || 'standard'
      };

      const extraFields = {};
      if (newEx.recording_method === 'duration_only') extraFields.duration_seconds = 0;
      else if (['distance_only', 'loaded_carry'].includes(newEx.recording_method)) extraFields.distance_meters = 0;

      const newExIdx = todayWorkout.exercises.length;
      const newSets = Array.from({ length: newEx.sets }, (_, sIdx) => ({
        set_number: sIdx + 1,
        planned_reps: newEx.reps,
        actual_reps: newEx.reps,
        completed: false,
        weight_kg: newEx.weight,
        is_warmup: false,
        ...extraFields
      }));

      setTodayWorkout(prev => ({
        ...prev,
        exercises: [...prev.exercises, newEx]
      }));

      setSessionState(prev => ({
        ...prev,
        setsData: {
          ...prev.setsData,
          [newExIdx]: newSets
        }
      }));

      setSelectedExToAdd(null);
      setAddExerciseSearch('');
      setShowAddExerciseModal(false);
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
          <div className="p-4 border-b border-base-300 flex items-center justify-between">
            <span className="font-bold text-base text-base-content">添加自定义动作</span>
            <button type="button" onClick={() => { setShowAddExerciseModal(false); setSelectedExToAdd(null); }} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="p-4 overflow-y-auto flex flex-col gap-4 flex-1">
            <input
              type="text"
              placeholder="搜索动作名称..."
              value={addExerciseSearch}
              onChange={(e) => setAddExerciseSearch(e.target.value)}
              className="input input-bordered w-full h-11 text-sm rounded-xl"
            />

            {!selectedExToAdd ? (
              <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto border border-base-300 rounded-xl p-1 bg-base-200/20">
                {filtered.slice(0, 30).map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedExToAdd(ex)}
                    className="flex items-center justify-between p-2.5 hover:bg-base-200 rounded-lg text-left text-sm text-base-content cursor-pointer transition-all border-0 bg-transparent w-full"
                  >
                    <span>{getExerciseCNName(ex.name)}</span>
                    <span className="text-xs text-base-content/40 font-mono capitalize">{ex.category}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-base-content/40">无匹配的动作</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 bg-base-200/50 p-3.5 rounded-xl border border-base-300 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-primary">{getExerciseCNName(selectedExToAdd.name)}</span>
                  <button type="button" onClick={() => setSelectedExToAdd(null)} className="text-xs text-base-content/50 hover:underline">重新选择</button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-base-content/50">重量 ({unit})</label>
                    <input
                      type="number"
                      value={chosenWeight}
                      onChange={(e) => setChosenWeight(e.target.value)}
                      className="input input-bordered w-full h-10 text-center font-mono text-sm rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-base-content/50">组数</label>
                    <input
                      type="number"
                      value={chosenSets}
                      onChange={(e) => setChosenSets(e.target.value)}
                      className="input input-bordered w-full h-10 text-center font-mono text-sm rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-base-content/50">次数</label>
                    <input
                      type="number"
                      value={chosenReps}
                      onChange={(e) => setChosenReps(e.target.value)}
                      className="input input-bordered w-full h-10 text-center font-mono text-sm rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-base-300 flex justify-end gap-2.5">
            <button type="button" onClick={() => { setShowAddExerciseModal(false); setSelectedExToAdd(null); }} className="btn btn-ghost btn-sm h-9 px-4 rounded-xl text-xs font-semibold">取消</button>
            <button
              type="button"
              disabled={!selectedExToAdd}
              onClick={handleConfirmAdd}
              className="btn btn-primary btn-sm h-9 px-5 rounded-xl text-xs font-bold text-primary-content"
            >
              确认添加
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ SESSION NOTES MODAL ============
  const renderSessionNotesModal = () => {
    if (!showSessionNotesModal) return null;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
          <div className="p-4 border-b border-base-300 flex items-center justify-between">
            <span className="font-bold text-base text-base-content">记录今日训练心得</span>
            <button type="button" onClick={() => setShowSessionNotesModal(false)} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="p-4 flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-base-content/50">心得体会 / 整体感受</label>
            <textarea
              value={sessionState.sessionNotes || ''}
              onChange={(e) => setSessionState(prev => ({ ...prev, sessionNotes: e.target.value }))}
              placeholder="记录本次训练的总结，例如：今天状态拉满、深蹲动作很顺畅、卧推最后有些力竭等..."
              className="textarea textarea-bordered w-full h-32 text-sm rounded-xl focus:border-primary"
            />
          </div>

          <div className="p-4 border-t border-base-300 flex justify-end gap-2.5">
            <button type="button" onClick={() => setShowSessionNotesModal(false)} className="btn btn-primary btn-sm h-9 px-5 rounded-xl text-xs font-bold text-primary-content">
              保存心得
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ SESSION SETTINGS MODAL ============
  const renderSessionSettingsModal = () => {
    if (!showSessionSettingsModal) return null;
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
        <div className="bottom-sheet-backdrop animate-sheet-fade-in" onClick={() => setShowSessionSettingsModal(false)} />
        <div className="bottom-sheet-container animate-sheet-slide-up w-full flex flex-col gap-4 pb-8">
          <div className="flex items-center justify-between pb-2 border-b border-base-300">
            <span className="font-bold text-sm text-base-content">训练会话设置</span>
            <button type="button" onClick={() => setShowSessionSettingsModal(false)} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="flex flex-col gap-3 my-2">
            <p className="text-xs text-base-content/60 leading-relaxed">
              在这里可以调整本次训练的整体状态。如果您需要结束本次训练，建议您完成所有动作后点击右上角的“完成”；若需要作废数据退出，请点击下方的放弃按钮。
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSessionSettingsModal(false);
              handleAbort();
            }}
            className="btn btn-error w-full h-11 rounded-xl text-sm font-bold text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <X size={16} />
            <span>放弃本次训练 (数据将不保存)</span>
          </button>
        </div>
      </div>
    );
  };

  // ============ SET SETTINGS MODAL ============
  const renderSetSettingsModal = () => {
    if (!showSetSettingsModal || settingsSetIndex === null || settingsExerciseIndex === null) return null;
    
    const exIdx = settingsExerciseIndex;
    const setIdx = settingsSetIndex;
    const ex = todayWorkout.exercises[exIdx];
    const set = sessionState.setsData[exIdx]?.[setIdx];
    if (!set) return null;
    
    const setKey = getSetKey(exIdx, setIdx);
    const detail = setDetails[setKey] || {};
    const isExhausted = !!detail.is_exhausted;
    const isSkipped = !!set.skipped;
    const isAmrap = !!set.is_amrap;

    const toggleExhaustion = () => {
      updateSetDetail(setKey, 'is_exhausted', !isExhausted);
      setShowSetSettingsModal(false);
    };

    const toggleAmrapSet = () => {
      const nextAmrap = !isAmrap;
      setSessionState(prev => {
        const nextSets = (prev.setsData[exIdx] || []).map((s, sIdx) => {
          if (sIdx === setIdx) {
            return { 
              ...s, 
              is_amrap: nextAmrap,
              actual_reps: nextAmrap ? '' : s.planned_reps
            };
          }
          return s;
        });
        return {
          ...prev,
          setsData: { ...prev.setsData, [exIdx]: nextSets }
        };
      });
      setShowSetSettingsModal(false);
    };

    const toggleSkipSet = () => {
      setSessionState(prev => {
        const nextSets = (prev.setsData[exIdx] || []).map((s, sIdx) => {
          if (sIdx === setIdx) {
            const nextSkipped = !s.skipped;
            return { 
              ...s, 
              skipped: nextSkipped,
              completed: nextSkipped ? false : s.completed
            };
          }
          return s;
        });
        return {
          ...prev,
          setsData: { ...prev.setsData, [exIdx]: nextSets }
        };
      });
      setShowSetSettingsModal(false);
      if (focusedSet && focusedSet.exerciseIdx === exIdx && focusedSet.setIdx === setIdx) {
        closeSetCard();
      }
    };

    const handleSyncToSubsequent = () => {
      const currentWeight = set.weight_kg ?? ex.weight;
      const currentReps = set.actual_reps ?? set.planned_reps;
      
      setSessionState(prev => {
        const nextSets = (prev.setsData[exIdx] || []).map((s, sIdx) => {
          if (sIdx > setIdx && !s.completed && !s.skipped) {
            return { ...s, weight_kg: currentWeight, planned_reps: currentReps };
          }
          return s;
        });
        return {
          ...prev,
          setsData: { ...prev.setsData, [exIdx]: nextSets }
        };
      });
      setShowSetSettingsModal(false);
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4" onClick={() => setShowSetSettingsModal(false)}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col p-4 gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between pb-1 border-b border-base-300">
            <span className="font-bold text-sm text-base-content">第 {set.set_number} 组管理菜单</span>
            <button type="button" onClick={() => setShowSetSettingsModal(false)} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={toggleAmrapSet}
              className={`btn btn-outline w-full h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isAmrap ? 'btn-accent border-accent bg-accent/5 text-accent-content' : 'border-base-300'
              }`}
            >
              ⚡ {isAmrap ? '回退为普通组' : '改为 AMRAP 组'}
            </button>

            <button
              type="button"
              onClick={toggleExhaustion}
              className={`btn btn-outline w-full h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isExhausted ? 'btn-warning border-warning bg-warning/5 text-warning-content' : 'border-base-300'
              }`}
            >
              ⭐ {isExhausted ? '取消标记力竭/失败' : '标记为力竭组 (Fail Set)'}
            </button>

            <button
              type="button"
              onClick={toggleSkipSet}
              className={`btn btn-outline w-full h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isSkipped ? 'btn-primary border-primary bg-primary/5 text-primary-content' : 'btn-error border-error bg-error/5 text-error-content'
              }`}
            >
              ⏭️ {isSkipped ? '恢复此组训练' : '跳过本组 (Skip Set)'}
            </button>

            <button
              type="button"
              onClick={handleSyncToSubsequent}
              className="btn btn-outline border-base-300 w-full h-11 rounded-xl text-sm font-bold text-base-content/85 hover:bg-base-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              🔄 同步重量和次数到后续组
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ EXERCISE SETTINGS MODAL ============
  const renderExerciseSettingsModal = () => {
    if (!showExerciseSettingsModal || settingsExIdx === null) return null;
    
    const exIdx = settingsExIdx;
    const ex = todayWorkout.exercises[exIdx];
    if (!ex) return null;

    const currentCategory = exercisesMap?.[ex.exercise]?.category;
    const allExs = Object.values(exercisesMap || {});
    const alternatives = allExs.filter(e => e.category === currentCategory && e.name !== ex.exercise);

    const handleReplaceExercise = (alternativeName) => {
      setTodayWorkout(prev => {
        const nextExs = (prev.exercises || []).map((e, idx) => {
          if (idx === exIdx) {
            return {
              ...e,
              exercise: alternativeName
            };
          }
          return e;
        });
        return { ...prev, exercises: nextExs };
      });

      setShowExerciseSettingsModal(false);
      setSettingsExIdx(null);
    };

    const handleSkipExercise = () => {
      const confirmSkip = window.confirm(`确定要跳过整组动作“${getExerciseCNName(ex.exercise)}”吗？`);
      if (confirmSkip) {
        setSessionState(prev => {
          const sets = prev.setsData[exIdx] || [];
          const nextSets = sets.map(s => ({ ...s, skipped: true, completed: false }));
          return {
            ...prev,
            setsData: { ...prev.setsData, [exIdx]: nextSets }
          };
        });
        setShowExerciseSettingsModal(false);
        setSettingsExIdx(null);
      }
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4" onClick={() => { setShowExerciseSettingsModal(false); setSettingsExIdx(null); }}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-base-300 flex items-center justify-between">
            <span className="font-bold text-base text-base-content">动作管理: {getExerciseCNName(ex.exercise)}</span>
            <button type="button" onClick={() => { setShowExerciseSettingsModal(false); setSettingsExIdx(null); }} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="p-4 overflow-y-auto flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-base-content/50 uppercase pl-1">快捷管理</span>
              <button
                type="button"
                onClick={handleSkipExercise}
                className="btn btn-outline border-error bg-error/5 hover:bg-error hover:text-white text-error w-full h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                ⏭️ 跳过整组动作
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-base-content/50 uppercase pl-1">平替动作更换（同类别: {currentCategory}）</span>
              <div className="flex flex-col gap-1 border border-base-300 rounded-xl p-1 bg-base-200/20 max-h-[220px] overflow-y-auto">
                {alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleReplaceExercise(alt.name)}
                    className="flex items-center justify-between p-2.5 hover:bg-base-200 rounded-lg text-left text-sm text-base-content cursor-pointer transition-all border-0 bg-transparent w-full"
                  >
                    <span>{getExerciseCNName(alt.name)}</span>
                    <span className="text-xs text-primary font-bold">更换</span>
                  </button>
                ))}
                {alternatives.length === 0 && (
                  <div className="p-4 text-center text-xs text-base-content/40">同类别下暂无备选动作</div>
                )}
              </div>
            </div>
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
      {/* 最小化倒计时悬浮条 */}
      {restTimer.active && restTimer.isMinimized && (
        <div 
          onClick={() => setRestTimer(prev => ({ ...prev, isMinimized: false }))}
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-12 bg-warning/15 dark:bg-warning/25 border-b border-warning/30 backdrop-blur z-[60] flex items-center justify-between px-4 cursor-pointer animate-fadeIn shadow-md"
        >
          <span className="text-xs font-black text-warning flex items-center gap-1.5 animate-pulse">
            ⏱️ 休息中: 还有 {restTimer.remaining} 秒 (点击恢复)
          </span>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); addRestTime(30); }} 
              className="btn btn-warning btn-outline btn-xs h-7 min-h-0 font-bold px-2.5 rounded-lg active:scale-95 transition-all text-[11px]"
            >
              +30s
            </button>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); skipRest(); }} 
              className="btn btn-warning btn-xs h-7 min-h-0 font-bold px-2.5 rounded-lg active:scale-95 transition-all text-warning-content text-[11px]"
            >
              跳过
            </button>
          </div>
        </div>
      )}

      {/* 顶部遮罩面板 */}
      <div className="bg-gradient-to-b from-base-100 via-base-100 to-base-100/95 border-b border-base-300 shadow-md px-4 pt-4 pb-3 flex flex-col gap-3 z-10 select-none">
        {/* 第一行：计时器与“完成”按钮 */}
        <div className="flex items-center justify-between">
          {/* 计时器显示 */}
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-base-content">
              {formatTime(secondsElapsed)}
            </span>
            <button
              type="button"
              onClick={() => {
                setSessionState(prev => {
                  if (prev.isPaused) {
                    return { ...prev, isPaused: false, startTime: Date.now() };
                  } else {
                    const currentElapsed = (prev.elapsedTime || 0) + Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000);
                    return { ...prev, isPaused: true, elapsedTime: currentElapsed };
                  }
                });
              }}
              className={`btn btn-circle btn-xs h-7 w-7 min-h-0 border-0 flex items-center justify-center transition-all ${
                sessionState.isPaused
                  ? 'bg-primary text-primary-content hover:bg-primary/95 animate-pulse'
                  : 'bg-base-200 text-base-content/70 hover:bg-base-300'
              }`}
              title={sessionState.isPaused ? "继续计时" : "暂停计时"}
            >
              {sessionState.isPaused ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
            </button>
          </div>

          {/* 右上角：“完成”打卡按钮 */}
          <button
            type="button"
            className="btn btn-primary btn-sm h-8 px-4 rounded-xl text-xs font-bold text-primary-content shadow-md active:scale-95 transition-all cursor-pointer"
            onClick={() => onSave(setDetails)}
          >
            完成
          </button>
        </div>

        {/* 第二行：计划DAY标题与实时训练统计数据 */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-1.5 text-base-content font-black text-lg">
            <span>{currentDay}</span>
          </div>
          
          <div className="text-right text-[10px] font-bold text-base-content/50 leading-tight">
            <div>
              {completedSets}/{totalSets}组 &nbsp;
              {completedExercises}/{totalExercises}动作
            </div>
            <div className="mt-0.5 font-mono text-[9.5px]">
              {displayCompletedVolume}/{displayPlannedVolume}{unit}容量
            </div>
          </div>
        </div>

        {/* 第三行：细长的进度条 */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 h-1.5 bg-base-200 dark:bg-base-300/40 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-black font-mono text-base-content/50 w-8 text-right">
            {progress}%
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-3 pb-24">
        {renderExerciseList()}
        {isSessionFinished() && (
          <div className="mt-2 animate-fadeIn">
            <button type="button" className="btn btn-success btn-lg btn-block text-success-content font-semibold gap-2 shadow-lg" onClick={() => onSave(setDetails)}><Sparkles size={18} />完成今日训练打卡</button>
          </div>
        )}
      </div>

      {/* Bottom Dock */}
      <div className="bg-base-100/95 border-t border-base-300 py-2.5 px-4 grid grid-cols-4 gap-1 z-10 shadow-lg select-none">
        <button
          type="button"
          onClick={onMinimize}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-lg">↘️</span>
          <span className="text-[10px] font-bold">最小化</span>
        </button>
        <button
          type="button"
          onClick={() => setShowAddExerciseModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-lg">➕</span>
          <span className="text-[10px] font-bold">加动作</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSessionNotesModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-lg">📝</span>
          <span className="text-[10px] font-bold">写心得</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSessionSettingsModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-lg">⚙️</span>
          <span className="text-[10px] font-bold">设置</span>
        </button>
      </div>

      {renderSetCard()}
      {renderRestCard()}
      {renderPlateHelperSheet()}
      {renderWeightCalculatorSheet()}
      {renderAddExerciseModal()}
      {renderSessionNotesModal()}
      {renderSessionSettingsModal()}
      {renderSetSettingsModal()}
      {renderExerciseSettingsModal()}
    </div>
  );
}

export default TrainSession;
