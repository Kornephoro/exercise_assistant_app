import { useState, useEffect, useMemo, useRef } from 'react';
import { Minimize2, X, Check, Sparkles, SkipForward, Plus, FastForward, Dumbbell, Calculator, Play, Pause, Settings, PenLine, Filter, Search, Zap, RotateCcw, RefreshCw, Timer, Lightbulb } from 'lucide-react';
import { convertWeight, getBarbellPlateBreakdown, toStorageWeight } from './unitUtils';
import BarbellVisualizer from './BarbellVisualizer';
import { fetchLatestOneRmForExercises } from './services/workoutService';
import InfiniteScrollPicker from './components/InfiniteScrollPicker';
import ConfirmDialog from './components/ConfirmDialog';
import { EXERCISE_TYPE_MAP } from './exerciseNames';
import { getNextSet } from './utils/trainingUtils';
import { MAIN_LIFT_KEYS, calcE1RM } from './oneRmUtils';

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

// 水平循环滚动对齐选择器 — 已移至共享组件 ./components/InfiniteScrollPicker


// ============ DURATION TIMER COMPONENT (for duration_only exercises) ============
const DurationTimer = ({ timerState, targetSeconds, onStateChange, onDurationFill, disabled }) => {
  const { mode = 'countdown', status = 'idle', displaySeconds = targetSeconds, prepRemaining = 5 } = timerState || {};
  const isIdle = status === 'idle';
  const isPrep = status === 'prep';
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isDone = status === 'done';

  const circumference = 2 * Math.PI * 45;
  let progressFraction;
  if (isPrep) {
    progressFraction = prepRemaining / 5;
  } else if (isIdle) {
    progressFraction = mode === 'countdown' ? 1 : 0;
  } else if (mode === 'countdown') {
    progressFraction = targetSeconds > 0 ? displaySeconds / targetSeconds : 0;
  } else {
    progressFraction = targetSeconds > 0 ? Math.min(displaySeconds / targetSeconds, 1) : 0;
  }
  const strokeDashoffset = circumference * (1 - progressFraction);

  let ringColor;
  if (isPrep) ringColor = 'text-amber-500';
  else if (isDone) ringColor = 'text-green-500';
  else if (isIdle) ringColor = 'text-base-content/15';
  else if (mode === 'countdown') {
    if (progressFraction > 0.5) ringColor = 'text-green-500';
    else if (progressFraction > 0.25) ringColor = 'text-yellow-500';
    else ringColor = 'text-red-500';
  } else ringColor = 'text-blue-500';

  const displayNum = isPrep ? prepRemaining : isIdle ? (mode === 'countdown' ? targetSeconds : 0) : displaySeconds;
  const isActive = isRunning || isPaused || isPrep;

  const startPrep = () => {
    onStateChange({ mode, status: 'prep', displaySeconds: mode === 'countdown' ? targetSeconds : 0, targetSeconds, prepRemaining: 5 });
  };
  const pauseTimer = () => onStateChange({ ...timerState, status: 'paused' });
  const resumeTimer = () => onStateChange({ ...timerState, status: 'running' });
  const stopAndFill = () => {
    const elapsed = mode === 'countdown' ? targetSeconds - displaySeconds : displaySeconds;
    onDurationFill(Math.max(elapsed, 0));
    onStateChange({ ...timerState, status: 'done' });
  };
  const resetTimer = () => onStateChange({ mode, status: 'idle', displaySeconds: mode === 'countdown' ? targetSeconds : 0, targetSeconds, prepRemaining: 5 });
  const cancelPrep = () => resetTimer();
  const switchMode = (newMode) => {
    if (isActive) return;
    onStateChange({ mode: newMode, status: 'idle', displaySeconds: newMode === 'countdown' ? targetSeconds : 0, targetSeconds, prepRemaining: 5 });
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* Mode Toggle — only in idle */}
      {isIdle && !disabled && (
        <div className="flex bg-base-200 rounded-lg p-0.5 gap-0.5">
          <button type="button"
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${mode === 'countdown' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
            onClick={() => switchMode('countdown')}
          >⏱ 倒计时</button>
          <button type="button"
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${mode === 'stopwatch' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
            onClick={() => switchMode('stopwatch')}
          >⏱ 正计时</button>
        </div>
      )}
      {/* Mode indicator when active */}
      {isActive && (
        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">
          {mode === 'countdown' ? '倒计时' : '正计时'}
        </span>
      )}

      {/* Timer Ring */}
      <div className="relative flex items-center justify-center" style={{ width: '7rem', height: '7rem' }}>
        <svg className="absolute inset-0" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-base-300" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            className={`${ringColor} transition-all duration-1000 ease-linear`} />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className={`text-3xl font-bold font-mono ${isDone ? 'text-green-500' : isPrep ? 'text-amber-500' : 'text-base-content'}`}>
            {displayNum}
          </span>
          <span className="text-xs text-base-content/40">秒</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-1.5 w-full justify-center">
        {isIdle && (
          <button type="button" className="btn btn-primary btn-sm font-bold gap-1.5 h-9 text-xs" onClick={startPrep} disabled={disabled}>
            <Play size={13} />
            开始{mode === 'countdown' ? `倒计时 (${targetSeconds}秒)` : '计时'}
          </button>
        )}
        {isRunning && (
          <>
            <button type="button" className="btn btn-ghost btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={pauseTimer}>
              <Pause size={13} /> 暂停
            </button>
            <button type="button" className="btn btn-error btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={stopAndFill}>
              <X size={13} /> 停止
            </button>
            <button type="button" className="btn btn-ghost btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={resetTimer}>
              <RotateCcw size={13} /> 重置
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button type="button" className="btn btn-primary btn-sm font-bold gap-1.5 h-9 text-xs" onClick={resumeTimer}>
              <Play size={13} /> 继续
            </button>
            <button type="button" className="btn btn-error btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={stopAndFill}>
              <X size={13} /> 停止
            </button>
            <button type="button" className="btn btn-ghost btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={resetTimer}>
              <RotateCcw size={13} /> 重置
            </button>
          </>
        )}
        {isDone && (
          <>
            <div className="flex items-center gap-1 text-xs font-bold text-green-500 w-full justify-center">
              <Check size={14} /> 已完成 {mode === 'countdown' ? (targetSeconds - displaySeconds) : displaySeconds}秒
            </div>
            <button type="button" className="btn btn-ghost btn-outline btn-sm font-bold gap-1.5 h-9 text-xs" onClick={resetTimer}>
              <RotateCcw size={13} /> 再来一次
            </button>
          </>
        )}
      </div>
    </div>
  );
};

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
  isSaving = false,
  onCancel,
  gymEquipmentConfig = null,
  unit = 'kg',
  restTimer,
  setRestTimer,
  historyByExerciseTier = {},
  exerciseConfig = {},
  onChangeExerciseUnit
}) {
  if (!todayWorkout || !todayWorkout.exercises) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main dark:bg-bg-main-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-ring loading-lg text-primary text-primary-dark"></div>
          <span className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark">正在准备训练数据...</span>
        </div>
      </div>
    );
  }

  const getRecordingMethod = (exerciseKey) => exercisesMap?.[exerciseKey]?.recording_method || 'standard';

  const handleSyncWeightToSubsequentSets = (exIdx, currentSetIdx, weightKg) => {
    setSessionState(prev => {
      const sets = prev.setsData[exIdx] || [];
      const nextSets = sets.map((s, idx) => {
        if (idx > currentSetIdx && !s.completed && !s.skipped) {
          return { ...s, weight_kg: weightKg };
        }
        return s;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIdx]: nextSets }
      };
    });
  };

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

  // 仅时长动作计时器状态: { [`${exIdx}_${setIdx}`]: { mode, status, displaySeconds, targetSeconds, prepRemaining } }
  const [durationTimers, setDurationTimers] = useState({});

  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showSessionNotesModal, setShowSessionNotesModal] = useState(false);
  const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);
  const [customStartTime, setCustomStartTime] = useState(''); // "HH:MM"
  const [customDurationMinutes, setCustomDurationMinutes] = useState('');

  const handleOpenCustomTimeModal = () => {
    const date = new Date(sessionState.startTime || Date.now());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    setCustomStartTime(`${hours}:${minutes}`);
    
    const minutesElapsed = Math.round(secondsElapsed / 60);
    setCustomDurationMinutes(String(minutesElapsed || 45));
    
    setShowCustomTimeModal(true);
  };

  const handleSaveCustomTime = () => {
    const durationMin = parseFloat(customDurationMinutes) || 45;
    const durationSeconds = Math.round(durationMin * 60);

    const [hours, minutes] = customStartTime.split(':').map(v => parseInt(v, 10));
    const newStart = new Date(sessionState.startTime || Date.now());
    if (!isNaN(hours) && !isNaN(minutes)) {
      newStart.setHours(hours);
      newStart.setMinutes(minutes);
      newStart.setSeconds(0);
    }
    
    setSessionState(prev => {
      const isPaused = !!prev.isPaused;
      return {
        ...prev,
        isPaused,
        ...(isPaused ? {
          startTime: newStart.getTime(),
          elapsedTime: durationSeconds
        } : {
          startTime: Date.now() - durationSeconds * 1000,
          elapsedTime: 0
        })
      };
    });

    setSecondsElapsed(durationSeconds);
    setShowCustomTimeModal(false);
  };

  const [showSessionSettingsModal, setShowSessionSettingsModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // { title, message, onConfirm, variant }

  // Group settings state
  const [showSetSettingsModal, setShowSetSettingsModal] = useState(false);
  const [settingsSetIndex, setSettingsSetIndex] = useState(null);
  const [settingsExerciseIndex, setSettingsExerciseIndex] = useState(null);

  // Exercise settings state
  const [showExerciseSettingsModal, setShowExerciseSettingsModal] = useState(false);
  const [settingsExIdx, setSettingsExIdx] = useState(null);
  const [replaceExerciseSearch, setReplaceExerciseSearch] = useState('');
  const [showReplaceSheet, setShowReplaceSheet] = useState(false);

  // Shared exercise filter states (for add & replace)
  const [exFilterType, setExFilterType] = useState('');
  const [exFilterPattern, setExFilterPattern] = useState('');
  const [exFilterEquipment, setExFilterEquipment] = useState('');

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

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSecondsElapsed(calculateElapsed());
    });

    if (sessionState.isPaused) {
      return () => { cancelled = true; };
    }

    const interval = setInterval(() => {
      setSecondsElapsed(calculateElapsed());
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionState.isActive, sessionState.startTime, sessionState.elapsedTime, sessionState.isPaused]);

  // 仅时长动作计时器 — 每秒 tick
  useEffect(() => {
    const hasActive = Object.values(durationTimers).some(
      t => t.status === 'running' || t.status === 'prep'
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      setDurationTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          const t = next[key];
          if (t.status === 'prep') {
            const newRemaining = t.prepRemaining - 1;
            if (newRemaining <= 0) {
              // 准备结束 → 切换到 running
              next[key] = { ...t, status: 'running', prepRemaining: 0 };
            } else {
              next[key] = { ...t, prepRemaining: newRemaining };
            }
            changed = true;
          } else if (t.status === 'running') {
            if (t.mode === 'countdown') {
              const newDisplay = t.displaySeconds - 1;
              if (newDisplay <= 0) {
                // 倒计时到 0 → done，标记 autoFill 让 set card 自动填入时长
                next[key] = { ...t, status: 'done', displaySeconds: 0, autoFill: t.targetSeconds };
              } else {
                next[key] = { ...t, displaySeconds: newDisplay };
              }
            } else {
              // 正计时：递增
              next[key] = { ...t, displaySeconds: t.displaySeconds + 1 };
            }
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [durationTimers]);

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

  // getNextSet 已提取到 utils/trainingUtils.js（同时修复了遗漏 completed 检查的 bug）

  // 训练实时统计数据计算
  const totalSets = getTotalSets();
  const completedSets = getCompletedSets();

  const totalExercises = todayWorkout?.exercises?.length || 0;
  const completedExercises = (todayWorkout?.exercises || []).reduce((count, ex, idx) => {
    const sets = sessionState.setsData[idx] || [];
    const nonSkipped = sets.filter(s => !s.skipped);
    if (nonSkipped.length > 0 && nonSkipped.every(s => s.completed)) {
      return count + 1;
    }
    return count;
  }, 0);

  const { displayPlannedVolume, displayCompletedVolume } = (() => {
    let totalPlannedVolume = 0;
    let completedVolume = 0;

    (todayWorkout?.exercises || []).forEach((ex, exIdx) => {
      const method = exercisesMap?.[ex.exercise]?.recording_method || 'standard';
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
  })();

  // Derived filter options for exercise picker (add & replace sheets)
  const exFilterOptions = useMemo(() => {
    const allExs = Object.values(exercisesMap || {});
    const types = [...new Set(allExs.map(e => e.exercise_type).filter(Boolean))].sort();
    const patterns = [...new Set(allExs.map(e => e.movement_pattern).filter(Boolean))].sort();
    const equipments = [...new Set(allExs.flatMap(e => e.equipment || []).filter(Boolean))].sort();
    return { types, patterns, equipments };
  }, [exercisesMap]);


  useEffect(() => {
    if (!showSetCard) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setShowPlateHelper(false);
        setCalcOpen(false);
      });
      return () => { cancelled = true; };
    }
  }, [showSetCard]);

  // 初始化仅时长动作的计时器状态
  useEffect(() => {
    if (!showSetCard || !focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout?.exercises?.[exerciseIdx];
    if (!ex) return;
    const method = getRecordingMethod(ex.exercise);
    if (method !== 'duration_only') return;
    const dtKey = `${exerciseIdx}_${setIdx}`;
    setDurationTimers(prev => {
      if (prev[dtKey]) return prev; // 已有状态，保留（支持后台运行）
      const target = ex.reps || 30;
      return {
        ...prev,
        [dtKey]: { mode: 'countdown', status: 'idle', displaySeconds: target, targetSeconds: target, prepRemaining: 5 }
      };
    });
  }, [showSetCard, focusedSet, todayWorkout?.exercises]);

  // 仅时长计时器倒计时到 0 时自动填入 duration_seconds
  useEffect(() => {
    let applied = false;
    setDurationTimers(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const t = next[key];
        if (t?.autoFill !== undefined && !applied) {
          // key format: `${exIdx}_${setIdx}`
          const [exIdxStr, setIdxStr] = key.split('_');
          const exIdx = parseInt(exIdxStr, 10);
          const setIdx = parseInt(setIdxStr, 10);
          if (!isNaN(exIdx) && !isNaN(setIdx)) {
            handleDurationChange(exIdx, setIdx, t.autoFill);
            applied = true;
          }
          next[key] = { ...t, autoFill: undefined };
        }
      }
      return applied ? next : prev;
    });
  }, [durationTimers]);

  const [customRestSeconds, setCustomRestSeconds] = useState(DEFAULT_REST_SECONDS);

  const handleOpenCalculator = async (ex, currentWeightVal) => {
    const exUnit = exerciseConfig?.[ex.exercise]?.unit || unit || 'kg';
    setCalcLoading(true);
    setCalcOpen(true);
    try {
      const records = await fetchLatestOneRmForExercises([ex.exercise]);
      const latestRecord = records.find(r => r.exercise === ex.exercise);
      if (latestRecord && latestRecord.e1rm_kg) {
        const valInUnit = exUnit === 'lbs' ? convertWeight(latestRecord.e1rm_kg, 'lbs') : latestRecord.e1rm_kg;
        setCalcBaseline1RM(valInUnit.toFixed(1));
      } else {
        const fallbackWeight = currentWeightVal ?? ex.weight ?? 0;
        const fallbackInUnit = exUnit === 'lbs' ? convertWeight(fallbackWeight, 'lbs') : fallbackWeight;
        setCalcBaseline1RM(fallbackInUnit > 0 ? fallbackInUnit.toFixed(1) : '');
      }
    } catch (err) {
      console.error('Failed to fetch latest 1RM:', err);
      const fallbackWeight = currentWeightVal ?? ex.weight ?? 0;
      const fallbackInUnit = exUnit === 'lbs' ? convertWeight(fallbackWeight, 'lbs') : fallbackWeight;
      setCalcBaseline1RM(fallbackInUnit > 0 ? fallbackInUnit.toFixed(1) : '');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleApplyWeight = (calculatedWeight) => {
    if (!focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const exUnit = exerciseConfig?.[ex?.exercise]?.unit || unit || 'kg';
    const weightKg = exUnit === 'lbs' ? toStorageWeight(calculatedWeight, 'lbs') : calculatedWeight;
    const finalWeight = Math.round(weightKg * 10) / 10;
    handleWeightChange(exerciseIdx, setIdx, finalWeight);
    setCalcOpen(false);
  };

  // openSetCard and closeSetCard are now props passed from App.jsx to sync with history popstate

  const adjustCustomRest = (delta) => {
    setCustomRestSeconds(prev => Math.max(0, prev + delta));
  };

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
    const setKey = getSetKey(exerciseIdx, setIdx);
    const exercise = todayWorkout?.exercises?.[exerciseIdx];
    const method = exercise ? getRecordingMethod(exercise.exercise) : 'standard';
    const shouldRecordTempo = ['standard', 'reps_only', 'bodyweight_added', 'bodyweight_assisted'].includes(method);
    setSetDetails(prev => {
      const detail = prev[setKey] || {};
      return {
        ...prev,
        [setKey]: {
          ...detail,
          tempo_eccentric: shouldRecordTempo && detail.record_tempo !== false ? (detail.tempo_eccentric ?? 3) : detail.tempo_eccentric,
          tempo_pause_bottom: shouldRecordTempo && detail.record_tempo !== false ? (detail.tempo_pause_bottom ?? 1) : detail.tempo_pause_bottom,
          tempo_concentric: shouldRecordTempo && detail.record_tempo !== false ? (detail.tempo_concentric ?? 1) : detail.tempo_concentric,
          tempo_pause_top: shouldRecordTempo && detail.record_tempo !== false ? (detail.tempo_pause_top ?? 0) : detail.tempo_pause_top,
          rest_duration: detail.record_rest === false ? null : customRestSeconds
        }
      };
    });
    handleToggleSet(exerciseIdx, setIdx);

    // 清理仅时长计时器
    const dtKey = `${exerciseIdx}_${setIdx}`;
    if (method === 'duration_only') {
      setDurationTimers(prev => {
        if (!prev[dtKey]) return prev;
        const next = { ...prev };
        delete next[dtKey];
        return next;
      });
    }

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
    // 清理仅时长计时器
    const dtKey = `${exIdx}_${setIdx}`;
    setDurationTimers(prev => {
      if (!prev[dtKey]) return prev;
      const next = { ...prev };
      delete next[dtKey];
      return next;
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
    setConfirmState({
      title: '放弃本次训练',
      message: '确定要放弃本次训练吗？所有未保存的训练数据都将丢失！',
      variant: 'error',
      confirmLabel: '放弃训练',
      onConfirm: () => { setConfirmState(null); onCancel(); }
    });
  };

  // Replaces the exercise at settingsExIdx with the selected alternative
  const handleReplaceExercise = (alternativeName) => {
    const exIdx = settingsExIdx;
    if (exIdx === null || exIdx === undefined) return;
    const ex = todayWorkout?.exercises?.[exIdx];
    if (!ex) return;

    const selectedEx = exercisesMap?.[alternativeName];
    const newMethod = selectedEx?.recording_method || 'standard';

    setTodayWorkout(prev => {
      const nextExs = (prev.exercises || []).map((e, idx) => {
        if (idx === exIdx) {
          return {
            ...e,
            exercise: alternativeName,
            recording_method: newMethod
          };
        }
        return e;
      });
      return { ...prev, exercises: nextExs };
    });

    // 智能修正 setsData 中的额外属性
    setSessionState(prev => {
      const nextSets = sets.map(s => {
        const nextSet = { ...s };
        if (newMethod === 'duration_only') {
          nextSet.duration_seconds = nextSet.duration_seconds ?? 30;
          delete nextSet.weight_kg;
        } else if (['distance_only', 'loaded_carry'].includes(newMethod)) {
          nextSet.distance_meters = nextSet.distance_meters ?? 0;
          delete nextSet.weight_kg;
        } else {
          nextSet.weight_kg = nextSet.weight_kg ?? ex.weight ?? 0;
        }
        return nextSet;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIdx]: nextSets }
      };
    });

    setShowReplaceSheet(false);
    setShowExerciseSettingsModal(false);
    setSettingsExIdx(null);
  };

  // ============ SET DETAIL CARD (floating centered) ============
  const renderSetCard = () => {
    if (!showSetCard || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!set) return null;

    const exInfo = exercisesMap?.[ex.exercise];
    const isBarbell = exInfo?.equipment?.includes('barbell') || 
                      MAIN_LIFT_KEYS.includes(ex.exercise.toLowerCase());

    const exUnit = exerciseConfig?.[ex.exercise]?.unit || unit || 'kg';
    const method = getRecordingMethod(ex.exercise);
    const setKey = getSetKey(exerciseIdx, setIdx);
    const detail = setDetails[setKey] || {};
    const rpeValue = detail.rpe ?? 7;
    const totalSets = sessionState.setsData[exerciseIdx].length;
    const isSkipped = !!set.skipped;
    const isCompleted = !!set.completed;

    const getDisplayWeightStr = (w) => {
      if (w == null) return '';
      return exUnit === 'lbs' ? `${convertWeight(w, 'lbs').toFixed(1)}lbs` : `${w.toFixed(1)}kg`;
    };

    const METHOD_CONFIG = {
      standard:           { summary: (s, ex) => `${s.planned_reps} 次 @ ${getDisplayWeightStr(s.weight_kg ?? ex.weight)}`,    fields: ['reps', 'weight'],        showTempo: true  },
      reps_only:          { summary: (s)     => `${s.planned_reps} 次`,                                  fields: ['reps'],                  showTempo: true  },
      duration_only:      { summary: (s)     => `${s.planned_reps} 秒`,                                  fields: ['duration'],              showTempo: false },
      distance_only:      { summary: (s)     => `${s.planned_reps} 米`,                                  fields: ['distance'],              showTempo: false },
      loaded_carry:       { summary: (s, ex) => `${s.planned_reps}m @ ${getDisplayWeightStr(s.weight_kg ?? ex.weight)}`,      fields: ['weight', 'distance'],    showTempo: false },
      bodyweight_added:   { summary: (s, ex) => `${s.planned_reps} 次 @ +${getDisplayWeightStr(s.weight_kg ?? ex.weight)}`,  fields: ['reps', 'weight'],        showTempo: true  },
      bodyweight_assisted:{ summary: (s, ex) => `${s.planned_reps} 次 @ -${getDisplayWeightStr(s.weight_kg ?? ex.weight)}`,  fields: ['reps', 'weight'],        showTempo: true  },
    };
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.standard;

    const FIELD_LABEL = {
      reps:     '实际次数',
      weight:   method === 'bodyweight_added' ? `附加重量 (${exUnit})` : method === 'bodyweight_assisted' ? `辅助重量 (${exUnit})` : method === 'loaded_carry' ? `负重重量 (${exUnit})` : `实际重量 (${exUnit})`,
      duration: '时长（秒）',
      distance: '距离（米）',
    };

    // 仅时长动作计时器状态与处理器
    const dtKey = `${exerciseIdx}_${setIdx}`;
    const dt = durationTimers[dtKey];
    const targetSeconds = set.planned_reps || 30;
    const isDurationMethod = method === 'duration_only';
    const dtPrepActive = dt?.status === 'prep';

    const handleTimerStateChange = (newState) => {
      setDurationTimers(prev => ({ ...prev, [dtKey]: newState }));
    };
    const handleTimerDurationFill = (seconds) => {
      handleDurationChange(exerciseIdx, setIdx, seconds);
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={closeSetCard}>
        <div className={`bg-base-100 rounded-2xl shadow-2xl w-full max-w-md ${(isDurationMethod) ? 'relative overflow-hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
          {/* Prep Overlay — 覆盖 set card 内容区 */}
          {dtPrepActive && (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center bg-base-100/95 backdrop-blur rounded-2xl gap-4">
              <span className="text-lg font-bold text-base-content/70">🏃 准备！</span>
              <span className="text-8xl font-black text-primary animate-pulse">{dt.prepRemaining}</span>
              <span className="text-sm text-base-content/50">秒后开始</span>
              <button type="button" className="btn btn-ghost btn-sm mt-2"
                onClick={() => setDurationTimers(prev => {
                  const next = { ...prev };
                  if (next[dtKey]) next[dtKey] = { mode: 'countdown', status: 'idle', displaySeconds: targetSeconds, targetSeconds, prepRemaining: 5 };
                  return next;
                })}
              >取消</button>
            </div>
          )}
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
                  className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-full flex items-center justify-center cursor-pointer"
                  aria-label="组管理"
                >
                  <Settings size={14} />
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

            {/* Summary / Timer Area */}
            {isDurationMethod ? (
              <DurationTimer
                timerState={dt}
                targetSeconds={targetSeconds}
                onStateChange={handleTimerStateChange}
                onDurationFill={handleTimerDurationFill}
                disabled={isSkipped || isCompleted}
              />
            ) : (
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
            )}

            {/* 双进阶组级提示 */}
            {(() => {
              const exConfig = exerciseConfig?.[ex.exercise];
              const isDoubleProg = exConfig?.progression_type === 'double_progression';
              if (!isDoubleProg) return null;

              const maxR = exConfig.max_reps ?? 15;
              const unitLabel = method === 'duration_only' ? '秒' : method === 'distance_only' ? '米' : '次';
              const hist = historyByExerciseTier?.[ex.exercise]?.[ex.tier || 'T3'] || [];
              const lastWorkout = hist.length > 0 ? hist[hist.length - 1] : null;
              
              // 获取上一次训练相同序号的组
              const lastWorkoutSets = lastWorkout?.sets?.filter(s => !s.is_warmup) || [];
              const lastSetForIdx = lastWorkoutSets[setIdx];
              let lastValText = '无记录';
              if (lastSetForIdx) {
                if (method === 'duration_only') lastValText = `${lastSetForIdx.duration_seconds || lastSetForIdx.planned_reps}秒`;
                else if (method === 'distance_only' || method === 'loaded_carry') lastValText = `${lastSetForIdx.distance_meters || lastSetForIdx.planned_reps}米`;
                else lastValText = `${lastSetForIdx.actual_reps ?? lastSetForIdx.planned_reps}次`;
              }

              return (
                <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent font-bold flex items-center justify-between">
                  <span>🎯 双进阶本组指引</span>
                  <span>目标：{ex.reps}{unitLabel} (上限: {maxR}{unitLabel}) | 上次：{lastValText}</span>
                </div>
              );
            })()}

            {/* Dynamic Input Area - method-aware */}
            <FieldInputGroup
              fields={config.fields}
              valueMap={{
                reps:     set.actual_reps,
                weight:   exUnit === 'lbs' ? convertWeight(set.weight_kg ?? ex.weight, 'lbs') : (set.weight_kg ?? ex.weight),
                duration: set.duration_seconds,
                distance: set.distance_meters,
              }}
              onChangeMap={{
                reps:     (v) => handleRepsChange(exerciseIdx, setIdx, v),
                weight:   (v) => {
                  const kgVal = exUnit === 'lbs' ? toStorageWeight(v, 'lbs') : v;
                  handleWeightChange(exerciseIdx, setIdx, kgVal);
                },
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

            {config.fields.includes('weight') && setIdx < totalSets - 1 && (
              <button
                type="button"
                onClick={() => handleSyncWeightToSubsequentSets(exerciseIdx, setIdx, set.weight_kg ?? ex.weight)}
                className="btn btn-outline btn-xs text-[10px] py-1 h-auto min-h-0 border-primary/20 text-primary hover:bg-primary hover:text-primary-content rounded-xl flex items-center justify-center gap-1 select-none cursor-pointer w-fit self-end mr-1 mt-1"
              >
                <RefreshCw size={11} />
                <span>将此重量同步到后续未打卡组</span>
              </button>
            )}

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
                  {TEMPO_PRESETS.slice(0, 3).map((preset) => (
                    <button
                      key={preset.label}
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
              <div className="flex items-center justify-between h-6">
                <div className="flex items-center gap-2 select-none">
                  <label className="text-xs font-semibold text-base-content/50">组间休息（秒）</label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-xs rounded"
                      checked={detail.record_rest !== false}
                      onChange={(e) => updateSetDetail(setKey, 'record_rest', e.target.checked)}
                    />
                    <span className="text-[11px] text-base-content/40 font-bold">记录</span>
                  </label>
                </div>
                {detail.record_rest === false && (
                  <span className="text-xs font-semibold text-base-content/30">不记录</span>
                )}
              </div>
              <div className={`flex items-stretch gap-1.5 transition-all duration-200 ${detail.record_rest === false ? 'opacity-30 pointer-events-none' : ''}`}>
                <button type="button" onClick={() => adjustCustomRest(-30)}
                  disabled={detail.record_rest === false}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-base-content/70 hover:text-error hover:border-error/50 active:scale-95"
                  aria-label="减少 30 秒"
                >-30s</button>
                <button type="button" onClick={() => adjustCustomRest(-10)}
                  disabled={detail.record_rest === false}
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
                  disabled={detail.record_rest === false}
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
                  disabled={detail.record_rest === false}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-primary hover:bg-primary hover:text-primary-content hover:border-primary active:scale-95"
                  aria-label="增加 10 秒"
                >+10s</button>
                <button type="button" onClick={() => adjustCustomRest(30)}
                  disabled={detail.record_rest === false}
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
                      // 重置仅时长计时器
                      const dtKey = `${exerciseIdx}_${setIdx}`;
                      if (getRecordingMethod(ex.exercise) === 'duration_only') {
                        const target = ex.reps || 30;
                        setDurationTimers(prev => ({ ...prev, [dtKey]: { mode: 'countdown', status: 'idle', displaySeconds: target, targetSeconds: target, prepRemaining: 5 } }));
                      }
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
                      // 重置仅时长计时器
                      const dtKey = `${exerciseIdx}_${setIdx}`;
                      setDurationTimers(prev => {
                        if (prev[dtKey]) {
                          const target = prev[dtKey].targetSeconds || 30;
                          return { ...prev, [dtKey]: { mode: 'countdown', status: 'idle', displaySeconds: target, targetSeconds: target, prepRemaining: 5 } };
                        }
                        return prev;
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
              <Minimize2 size={15} />
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

          const exUnit = exerciseConfig?.[ex.exercise]?.unit || unit || 'kg';

          return (
            <div key={exIdx} className={`card bg-base-100 border border-base-300 border-l-4 ${tierBorder} shadow-sm transition-all duration-300 ${isFullyCompleted ? 'opacity-50' : ''}`}>
              <div className="card-body px-0 py-3 gap-2">
                <div className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                    <span className="text-sm font-bold text-base-content">{getExerciseCNName(ex.exercise)}</span>
                    <span className="text-xs font-mono font-bold text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded">
                      {exUnit === 'lbs' ? `${convertWeight(ex.weight, 'lbs').toFixed(1)}lbs` : `${ex.weight?.toFixed(1)}kg`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newUnit = exUnit === 'lbs' ? 'kg' : 'lbs';
                        onChangeExerciseUnit?.(ex.exercise, newUnit);
                      }}
                      className="text-[10px] font-mono font-bold text-primary dark:text-primary-dark bg-primary/5 dark:bg-primary/10 border border-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/20 select-none cursor-pointer"
                      title="切换单位"
                    >
                      {exUnit}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-base-content/40">{completedCount}/{sets.length}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsExIdx(exIdx);
                        const curType = exercisesMap?.[ex.exercise]?.exercise_type || '';
                        setExFilterType(curType);
                        setExFilterPattern('');
                        setExFilterEquipment('');
                        setReplaceExerciseSearch('');
                        setShowExerciseSettingsModal(true);
                      }}
                      className="btn btn-ghost btn-circle btn-xs h-6 w-6 min-h-0 text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-full flex items-center justify-center cursor-pointer"
                      title="动作设置"
                    >
                      <Settings size={13} />
                    </button>
                  </div>
                </div>

                {/* 双进阶模式额外信息提示 */}
                {(() => {
                  const exConfig = exerciseConfig?.[ex.exercise];
                  const isDoubleProg = exConfig?.progression_type === 'double_progression';
                  if (!isDoubleProg) return null;

                  const minR = exConfig.min_reps ?? 12;
                  const maxR = exConfig.max_reps ?? 15;
                  const recMethod = exercisesMap?.[ex.exercise]?.recording_method || ex.recording_method || 'standard';
                  const unitLabel = recMethod === 'duration_only' ? '秒' : recMethod === 'distance_only' ? '米' : '次';

                  // 获取历史记录
                  const hist = historyByExerciseTier?.[ex.exercise]?.[tier] || [];
                  const lastWorkout = hist.length > 0 ? hist[hist.length - 1] : null;
                  const lastWorkSets = lastWorkout?.sets?.filter(s => !s.is_warmup) || [];
                  const lastRepsText = lastWorkSets.length > 0 
                    ? lastWorkSets.map(s => {
                        if (recMethod === 'duration_only') return s.duration_seconds || s.planned_reps;
                        if (recMethod === 'distance_only' || recMethod === 'loaded_carry') return s.distance_meters || s.planned_reps;
                        return s.actual_reps ?? s.planned_reps;
                      }).join(', ') + ' ' + unitLabel
                    : '无历史记录';

                  return (
                    <div className="flex flex-col gap-1 mx-3 px-2.5 py-2 rounded-xl bg-accent/5 dark:bg-accent/10 border border-accent/10 text-xs text-accent">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="badge badge-accent badge-outline scale-90 px-1.5 text-[9px] font-extrabold">双进阶</span>
                        <span>目标：本次每组 {ex.reps} {unitLabel}（区间：{minR}~{maxR} {unitLabel}，达上限加重）</span>
                      </div>
                      <div className="text-base-content/60 font-semibold flex items-center gap-1">
                        <span>📈 上次表现：</span>
                        <span className="font-mono text-base-content">{lastRepsText}</span>
                        <span className="text-[10px] text-base-content/40 ml-1">（本次请尽力超越上次）</span>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const exInfo = exercisesMap?.[ex.exercise];
                  const isBarbell = exInfo?.equipment?.includes('barbell') || 
                                    MAIN_LIFT_KEYS.includes(ex.exercise.toLowerCase());
                  if (!isBarbell || !gymEquipmentConfig) return null;
                  
                  const configForUnit = gymEquipmentConfig[exUnit] || gymEquipmentConfig.kg;
                  const barWeight = configForUnit.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
                  const enabledPlates = configForUnit.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
                  const plateLimits = configForUnit.barbell?.plate_limits || {};
                  
                  const weightInUnit = exUnit === 'lbs' ? convertWeight(ex.weight, 'lbs') : ex.weight;
                  const breakdown = getBarbellPlateBreakdown(weightInUnit, barWeight, enabledPlates, plateLimits);
                   if (!breakdown || breakdown.plates.length === 0) {
                    return (
                      <div className="flex flex-col gap-1.5 mb-2 select-none w-full px-3">
                        <div className="text-[10px] text-base-content/45 bg-base-200/50 px-2.5 py-1.5 rounded-lg font-semibold w-fit border border-base-300/40">
                          <Lightbulb size={12} className="inline shrink-0" /> 配片: 空杆 {barWeight}{exUnit}
                        </div>
                      </div>
                    );
                  }
                  
                  const counts = {};
                  breakdown.plates.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
                  const plateTexts = Object.entries(counts)
                    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                    .map(([plate, count]) => `${plate}${exUnit} × ${count}`);
                  
                  return (
                    <div className="flex flex-col gap-1.5 mb-2 select-none w-full px-3">
                      <div className="text-[10px] text-primary dark:text-primary-dark bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1 font-semibold">
                        <span><Lightbulb size={12} className="inline shrink-0" /> 配片建议:</span>
                        <span>{barWeight}{exUnit} 空杆 + 单侧 [{plateTexts.join(', ')}]</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-2.5">
                  {ex.needs_retest ? (
                    renderRetestCard(ex, exIdx)
                  ) : (
                    <>
                      {sets.map((set, setIdx) => {
                        const setKey = getSetKey(exIdx, setIdx);
                        const detail = setDetails[setKey] || {};
                        const isLastSet = setIdx === sets.length - 1;
                        const isSkipped = !!set.skipped;
                        
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
                                <div className="w-8 h-8 rounded-full border border-base-300 flex items-center justify-center"><SkipForward size={12} className="text-base-content/30" /></div>
                              ) : set.completed ? (
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><Check size={14} className="text-white" /></div>
                              ) : (
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isLastSet ? 'border-primary' : 'border-base-300'}`}><span className="text-xs font-bold text-base-content/40">{set.set_number}</span></div>
                              )}
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${isSkipped ? 'text-base-content/40' : set.completed ? 'text-base-content/30 line-through' : 'text-base-content'}`}>
                                  第 {set.set_number} 组
                                </span>
                                <span className="text-xs font-semibold text-base-content/40">目标: {set.planned_reps}{set.is_amrap && (() => { const m = getRecordingMethod(ex.exercise); return m !== 'duration_only' && m !== 'distance_only'; })() ? '+' : ''}{(() => { const m = getRecordingMethod(ex.exercise); return m === 'duration_only' ? '秒' : m === 'distance_only' ? '米' : '次'; })()}</span>
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
                                      {exUnit === 'lbs' 
                                        ? `${convertWeight(set.weight_kg || ex.weight, 'lbs').toFixed(1)}lbs` 
                                        : `${(set.weight_kg || ex.weight)?.toFixed(1)}kg`
                                      }
                                    </span>
                                  )}
                                  {set.completed && <span className="text-base font-mono font-black text-green-500">{set.actual_reps ?? set.planned_reps}{(() => { const m = getRecordingMethod(ex.exercise); return m === 'duration_only' ? '秒' : m === 'distance_only' ? '米' : '次'; })()}</span>}
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(getRecordingMethod(ex.exercise)) && sets.length > 1 && (
                        <div className="flex justify-end px-3">
                          <button
                            type="button"
                            onClick={() => {
                              const currentWeight = sets[0]?.weight_kg ?? ex.weight ?? 0;
                              handleSyncWeightToSubsequentSets(exIdx, -1, currentWeight);
                            }}
                            className="btn btn-ghost btn-xs text-primary dark:text-primary-dark font-extrabold gap-1 px-2 py-1 select-none cursor-pointer rounded bg-primary/5 hover:bg-primary/10"
                          >
                            <RefreshCw size={11} />
                            <span>同步首组重量到其余未完成组</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRetestCard = (ex, exIdx) => {
    const exUnit = exerciseConfig?.[ex.exercise]?.unit || unit || 'kg';
    const set = sessionState.setsData[exIdx]?.[0];
    if (!set) return null;

    const testWeight = set.weight_kg ?? ex.weight ?? 0;
    const testReps = set.actual_reps ?? '';

    let estimated1RM = 0;
    let estimated5RM = 0;
    let recommendedStartWeight = 0;

    if (testWeight > 0 && testReps > 0) {
      const e1rmResult = calcE1RM(testWeight, testReps);
      if (e1rmResult.valid) {
        estimated1RM = e1rmResult.e1rm;
        estimated5RM = Math.round(estimated1RM * 0.863 * 10) / 10;
        const ratio = ex.tier === 'T2' ? 0.65 : 0.85;
        const rawStart = ex.tier === 'T2' ? estimated1RM * 0.65 : estimated5RM * 0.85;
        recommendedStartWeight = roundExerciseWeight(rawStart, exercisesMap[ex.exercise], gymEquipmentConfig, exUnit);
      }
    }

    const currentStartWeightKg = set.retest_start_weight ?? recommendedStartWeight;

    const handleConfirmRetest = () => {
      if (testWeight <= 0 || !testReps || parseInt(testReps, 10) <= 0) {
        alert('请输入有效的测试重量和次数！');
        return;
      }
      const finalStartWeight = set.retest_start_weight ?? recommendedStartWeight;
      if (finalStartWeight <= 0) {
        alert('请设置有效的新起点重量！');
        return;
      }
      setSessionState(prev => {
        const nextSets = [{
          set_number: 1,
          planned_reps: parseInt(testReps, 10),
          actual_reps: parseInt(testReps, 10),
          completed: true,
          weight_kg: testWeight,
          retest_start_weight: finalStartWeight,
          is_warmup: false
        }];
        return {
          ...prev,
          setsData: { ...prev.setsData, [exIdx]: nextSets }
        };
      });
    };

    return (
      <div className="card !p-4 bg-bg-card border border-border-card dark:bg-bg-card-dark dark:border-border-card-dark rounded-2xl flex flex-col gap-3 ml-3 mr-3 shadow-sm select-none">
        <div className="flex flex-col gap-1 select-none">
          <div className="flex items-center gap-1.5 font-black text-amber-500 text-sm">
            <span className="badge badge-warning badge-outline scale-90 px-1.5 text-[9px] font-extrabold">极限重测</span>
            <span>大轮次已告终，请在今日测试极限</span>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-normal">
            该动作在此计划中已达到目前周期上限。请在今天重测（如测试 3RM 或 5RM 直至力竭），并在下方录入您的测试表现，系统将自动折算推荐新起点负荷，并开启新周期。
          </p>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark">测试负荷 ({exUnit})</label>
            <div className="input-standard flex items-center justify-between px-3 h-10">
              <input
                type="text"
                inputMode="decimal"
                value={testWeight === '' || testWeight === 0 ? '' : (exUnit === 'lbs' ? convertWeight(testWeight, 'lbs') : testWeight)}
                placeholder="测试重量"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.]/g, '');
                  const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                  const val = cleaned === '' || cleaned === '.' ? '' : parseFloat(cleaned);
                  const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                  setSessionState(prev => {
                    const nextSets = (prev.setsData[exIdx] || []).map((s, idx) => 
                      idx === 0 ? { ...s, weight_kg: kgVal } : s
                    );
                    return { ...prev, setsData: { ...prev.setsData, [exIdx]: nextSets } };
                  });
                }}
                className="w-full bg-transparent font-mono font-bold text-sm text-text-main dark:text-text-main-dark focus:outline-none"
              />
              <span className="text-xs font-semibold text-text-secondary/50 font-mono select-none">{exUnit}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark">完成次数 (次)</label>
            <div className="input-standard flex items-center justify-between px-3 h-10">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={testReps}
                placeholder="极限次数"
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '');
                  const val = cleaned === '' ? '' : parseInt(cleaned, 10);
                  setSessionState(prev => {
                    const nextSets = (prev.setsData[exIdx] || []).map((s, idx) => 
                      idx === 0 ? { ...s, actual_reps: val, planned_reps: val || 5 } : s
                    );
                    return { ...prev, setsData: { ...prev.setsData, [exIdx]: nextSets } };
                  });
                }}
                className="w-full bg-transparent font-mono font-bold text-sm text-text-main dark:text-text-main-dark focus:outline-none"
              />
              <span className="text-xs font-semibold text-text-secondary/50 font-mono select-none">次</span>
            </div>
          </div>
        </div>

        {/* 确认新起点重量输入框 */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark">确认新起点负荷 ({exUnit})</label>
          <div className="input-standard flex items-center justify-between px-3 h-10 border border-primary/30">
            <input
              type="text"
              inputMode="decimal"
              value={currentStartWeightKg > 0 ? (exUnit === 'lbs' ? convertWeight(currentStartWeightKg, 'lbs') : currentStartWeightKg) : ''}
              placeholder="新起点负荷"
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, '');
                const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                const val = cleaned === '' || cleaned === '.' ? '' : parseFloat(cleaned);
                const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                setSessionState(prev => {
                  const nextSets = (prev.setsData[exIdx] || []).map((s, idx) => 
                    idx === 0 ? { ...s, retest_start_weight: kgVal } : s
                  );
                  return { ...prev, setsData: { ...prev.setsData, [exIdx]: nextSets } };
                });
              }}
              className="w-full bg-transparent font-mono font-bold text-sm text-text-main dark:text-text-main-dark focus:outline-none"
            />
            <span className="text-xs font-semibold text-text-secondary/50 font-mono select-none">{exUnit}</span>
          </div>
        </div>

        {/* Real-time Estimates */}
        {testWeight > 0 && testReps > 0 && (
          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 select-none animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text-secondary dark:text-text-secondary-dark">估算 1RM:</span>
              <span className="font-mono font-bold text-text-main dark:text-text-main-dark">{estimated1RM.toFixed(1)} {exUnit}</span>
            </div>
            {ex.tier === 'T1' && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text-secondary dark:text-text-secondary-dark">估算 5RM:</span>
                <span className="font-mono font-bold text-text-main dark:text-text-main-dark">{estimated5RM.toFixed(1)} {exUnit}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs border-t border-border-card/50 dark:border-border-card-dark/50 pt-1.5 mt-0.5">
              <span className="font-black text-primary">新起点起始负荷 (推荐):</span>
              <span className="font-mono font-black text-primary">{recommendedStartWeight.toFixed(1)} {exUnit}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-sec flex-1 h-8 min-h-8 text-xs rounded-xl"
            onClick={() => {
              openSetCard(exIdx, 0);
              setCalcOpen(true);
            }}
          >
            <Calculator size={12} />
            <span>做组估算助手</span>
          </button>

          <button
            type="button"
            className={`btn-main flex-1 h-8 min-h-8 text-xs rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-sm ${
              set.completed ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={handleConfirmRetest}
            disabled={set.completed}
          >
            {set.completed ? (
              <div className="flex items-center gap-1 justify-center">
                <Check size={12} />
                <span>已保存测试</span>
              </div>
            ) : (
              <span>保存测试并开启新周期</span>
            )}
          </button>
        </div>
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

    const exUnit = exerciseConfig?.[ex.exercise]?.unit || unit || 'kg';
    const configForUnit = gymEquipmentConfig[exUnit] || gymEquipmentConfig.kg;
    const barWeight = configForUnit.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
    const enabledPlates = configForUnit.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
    const plateLimits = configForUnit.barbell?.plate_limits || {};

    // 优先使用当前 logged weight，若无则使用动作计划重
    const currentWeight = set.weight_kg ?? ex.weight ?? 0;
    const weightInUnit = exUnit === 'lbs' ? convertWeight(currentWeight, 'lbs') : currentWeight;
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
                {weightInUnit.toFixed(1)}{exUnit}
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
                      .map(([plate, count]) => `${plate}${exUnit} × ${count}`)
                      .join(' + ');
                  })()}
                </span>
              </div>
            ) : (
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">默认计算配片</span>
                <span className="text-[11px] font-bold text-text-secondary dark:text-text-secondary-dark">
                  仅需 {barWeight}{exUnit} 空杆
                </span>
              </div>
            )}
          </div>

          {/* Barbell Plate Visualizer */}
          <BarbellVisualizer
            plates={breakdown.plates}
            barWeight={barWeight}
            unit={exUnit}
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

    const exUnit = exerciseConfig?.[ex?.exercise]?.unit || unit || 'kg';
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
                        <label className="text-xs font-semibold text-base-content/50 select-none">基准 1RM ({exUnit})</label>
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
                        <span className="text-sm font-medium text-base-content/40 select-none">{exUnit}</span>
                      </div>
                    </div>

                    {/* 预估重量 (calculated target weight) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-base-content/50 select-none">预估重量 ({exUnit})</label>
                        <span className="badge badge-info badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-blue-500/15 text-blue-500 border border-blue-500/20">自动</span>
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-primary/5 border-primary/20 px-3 h-11 transition-colors select-none">
                        <div className="w-full font-mono font-black text-sm text-primary text-right pr-0.5">
                          {computedRpeWeight > 0 ? `${computedRpeWeight}` : `0`}
                        </div>
                        <span className="text-sm font-bold text-primary/70 select-none">{exUnit}</span>
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
                        <label className="text-xs font-semibold text-base-content/50 select-none">基准 1RM ({exUnit})</label>
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
                        <span className="text-sm font-medium text-base-content/40 select-none">{exUnit}</span>
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
                          {epleyWeight > 0 ? `${epleyWeight} ${exUnit}` : `-- ${exUnit}`}
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
                          {brzyckiWeight > 0 ? `${brzyckiWeight} ${exUnit}` : `-- ${exUnit}`}
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
    const hasActiveFilters = exFilterType || exFilterPattern || exFilterEquipment;

    const filtered = allExs.filter(ex => {
      // Search match
      const q = addExerciseSearch.trim().toLowerCase();
      const matchSearch = !q ||
        (ex.name || '').toLowerCase().includes(q) ||
        (ex.name_cn || '').toLowerCase().includes(q) ||
        getExerciseCNName(ex.name)?.toLowerCase().includes(q);
      // Category filters
      const matchType = !exFilterType || ex.exercise_type === exFilterType;
      const matchPattern = !exFilterPattern || ex.movement_pattern === exFilterPattern;
      const matchEquipment = !exFilterEquipment || (ex.equipment || []).includes(exFilterEquipment);
      return matchSearch && matchType && matchPattern && matchEquipment;
    });

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
            <button type="button" onClick={() => { setShowAddExerciseModal(false); setSelectedExToAdd(null); setExFilterType(''); setExFilterPattern(''); setExFilterEquipment(''); }} className="btn btn-ghost btn-circle btn-xs h-6 w-6"><X size={16} /></button>
          </div>

          <div className="p-4 overflow-y-auto flex flex-col gap-4 flex-1">
            <input
              type="text"
              placeholder="搜索动作名称..."
              value={addExerciseSearch}
              onChange={(e) => setAddExerciseSearch(e.target.value)}
              className="input input-bordered w-full h-11 text-sm rounded-xl"
            />

            {/* 三维分类筛选 */}
            <div className="grid grid-cols-3 gap-2">
              <select
                className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
                value={exFilterType}
                onChange={(e) => setExFilterType(e.target.value)}
              >
                <option value="">全部流派</option>
                {Object.entries(EXERCISE_TYPE_MAP).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
              <select
                className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
                value={exFilterPattern}
                onChange={(e) => setExFilterPattern(e.target.value)}
              >
                <option value="">全部模式</option>
                {exFilterOptions.patterns.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
                value={exFilterEquipment}
                onChange={(e) => setExFilterEquipment(e.target.value)}
              >
                <option value="">全部器械</option>
                {exFilterOptions.equipments.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>

            {/* 筛选状态提示 */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs">
                <Filter size={12} className="text-base-content/40" />
                <span className="text-base-content/50">
                  共 {filtered.length} 个匹配
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-primary font-bold h-6 min-h-0 px-1.5 cursor-pointer"
                  onClick={() => {
                    setExFilterType('');
                    setExFilterPattern('');
                    setExFilterEquipment('');
                  }}
                >
                  清除筛选
                </button>
              </div>
            )}

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
            <button type="button" onClick={() => { setShowAddExerciseModal(false); setSelectedExToAdd(null); setExFilterType(''); setExFilterPattern(''); setExFilterEquipment(''); }} className="btn btn-ghost btn-sm h-9 px-4 rounded-xl text-xs font-semibold">取消</button>
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

  // ============ CUSTOM TIME MODAL ============
  const renderCustomTimeModal = () => {
    if (!showCustomTimeModal) return null;
    
    const offsetStartTime = (minutesOffset) => {
      const currentStart = sessionState.startTime || Date.now();
      const newStart = currentStart - minutesOffset * 60 * 1000;
      
      const date = new Date(newStart);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setCustomStartTime(`${hours}:${minutes}`);
      
      const prevDur = parseFloat(customDurationMinutes) || 0;
      setCustomDurationMinutes(String(prevDur + minutesOffset));
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
        <div className="bg-bg-card dark:bg-bg-card-dark rounded-2xl shadow-2xl w-full max-w-sm flex flex-col border border-border-card dark:border-border-card-dark select-none animate-fadeIn">
          <div className="p-4 border-b border-border-card dark:border-border-card-dark flex items-center justify-between">
            <span className="font-extrabold text-base text-text-main dark:text-text-main-dark">手动调整训练时间</span>
            <button type="button" onClick={() => setShowCustomTimeModal(false)} className="btn btn-ghost btn-circle btn-xs h-6 w-6 text-text-secondary">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">1. 训练开始时间</label>
              <input
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                className="input input-bordered w-full h-10 font-mono text-sm rounded-xl focus:border-primary text-center bg-bg-main dark:bg-bg-main-dark border-border-card dark:border-border-card-dark"
              />
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => offsetStartTime(10)}
                  className="btn btn-xs h-7 min-h-0 bg-base-200 hover:bg-base-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] font-bold rounded-lg border-none cursor-pointer"
                >
                  提前10分钟
                </button>
                <button
                  type="button"
                  onClick={() => offsetStartTime(30)}
                  className="btn btn-xs h-7 min-h-0 bg-base-200 hover:bg-base-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] font-bold rounded-lg border-none cursor-pointer"
                >
                  提前30分钟
                </button>
                <button
                  type="button"
                  onClick={() => offsetStartTime(60)}
                  className="btn btn-xs h-7 min-h-0 bg-base-200 hover:bg-base-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] font-bold rounded-lg border-none cursor-pointer"
                >
                  提前1小时
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">2. 本次训练总时长 (分钟)</label>
              <input
                type="number"
                min="1"
                max="360"
                value={customDurationMinutes}
                onChange={(e) => setCustomDurationMinutes(e.target.value)}
                className="input input-bordered w-full h-10 font-mono text-sm rounded-xl focus:border-primary text-center bg-bg-main dark:bg-bg-main-dark border-border-card dark:border-border-card-dark"
                placeholder="如 45"
              />
              <button
                type="button"
                onClick={() => {
                  let est = 10;
                  (todayWorkout?.exercises || []).forEach(ex => {
                    const sets = ex.sets || 3;
                    const factor = ex.tier === 'T1' ? 3.0 : ex.tier === 'T2' ? 2.5 : 2.0;
                    est += sets * factor;
                  });
                  setCustomDurationMinutes(String(Math.round(est)));
                }}
                className="btn btn-link btn-xs text-primary dark:text-primary-dark font-bold justify-start p-0 h-auto min-h-0 text-[10px] cursor-pointer"
              >
                💡 使用动作组数估算推荐时间
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-border-card dark:border-border-card-dark flex justify-end gap-2.5">
            <button type="button" onClick={() => setShowCustomTimeModal(false)} className="btn btn-ghost btn-sm h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer">
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveCustomTime}
              className="btn btn-primary btn-sm h-9 px-5 rounded-xl text-xs font-bold text-primary-content cursor-pointer"
            >
              确认修改
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
    
    const isAmrap = !!set.is_amrap;



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
                isAmrap ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20' : 'border-base-300'
              }`}
            >
              <Zap size={12} className="inline" /> {isAmrap ? '回退为普通组' : '改为 AMRAP 组'}
            </button>



            <button
              type="button"
              onClick={handleSyncToSubsequent}
              className="btn btn-outline border-base-300 w-full h-11 rounded-xl text-sm font-bold text-base-content/85 hover:bg-base-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={12} className="inline" /> 同步重量和次数到后续组
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

    const handleSkipExercise = () => {
      setConfirmState({
        title: '跳过整组动作',
        message: `确定要跳过整组动作”${getExerciseCNName(ex.exercise)}”吗？`,
        variant: 'warning',
        confirmLabel: '跳过',
        onConfirm: () => {
          setConfirmState(null);
          setSessionState(prev => {
            const sets = prev.setsData[exIdx] || [];
            const nextSets = sets.map(s => ({ ...s, skipped: true, completed: false }));
            return { ...prev, setsData: { ...prev.setsData, [exIdx]: nextSets } };
          });
          setShowExerciseSettingsModal(false);
          setSettingsExIdx(null);
        }
      });
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4" onClick={() => { setShowExerciseSettingsModal(false); setSettingsExIdx(null); }}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
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
                <SkipForward size={12} className="inline" /> 跳过整组动作
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-base-content/50 uppercase pl-1">更换此动作</span>
              <button
                type="button"
                onClick={() => {
                  setShowExerciseSettingsModal(false);
                  setReplaceExerciseSearch('');
                  setExFilterType('');
                  setExFilterPattern('');
                  setExFilterEquipment('');
                  setShowReplaceSheet(true);
                }}
                className="btn btn-outline border-primary bg-primary/5 hover:bg-primary hover:text-primary-content text-primary w-full h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <Search size={14} />
                从动作库选择替换动作
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ REPLACE EXERCISE BOTTOM SHEET ============
  const renderReplaceExerciseSheet = () => {
    if (!showReplaceSheet || settingsExIdx === null) return null;

    const allExs = Object.values(exercisesMap || {});
    const currentExName = todayWorkout?.exercises?.[settingsExIdx]?.exercise;
    const hasActiveFilters = exFilterType || exFilterPattern || exFilterEquipment;

    const filtered = allExs.filter(ex => {
      // Exclude current exercise
      if (ex.name === currentExName) return false;
      // Search match
      const q = replaceExerciseSearch.trim().toLowerCase();
      const matchSearch = !q ||
        (ex.name || '').toLowerCase().includes(q) ||
        (ex.name_cn || '').toLowerCase().includes(q) ||
        getExerciseCNName(ex.name)?.toLowerCase().includes(q);
      // Category filters
      const matchType = !exFilterType || ex.exercise_type === exFilterType;
      const matchPattern = !exFilterPattern || ex.movement_pattern === exFilterPattern;
      const matchEquipment = !exFilterEquipment || (ex.equipment || []).includes(exFilterEquipment);
      return matchSearch && matchType && matchPattern && matchEquipment;
    });

    return (
      <div className="fixed inset-0 z-[75] flex items-end justify-center">
        {/* Backdrop overlay */}
        <div
          className="bottom-sheet-backdrop animate-sheet-fade-in"
          onClick={() => {
            setShowReplaceSheet(false);
            setSettingsExIdx(null);
            setReplaceExerciseSearch('');
            setExFilterType('');
            setExFilterPattern('');
            setExFilterEquipment('');
          }}
        />

        {/* Bottom sheet content */}
        <div className="bottom-sheet-container animate-sheet-slide-up w-full flex flex-col gap-3.5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-base-300">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-base-content">替换动作</span>
              <span className="text-[10px] text-base-content/50">
                当前: {getExerciseCNName(currentExName) || currentExName}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-300 rounded-full flex items-center justify-center cursor-pointer"
              onClick={() => {
                setShowReplaceSheet(false);
                setSettingsExIdx(null);
                setReplaceExerciseSearch('');
                setExFilterType('');
                setExFilterPattern('');
                setExFilterEquipment('');
              }}
              aria-label="关闭替换面板"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="input input-bordered flex items-center gap-2 bg-base-200/50 border-base-300 focus-within:border-primary px-3 h-10 transition-colors rounded-xl">
            <Search size={16} className="text-base-content/40 shrink-0" />
            <input
              type="text"
              placeholder="搜索动作名称..."
              value={replaceExerciseSearch}
              onChange={(e) => setReplaceExerciseSearch(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-base-content focus:outline-none"
            />
            {replaceExerciseSearch && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle p-0 cursor-pointer"
                onClick={() => setReplaceExerciseSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 三维分类筛选 */}
          <div className="grid grid-cols-3 gap-2">
            <select
              className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
              value={exFilterType}
              onChange={(e) => setExFilterType(e.target.value)}
            >
              <option value="">全部流派</option>
              {Object.entries(EXERCISE_TYPE_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
            <select
              className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
              value={exFilterPattern}
              onChange={(e) => setExFilterPattern(e.target.value)}
            >
              <option value="">全部模式</option>
              {exFilterOptions.patterns.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="select-standard !h-9 !text-[11px] !rounded-lg w-full px-1.5"
              value={exFilterEquipment}
              onChange={(e) => setExFilterEquipment(e.target.value)}
            >
              <option value="">全部器械</option>
              {exFilterOptions.equipments.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>

          {/* 筛选状态提示 */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs">
              <Filter size={12} className="text-base-content/40" />
              <span className="text-base-content/50">
                共 {filtered.length} 个匹配
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary font-bold h-6 min-h-0 px-1.5 cursor-pointer"
                onClick={() => {
                  setExFilterType('');
                  setExFilterPattern('');
                  setExFilterEquipment('');
                }}
              >
                清除筛选
              </button>
            </div>
          )}

          {/* Exercise list */}
          <div className="flex flex-col gap-1 border border-base-300 rounded-xl p-1 bg-base-200/20 max-h-[320px] overflow-y-auto">
            {filtered.slice(0, 50).map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleReplaceExercise(ex.name)}
                className="flex items-center justify-between p-2.5 hover:bg-base-200 rounded-lg text-left text-sm text-base-content cursor-pointer transition-all border-0 bg-transparent w-full"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm">{getExerciseCNName(ex.name)}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ex.exercise_type && (
                      <span className="text-[10px] text-base-content/40 font-mono">
                        {EXERCISE_TYPE_MAP[ex.exercise_type] || ex.exercise_type}
                      </span>
                    )}
                    {ex.movement_pattern && (
                      <span className="text-[10px] text-base-content/30 font-mono">
                        {ex.movement_pattern}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-primary font-black shrink-0 ml-2">替换</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-base-content/40">无匹配动作</div>
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
      {/* 最小化倒计时悬浮条 */}
      {restTimer.active && restTimer.isMinimized && (
        <div 
          onClick={() => setRestTimer(prev => ({ ...prev, isMinimized: false }))}
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-12 bg-warning/15 dark:bg-warning/25 border-b border-warning/30 backdrop-blur z-[60] flex items-center justify-between px-4 cursor-pointer animate-fadeIn shadow-md"
        >
          <span className="text-xs font-black text-warning flex items-center gap-1.5 animate-pulse">
            <Timer size={12} className="inline" /> 休息中: 还有 {restTimer.remaining} 秒 (点击恢复)
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
            <button
              type="button"
              onClick={handleOpenCustomTimeModal}
              className="btn btn-circle btn-xs h-7 w-7 min-h-0 border-0 flex items-center justify-center bg-base-200 text-base-content/70 hover:bg-base-300 transition-all ml-1 cursor-pointer"
              title="手动微调训练开始时间与时长"
            >
              <Timer size={12} />
            </button>
          </div>

          {/* 右上角：“完成”打卡按钮 */}
          <button
            type="button"
            className="btn btn-primary btn-sm h-8 px-4 rounded-xl text-xs font-bold text-primary-content shadow-md active:scale-95 transition-all cursor-pointer"
            onClick={() => onSave(setDetails)}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '完成'}
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
            <button
              type="button"
              className="btn btn-success btn-lg btn-block text-success-content font-semibold gap-2 shadow-lg"
              onClick={() => onSave(setDetails)}
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : <><Sparkles size={18} />完成今日训练打卡</>}
            </button>
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
          <Minimize2 size={20} />
          <span className="text-[10px] font-bold">最小化</span>
        </button>
        <button
          type="button"
          onClick={() => setShowAddExerciseModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={20} />
          <span className="text-[10px] font-bold">加动作</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSessionNotesModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <PenLine size={20} />
          <span className="text-[10px] font-bold">写心得</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSessionSettingsModal(true)}
          className="flex flex-col items-center justify-center gap-1 text-base-content/70 hover:text-base-content active:scale-95 transition-all cursor-pointer"
        >
          <Settings size={20} />
          <span className="text-[10px] font-bold">设置</span>
        </button>
      </div>

      {renderSetCard()}
      {renderRestCard()}
      {renderPlateHelperSheet()}
      {renderWeightCalculatorSheet()}
      {renderAddExerciseModal()}
      {renderSessionNotesModal()}
      {renderCustomTimeModal()}
      {renderSessionSettingsModal()}
      {renderSetSettingsModal()}
      {renderExerciseSettingsModal()}
      {renderReplaceExerciseSheet()}
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        onConfirm={confirmState?.onConfirm || (() => {})}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

export default TrainSession;
