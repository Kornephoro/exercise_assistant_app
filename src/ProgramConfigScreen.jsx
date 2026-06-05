import { useState, useEffect, useMemo, useRef } from 'react';
import {
  fetchActiveUserProgram,
  fetchLastEndedUserProgram,
  fetchExercises,
  fetchOneRmRecords,
  saveUserProgram
} from './services/programService';
import { Loader2, ArrowLeft, Save, ShieldAlert, CheckCircle, Scale, Zap, Dumbbell, Search, Calendar, Sparkles, Calculator, X } from 'lucide-react';
import { convertWeight, toStorageWeight, roundToClosestLoadable } from './unitUtils';
import { deriveStartFromOneRm } from './oneRmUtils';
import { getCNName } from './exerciseNames';

// ==================== 1RM 同步钩子 ====================
// 拉取每个主项最新 1RM，供「一键应用」使用
function useLatestOneRms() {
  const [latest, setLatest] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchOneRmRecords();
        if (cancelled) return;
        const map = {};
        (data || []).forEach(r => {
          if (!map[r.exercise] || r.date > map[r.exercise].date) {
            map[r.exercise] = r;
          }
        });
        setLatest(map);
      } catch (e) {
        console.warn('加载 1RM 记录失败:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return latest;
}

// ==================== 默认 chain ====================

const DEFAULT_T1_CHAIN = [
  { sets: 5, reps: 3, amrap: true },
  { sets: 6, reps: 2, amrap: true },
  { sets: 10, reps: 1, amrap: true },
];

const DEFAULT_T2_CHAIN = [
  { sets: 3, reps: 10, amrap: false },
  { sets: 3, reps: 8, amrap: false },
  { sets: 3, reps: 6, amrap: false },
];

const LIFT_CN_NAMES = {
  squat: '深蹲',
  bench: '卧推',
  deadlift: '硬拉',
  press: '推举',
};

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

// ==================== InfiniteScrollPicker ====================
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
    // We aim for the middle copy (index 4 out of 0-8)
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

  // Align to the initial value on mount and when layout becomes ready
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
  }, []);

  // Listen to external value changes
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

      // Silent teleportation check
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
          // Clear flag on next frame
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
      <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark font-bold pl-1">
        {label}
      </span>
      
      {/* Scroll picker outer container with center selection indicator styling */}
      <div className="relative w-full flex items-center bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded-xl h-12 overflow-hidden">
        {/* Selection highlight overlay in the center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-primary/30 pointer-events-none z-10" />
        
        {/* Left/Right fading mask overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-card/40 to-transparent dark:from-bg-card-dark/40 pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-card/40 to-transparent dark:from-bg-card-dark/40 pointer-events-none z-10" />
        
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
                    ? 'bg-primary text-white scale-110 shadow-md ring-2 ring-primary/20'
                    : 'text-text-secondary hover:text-text-main dark:text-text-secondary-dark dark:hover:text-text-main-dark hover:bg-bg-hover dark:hover:bg-bg-hover-dark bg-transparent'
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

// ==================== ProgressionChainEditor ====================
// 移植自插件 GzclpConfigPanel.tsx:193-277
function ProgressionChainEditor({ chain, onChange, tierLabel }) {
  const [open, setOpen] = useState(false);
  const tierColor = tierLabel === 'T1' ? 'text-tier-t1' : 'text-tier-t2';

  const update = (i, patch) => {
    const next = chain.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange(next);
  };
  const remove = (i) => {
    if (chain.length <= 1) return;
    onChange(chain.filter((_, idx) => idx !== i));
  };
  const add = () => {
    const last = chain[chain.length - 1];
    onChange([
      ...chain,
      { sets: last?.sets ?? 3, reps: Math.max(1, (last?.reps ?? 10) - 2), amrap: last?.amrap ?? false }
    ]);
  };
  const reset = () => {
    const defaults = tierLabel === 'T1' ? DEFAULT_T1_CHAIN : DEFAULT_T2_CHAIN;
    onChange(defaults.map(s => ({ ...s })));
  };

  const label = chain.map(s => `${s.sets}×${s.reps}${s.amrap ? '+' : ''}`).join(' → ');

  return (
    <div className="text-xs border border-border-card/50 dark:border-border-card-dark/50 rounded-md p-2 bg-bg-main/30 dark:bg-bg-main-dark/30 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 min-w-0 text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark transition-colors flex-1 text-left"
        >
          <span className={`${tierColor} font-bold shrink-0`}>{tierLabel} 进阶链</span>
          <span className="text-[10px] font-mono text-text-secondary/80 truncate">({label})</span>
          <span className="text-[10px] ml-auto shrink-0">{open ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-[10px] text-text-secondary dark:text-text-secondary-dark hover:text-primary transition-colors shrink-0 px-1"
          title="恢复为默认 chain"
        >
          ↺ 默认
        </button>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-border-card/40 dark:border-border-card-dark/40 space-y-1.5">
          {chain.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-bg-main/40 dark:bg-bg-main-dark/40 p-1.5 rounded-md border border-border-card/30 dark:border-border-card-dark/30">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={s.sets || ''}
                  min={1}
                  max={20}
                  onChange={(e) => {
                    const val = e.target.value;
                    update(i, { sets: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) });
                  }}
                  onBlur={() => { if (!s.sets || s.sets < 1) update(i, { sets: 1 }); }}
                  className="h-7 w-10 rounded border border-input bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0"
                />
                <span className="text-[10px] text-text-secondary shrink-0">组</span>
              </div>
              <span className="text-[10px] text-text-secondary/50 shrink-0">×</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={s.reps || ''}
                  min={1}
                  max={30}
                  onChange={(e) => {
                    const val = e.target.value;
                    update(i, { reps: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) });
                  }}
                  onBlur={() => { if (!s.reps || s.reps < 1) update(i, { reps: 1 }); }}
                  className="h-7 w-10 rounded border border-input bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0"
                />
                <span className="text-[10px] text-text-secondary shrink-0">次</span>
              </div>
              <button
                type="button"
                onClick={() => update(i, { amrap: !s.amrap })}
                className={`h-7 px-2 rounded border text-[10px] font-semibold transition-colors shrink-0 ${
                  s.amrap ? 'bg-primary/15 text-primary border-primary/30' : 'border-input bg-bg-card dark:bg-bg-card-dark text-text-secondary hover:bg-bg-hover'
                }`}
                title="最后一组做 AMRAP (尽可能多做次数)"
              >
                AMRAP
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="h-7 w-7 rounded text-text-secondary hover:text-alert hover:bg-alert/10 transition-colors flex items-center justify-center text-sm ml-auto shrink-0"
                title="删除此阶段"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full text-center text-[10px] text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark border border-dashed border-border-card dark:border-border-card-dark rounded py-1 transition-colors bg-bg-card/30 dark:bg-bg-card-dark/30 hover:bg-bg-card/60"
          >
            + 添加阶段
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== GZCLP 完整配置 ====================

function GzclpConfig({ program, onBack, onActivated, isExisting, gymEquipmentConfig = null }) {
  const defaultWeights = program.config?.default_weights || {};
  const defaultIncrement = program.config?.default_increment || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 初始重量
  const [squatWeight, setSquatWeight] = useState('');
  const [benchWeight, setBenchWeight] = useState('');
  const [deadliftWeight, setDeadliftWeight] = useState('');
  const [pressWeight, setPressWeight] = useState('');

  // T1 & T2 步长
  const [squatT1Step, setSquatT1Step] = useState('2.5');
  const [squatT2Step, setSquatT2Step] = useState('2.5');
  const [benchT1Step, setBenchT1Step] = useState('2.5');
  const [benchT2Step, setBenchT2Step] = useState('2.5');
  const [deadliftT1Step, setDeadliftT1Step] = useState('2.5');
  const [deadliftT2Step, setDeadliftT2Step] = useState('2.5');
  const [pressT1Step, setPressT1Step] = useState('2.5');
  const [pressT2Step, setPressT2Step] = useState('2.5');

  // 任务 1：各主项进阶参数 (1RM + chain)
  const [squatOneRm, setSquatOneRm] = useState('80');
  const [benchOneRm, setBenchOneRm] = useState('60');
  const [deadliftOneRm, setDeadliftOneRm] = useState('100');
  const [pressOneRm, setPressOneRm] = useState('40');
  const [squatT1Chain, setSquatT1Chain] = useState(DEFAULT_T1_CHAIN.map(s => ({ ...s })));
  const [squatT2Chain, setSquatT2Chain] = useState(DEFAULT_T2_CHAIN.map(s => ({ ...s })));
  const [benchT1Chain, setBenchT1Chain] = useState(DEFAULT_T1_CHAIN.map(s => ({ ...s })));
  const [benchT2Chain, setBenchT2Chain] = useState(DEFAULT_T2_CHAIN.map(s => ({ ...s })));
  const [deadliftT1Chain, setDeadliftT1Chain] = useState(DEFAULT_T1_CHAIN.map(s => ({ ...s })));
  const [deadliftT2Chain, setDeadliftT2Chain] = useState(DEFAULT_T2_CHAIN.map(s => ({ ...s })));
  const [pressT1Chain, setPressT1Chain] = useState(DEFAULT_T1_CHAIN.map(s => ({ ...s })));
  const [pressT2Chain, setPressT2Chain] = useState(DEFAULT_T2_CHAIN.map(s => ({ ...s })));

  // 1RM 拉取钩子
  const latestOneRms = useLatestOneRms();

  // e1RM 计算器相关状态
  const [calcLift, setCalcLift] = useState(null); // 'squat' | 'bench' | 'deadlift' | 'press' | null
  const [calcTab, setCalcTab] = useState('formula'); // 'formula' | 'rpe'
  const [calcWeight, setCalcWeight] = useState('');
  const [calcReps, setCalcReps] = useState(5); // 1 to 12 in RPE, or string in formula
  const [calcRpe, setCalcRpe] = useState(8); // 6 to 10

  // 同步云端 1RM → state (仅在 fetch 完成后, 如果本地初始 80/60/100/40 还没被用户改过)
  // 策略: 加载时如果云端有, 用云端的 (因为这是真实测试)
  useEffect(() => {
    if (Object.keys(latestOneRms).length === 0) return;
    Promise.resolve().then(() => {
      setSquatOneRm(prev => {
        const cloud = latestOneRms.squat?.e1rm_kg;
        if (cloud && (Number(prev) === 80 || !prev)) return String(cloud);
        return prev;
      });
      setBenchOneRm(prev => {
        const cloud = latestOneRms.bench?.e1rm_kg;
        if (cloud && (Number(prev) === 60 || !prev)) return String(cloud);
        return prev;
      });
      setDeadliftOneRm(prev => {
        const cloud = latestOneRms.deadlift?.e1rm_kg;
        if (cloud && (Number(prev) === 100 || !prev)) return String(cloud);
        return prev;
      });
      setPressOneRm(prev => {
        const cloud = latestOneRms.press?.e1rm_kg;
        if (cloud && (Number(prev) === 40 || !prev)) return String(cloud);
        return prev;
      });
    });
  }, [latestOneRms]);

  // user_programs 记录 ID
  const [userProgramId, setUserProgramId] = useState(null);

  // 日程模式
  const [scheduleType, setScheduleType] = useState('weekly');
  const [trainDays, setTrainDays] = useState(1);
  const [restDays, setRestDays] = useState(1);

  // 训练日程（weekly 模式）
  const [trainingDays, setTrainingDays] = useState(() => {
    const saved = localStorage.getItem('training_days');
    if (saved) { try { return JSON.parse(saved); } catch (e) { console.warn('解析本地训练日程缓存失败:', e); } }
    return ['Monday', 'Wednesday', 'Friday', 'Saturday'];
  });

  const weekdays = [
    { key: 'Monday', label: '一' }, { key: 'Tuesday', label: '二' },
    { key: 'Wednesday', label: '三' }, { key: 'Thursday', label: '四' },
    { key: 'Friday', label: '五' }, { key: 'Saturday', label: '六' },
    { key: 'Sunday', label: '日' },
  ];

  // T3 动作库相关
  const [exercises, setExercises] = useState([]);
  const [dayTemplate, setDayTemplate] = useState([
    { label: 'Day1', t3: [] },
    { label: 'Day2', t3: [] },
    { label: 'Day3', t3: [] },
    { label: 'Day4', t3: [] },
  ]);
  const [t3Exercises, setT3Exercises] = useState([]); // { name, targetReps, incrementKg, startWeightKg }
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState(null); // { dayLabel, idx }
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorMuscleFilter, setSelectorMuscleFilter] = useState('');

  // 单位系统
  const [weightUnit, setWeightUnit] = useState('kg');
  const [exerciseUnits, setExerciseUnits] = useState({});

  // 开始日期
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const muscleCategories = [
    { label: '全部', value: '' },
    { label: '胸部', value: '胸' },
    { label: '背部', value: '背' },
    { label: '肩部', value: '肩' },
    { label: '下肢', value: '腿' },
    { label: '手臂', value: '臂' },
    { label: '核心', value: '腹' },
  ];

  // T3 动作名称映射（DB key -> 完整动作对象）
  const exerciseNameMap = useMemo(() => {
    const map = {};
    exercises.forEach(ex => { map[ex.name] = ex; });
    return map;
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const searchLower = selectorSearch.toLowerCase();
      const matchSearch = !selectorSearch ||
        (ex.name || '').toLowerCase().includes(searchLower) ||
        (ex.name_cn || '').toLowerCase().includes(searchLower) ||
        (ex.equipment || []).join(' ').toLowerCase().includes(searchLower);

      if (!matchSearch) return false;
      if (!selectorMuscleFilter) return true;

      const pm = (ex.primary_muscles || []).join(',').toLowerCase();
      const sms = (ex.secondary_muscles || []).join(',').toLowerCase();
      const allMuscles = pm + ',' + sms;

      if (selectorMuscleFilter === '胸') return allMuscles.includes('胸');
      if (selectorMuscleFilter === '背') return allMuscles.includes('背') || allMuscles.includes('斜方') || allMuscles.includes('菱形');
      if (selectorMuscleFilter === '肩') return allMuscles.includes('肩') || allMuscles.includes('三角肌');
      if (selectorMuscleFilter === '腿') return allMuscles.includes('股') || allMuscles.includes('腘绳') || allMuscles.includes('小腿') || allMuscles.includes('腿弯举') || allMuscles.includes('臀') || allMuscles.includes('腿');
      if (selectorMuscleFilter === '臂') return allMuscles.includes('二头') || allMuscles.includes('三头') || allMuscles.includes('臂');
      if (selectorMuscleFilter === '腹') return allMuscles.includes('腹');

      return allMuscles.includes(selectorMuscleFilter.toLowerCase());
    });
  }, [exercises, selectorSearch, selectorMuscleFilter]);

  const fetchConfig = async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      // 并行加载：user_programs 当前活跃配置 + 动作库
      const [existingActive, exRes] = await Promise.all([
        fetchActiveUserProgram(program.id),
        fetchExercises()
      ]);

      let existingUP = existingActive;
      let isExistingActive = !!existingUP;

      // 如果当前没有活跃的计划，尝试拉取最后一次结束的计划配置用于“数据回填”
      if (!existingUP) {
        const pastUP = await fetchLastEndedUserProgram(program.id);
        if (pastUP) {
          existingUP = pastUP;
        }
      }

      const ec = existingUP?.exercise_config || {};
      const schedule = existingUP?.schedule || {};

      if (isExistingActive && existingUP?.id) {
        setUserProgramId(existingUP.id);
      } else {
        setUserProgramId(null); // 这是一轮全新的训练周期
      }

      // 加载动作库
      setExercises(exRes || []);

      // 从 exercise_config 加载 T3 动作配置
      const t3Names = Object.keys(ec).filter(key =>
        !['squat', 'bench', 'deadlift', 'press'].includes(key) && ec[key]?.increment_t3
      );
      const loadedT3Exercises = t3Names.map(name => ({
        name,
        targetReps: ec[name]?.target_reps ?? 25,
        incrementKg: ec[name]?.increment_t3 ?? 2.5,
        startWeightKg: ec[name]?.initial_weight ?? 10
      }));
      setT3Exercises(loadedT3Exercises);

      // 优先使用用户已保存的 day_map，兜底用程序默认 day_map
      const userDayMap = existingUP?.day_map;
      const baseDayMap = userDayMap || program.config?.day_map || {};
      const template = Object.keys(baseDayMap).map(label => ({
        label,
        t3: baseDayMap[label]?.T3 || []
      }));
      if (template.length > 0) {
        setDayTemplate(template);
      }

      // 从 exercise_config 或默认值加载主项配置
      const getWeight = (ex) => ec[ex]?.initial_weight ?? defaultWeights[ex] ?? 40;
      const getT1Incr = (ex) => ec[ex]?.increment_t1 ?? defaultIncrement.T1 ?? 2.5;
      const getT2Incr = (ex) => ec[ex]?.increment_t2 ?? defaultIncrement.T2 ?? 2.5;
      const getOneRm = (ex) => ec[ex]?.one_rm ?? null;
      const getT1Chain = (ex) => ec[ex]?.t1_chain;
      const getT2Chain = (ex) => ec[ex]?.t2_chain;

      // 加载单位设置
      const savedUnit = ec._unit || 'kg';
      setWeightUnit(savedUnit);
      const savedExerciseUnits = {};
      ['squat', 'bench', 'deadlift', 'press', ...t3Names].forEach(ex => {
        if (ec[ex]?.unit) savedExerciseUnits[ex] = ec[ex].unit;
      });
      setExerciseUnits(savedExerciseUnits);

      // 转换显示重量（数据库存 kg，根据单位显示）
      const displayWeight = (ex) => {
        const kg = getWeight(ex);
        const unit = savedExerciseUnits[ex] || savedUnit;
        return unit === 'lbs' ? convertWeight(kg, 'lbs') : kg;
      };
      const displayIncr = (ex, tier) => {
        const kg = tier === 'T1' ? getT1Incr(ex) : getT2Incr(ex);
        const unit = savedExerciseUnits[ex] || savedUnit;
        return unit === 'lbs' ? convertWeight(kg, 'lbs') : kg;
      };

      setSquatWeight(displayWeight('squat').toString());
      setBenchWeight(displayWeight('bench').toString());
      setDeadliftWeight(displayWeight('deadlift').toString());
      setPressWeight(displayWeight('press').toString());

      setSquatT1Step(displayIncr('squat', 'T1').toString());
      setSquatT2Step(displayIncr('squat', 'T2').toString());
      setBenchT1Step(displayIncr('bench', 'T1').toString());
      setBenchT2Step(displayIncr('bench', 'T2').toString());
      setDeadliftT1Step(displayIncr('deadlift', 'T1').toString());
      setDeadliftT2Step(displayIncr('deadlift', 'T2').toString());
      setPressT1Step(displayIncr('press', 'T1').toString());
      setPressT2Step(displayIncr('press', 'T2').toString());

      // 加载 1RM
      const squatRM = getOneRm('squat');
      const benchRM = getOneRm('bench');
      const deadliftRM = getOneRm('deadlift');
      const pressRM = getOneRm('press');
      if (squatRM) setSquatOneRm(squatRM.toString());
      if (benchRM) setBenchOneRm(benchRM.toString());
      if (deadliftRM) setDeadliftOneRm(deadliftRM.toString());
      if (pressRM) setPressOneRm(pressRM.toString());

      // 加载 chain
      const loadChain = (val) => Array.isArray(val) && val.length > 0 ? val.map(s => ({ ...s })) : null;
      const sqT1c = loadChain(getT1Chain('squat')); if (sqT1c) setSquatT1Chain(sqT1c);
      const sqT2c = loadChain(getT2Chain('squat')); if (sqT2c) setSquatT2Chain(sqT2c);
      const beT1c = loadChain(getT1Chain('bench')); if (beT1c) setBenchT1Chain(beT1c);
      const beT2c = loadChain(getT2Chain('bench')); if (beT2c) setBenchT2Chain(beT2c);
      const deT1c = loadChain(getT1Chain('deadlift')); if (deT1c) setDeadliftT1Chain(deT1c);
      const deT2c = loadChain(getT2Chain('deadlift')); if (deT2c) setDeadliftT2Chain(deT2c);
      const prT1c = loadChain(getT1Chain('press')); if (prT1c) setPressT1Chain(prT1c);
      const prT2c = loadChain(getT2Chain('press')); if (prT2c) setPressT2Chain(prT2c);

      // 加载训练日程
      if (schedule?.scheduleType) {
        setScheduleType(schedule.scheduleType);
      }
      if (schedule?.trainDays) {
        setTrainDays(schedule.trainDays);
      }
      if (schedule?.restDays) {
        setRestDays(schedule.restDays);
      }
      if (schedule?.training_days && Array.isArray(schedule.training_days)) {
        setTrainingDays(schedule.training_days);
      }
    } catch (err) {
      setError('加载配置失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // T3 同步逻辑：监听 dayTemplate 变化，自动同步 t3Exercises
  // 保留已配置的动作数据（即使从 dayTemplate 中移除），重新添加时恢复上次配置
  useEffect(() => {
    if (exercises.length === 0) return;
    
    const usedT3Names = new Set();
    dayTemplate.forEach(day => {
      day.t3.forEach(name => {
        if (name && name.trim()) usedT3Names.add(name.trim());
      });
    });

    Promise.resolve().then(() => {
      setT3Exercises(prev => {
        const currentMap = {};
        prev.forEach(ex => { currentMap[ex.name] = ex; });
        
        const result = [];
        usedT3Names.forEach(name => {
          if (currentMap[name]) {
            result.push(currentMap[name]);
          } else {
            result.push({ name, targetReps: 25, incrementKg: 2.5, startWeightKg: 10 });
          }
        });
        
        return result;
      });
    });
  }, [dayTemplate, exercises]);

  const handleSave = async () => {
    const squatW = parseFloat(squatWeight);
    const benchW = parseFloat(benchWeight);
    const deadliftW = parseFloat(deadliftWeight);
    const pressW = parseFloat(pressWeight);

    if (isNaN(squatW) || squatW <= 0 || isNaN(benchW) || benchW <= 0 ||
        isNaN(deadliftW) || deadliftW <= 0 || isNaN(pressW) || pressW <= 0) {
      setError('初始重量必须为大于 0 的有效数字');
      setSuccessMsg(null);
      return;
    }

    const sqT1 = parseFloat(squatT1Step), sqT2 = parseFloat(squatT2Step);
    const beT1 = parseFloat(benchT1Step), beT2 = parseFloat(benchT2Step);
    const deT1 = parseFloat(deadliftT1Step), deT2 = parseFloat(deadliftT2Step);
    const prT1 = parseFloat(pressT1Step), prT2 = parseFloat(pressT2Step);

    if ([sqT1, sqT2, beT1, beT2, deT1, deT2, prT1, prT2].some(v => isNaN(v) || v < 0.5)) {
      setError('进阶加重步长不能低于最小阀值 0.5kg');
      setSuccessMsg(null);
      return;
    }

    // 1RM 校验
    const [sqRM, beRM, deRM, prRM] = [squatOneRm, benchOneRm, deadliftOneRm, pressOneRm].map(v => parseFloat(v));
    if ([sqRM, beRM, deRM, prRM].some(v => isNaN(v) || v <= 0)) {
      setError('1RM 必须为大于 0 的有效数字');
      setSuccessMsg(null);
      return;
    }

    // 验证 T3 动作配置
    for (const ex of t3Exercises) {
      if (isNaN(ex.incrementKg) || ex.incrementKg < 0.5) {
        setError(`${ex.name} 的加重步长不能低于 0.5kg`);
        setSuccessMsg(null);
        return;
      }
      if (isNaN(ex.targetReps) || ex.targetReps < 5) {
        setError(`${ex.name} 的达标门槛不能低于 5 次`);
        setSuccessMsg(null);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // 转换显示重量回 kg（数据库存储）
      const toKg = (displayVal, ex) => {
        const unit = exerciseUnits[ex] || weightUnit;
        return unit === 'lbs' ? toStorageWeight(displayVal, 'lbs') : displayVal;
      };

      // 构建 exercise_config JSON（主项 + T3 动作 + 单位）
      const toKgVal = (v, ex) => {
        const unit = exerciseUnits[ex] || weightUnit;
        return unit === 'lbs' ? toStorageWeight(v, 'lbs') : v;
      };
      const exerciseConfig = {
        _unit: weightUnit, // 全局默认单位
        squat: {
          initial_weight: toKg(squatW, 'squat'),
          one_rm: toKgVal(sqRM, 'squat'),
          increment_t1: toKg(sqT1, 'squat'),
          increment_t2: toKg(sqT2, 'squat'),
          t1_chain: squatT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: squatT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.squat || weightUnit,
        },
        bench: {
          initial_weight: toKg(benchW, 'bench'),
          one_rm: toKgVal(beRM, 'bench'),
          increment_t1: toKg(beT1, 'bench'),
          increment_t2: toKg(beT2, 'bench'),
          t1_chain: benchT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: benchT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.bench || weightUnit,
        },
        deadlift: {
          initial_weight: toKg(deadliftW, 'deadlift'),
          one_rm: toKgVal(deRM, 'deadlift'),
          increment_t1: toKg(deT1, 'deadlift'),
          increment_t2: toKg(deT2, 'deadlift'),
          t1_chain: deadliftT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: deadliftT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.deadlift || weightUnit,
        },
        press: {
          initial_weight: toKg(pressW, 'press'),
          one_rm: toKgVal(prRM, 'press'),
          increment_t1: toKg(prT1, 'press'),
          increment_t2: toKg(prT2, 'press'),
          t1_chain: pressT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: pressT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.press || weightUnit,
        },
        ...Object.fromEntries(t3Exercises.map(ex => {
          const unit = exerciseUnits[ex.name] || weightUnit;
          return [
            ex.name,
            {
              initial_weight: unit === 'lbs' ? toStorageWeight(ex.startWeightKg ?? 10, 'lbs') : (ex.startWeightKg ?? 10),
              increment_t3: unit === 'lbs' ? toStorageWeight(ex.incrementKg, 'lbs') : ex.incrementKg,
              target_reps: ex.targetReps,
              unit
            }
          ];
        }))
      };

      // 构建更新后的 day_map（包含用户选择的 T3 动作）
      const updatedDayMap = {};
      for (const day of dayTemplate) {
        updatedDayMap[day.label] = {
          ...program.config?.day_map?.[day.label],
          T3: (day.t3 || []).filter(name => name && name.trim())
        };
      }

      const dayKeys = Object.keys(updatedDayMap);

      // 构建 schedule 对象
      const schedule = scheduleType === 'weekly'
        ? { scheduleType: 'weekly', training_days: trainingDays }
        : { scheduleType: 'custom-ratio', trainDays, restDays };

      const upData = {
        is_active: true,
        ended_at: null, // 激活计划时确保结束时间清空
        program_state: {
          current_day: dayKeys[0] || 'Day1',
          scheme_index: {},
          start_date: startDate,
          last_training_date: startDate
        },
        exercise_config: exerciseConfig,
        schedule,
        day_map: updatedDayMap,
        updated_at: new Date().toISOString()
      };

      await saveUserProgram(userProgramId, program.id, upData);

      localStorage.setItem('training_days', JSON.stringify(trainingDays));
      setSuccessMsg('配置保存成功！今日建议重量已同步刷新。');
      if (onActivated) onActivated();
      setTimeout(() => onBack(), 800);
    } catch (err) {
      setError('保存配置失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============== 一键应用: 1RM → initial_weight ==============
  const applyOneRmToInitial = (lift) => {
    const oneRmMap = {
      squat: parseFloat(squatOneRm),
      bench: parseFloat(benchOneRm),
      deadlift: parseFloat(deadliftOneRm),
      press: parseFloat(pressOneRm),
    };
    const setterMap = {
      squat: setSquatWeight,
      bench: setBenchWeight,
      deadlift: setDeadliftWeight,
      press: setPressWeight,
    };
    const rm = oneRmMap[lift];
    if (!rm || rm <= 0) {
      setError(`请先填写 ${LIFT_CN_NAMES[lift]} 的有效 1RM`);
      return;
    }
    const t1 = deriveStartFromOneRm(rm, 0.85);
    const t2 = deriveStartFromOneRm(rm, 0.65);
    
    // 应用杠铃对称配片圆整
    let roundedT1 = t1;
    let roundedT2 = t2;
    const exUnit = exerciseUnits[lift] || weightUnit;
    if (gymEquipmentConfig) {
      const barWeight = gymEquipmentConfig[exUnit]?.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
      const enabledPlates = gymEquipmentConfig[exUnit]?.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
      const plateLimits = gymEquipmentConfig[exUnit]?.barbell?.plate_limits || {};
      roundedT1 = roundToClosestLoadable(t1, barWeight, enabledPlates, plateLimits);
      roundedT2 = roundToClosestLoadable(t2, barWeight, enabledPlates, plateLimits);
    }
    
    // 默认用 T1 起始 (1RM × 0.85) 作为 initial_weight
    setterMap[lift](String(roundedT1));
    setSuccessMsg(`✨ ${LIFT_CN_NAMES[lift]}: 1RM ${rm}${exUnit} → 起始 ${roundedT1}${exUnit} (T1×0.85, T2 建议 ${roundedT2}${exUnit})`);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm font-semibold">读取云端配置中...</p>
      </div>
    );
  }

  const inputClass = "w-full bg-transparent font-mono font-semibold text-sm md:text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const renderE1RMCalculatorSheet = () => {
    if (!calcLift) return null;
    const exUnit = exerciseUnits[calcLift] || weightUnit;
    const liftName = LIFT_CN_NAMES[calcLift];

    // Formula mode calculation
    const w = parseFloat(calcWeight) || 0;
    const r = parseInt(calcReps) || 0;

    let epleyVal = 0;
    let brzyckiVal = 0;
    let isRepsValid = r > 0 && r < 36;

    if (w > 0 && r > 0) {
      if (r === 1) {
        epleyVal = w;
        brzyckiVal = w;
      } else {
        epleyVal = Math.round(w * (1 + r / 30) * 10) / 10;
        if (r < 37) {
          brzyckiVal = Math.round(w * (36 / (37 - r)) * 10) / 10;
        }
      }
    }

    // RPE mode calculation
    const parsedRepsForRpe = parseInt(calcReps) || 5;
    const P = RPE_PERCENTAGE_CHART[parsedRepsForRpe]?.[calcRpe] || 0;
    const currentWeight = parseFloat(calcWeight) || 0;
    const computedE1RM = P > 0 ? Math.round(currentWeight / P * 10) / 10 : 0;

    const applyValue = (val) => {
      const setterMap = {
        squat: setSquatOneRm,
        bench: setBenchOneRm,
        deadlift: setDeadliftOneRm,
        press: setPressOneRm,
      };
      const setter = setterMap[calcLift];
      if (setter && val > 0) {
        setter(String(val));
      }
      setCalcLift(null);
    };

    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
        {/* Backdrop overlay */}
        <div 
          className="bottom-sheet-backdrop animate-sheet-fade-in"
          onClick={() => setCalcLift(null)}
        />
        
        {/* Bottom sheet content card */}
        <div className="bottom-sheet-container animate-sheet-slide-up w-full flex flex-col gap-4 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border-card/50 dark:border-border-card-dark/50">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">
                e1RM 估算计算器
              </span>
              <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                针对: {liftName}
              </span>
            </div>
            <button 
              type="button" 
              className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark rounded-full"
              onClick={() => setCalcLift(null)}
              aria-label="关闭计算器"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card dark:border-border-card-dark rounded-lg p-0.5 gap-0.5 select-none">
            <button
              type="button"
              onClick={() => {
                setCalcTab('formula');
                setCalcReps(5);
              }}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border-0 ${
                calcTab === 'formula'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main'
              }`}
            >
              无RPE估算
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcTab('rpe');
                setCalcReps(5);
                setCalcRpe(8);
              }}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border-0 ${
                calcTab === 'rpe'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main'
              }`}
            >
              RPE估算
            </button>
          </div>

          {/* Tab Content with Unified Height Container */}
          <div className="min-h-[435px] flex flex-col justify-between animate-fadeIn">
            {calcTab === 'formula' ? (
              <div className="flex flex-col gap-4">
                {/* Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="section-subtitle select-none mb-0">测试重量 ({exUnit})</label>
                    <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="重量"
                        value={calcWeight}
                        onChange={(e) => setCalcWeight(e.target.value)}
                        className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                      />
                      <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="section-subtitle select-none mb-0">完成次数 (Reps)</label>
                    <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="36"
                        placeholder="次数"
                        value={calcReps}
                        onChange={(e) => setCalcReps(e.target.value)}
                        className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm font-medium text-text-secondary/50 select-none">次</span>
                    </div>
                  </div>
                </div>

                {/* Live Calculation Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Epley Card */}
                  <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${w > 0 && r > 0 ? 'bg-primary/5 border-primary/20' : 'bg-bg-main/10 border-border-card/40'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main dark:text-text-main-dark">Epley 公式</span>
                      {r > 1 && r <= 10 && (
                        <span className="badge badge-success badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-green-500/10 text-green-500 border border-green-500/20">推荐</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark font-sans leading-none">估算 1RM</span>
                      <span className="text-xl font-black font-mono text-primary mt-1">
                        {epleyVal > 0 ? `${epleyVal} ${exUnit}` : `-- ${exUnit}`}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-secondary/80 leading-tight">
                      公式: W × (1 + R/30)<br />
                      特点: 适合 1-10 次中低重复
                    </span>
                    <button
                      type="button"
                      className="btn-main w-full h-8 min-h-8 rounded-lg text-xs mt-1 font-bold text-white bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none border-0"
                      disabled={!(epleyVal > 0)}
                      onClick={() => applyValue(epleyVal)}
                    >
                      应用此值
                    </button>
                  </div>

                  {/* Brzycki Card */}
                  <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${w > 0 && r > 0 && isRepsValid ? 'bg-primary/5 border-primary/20' : 'bg-bg-main/10 border-border-card/40'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main dark:text-text-main-dark">Brzycki 公式</span>
                      {r > 10 && r <= 15 && (
                        <span className="badge badge-success badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-green-500/10 text-green-500 border border-green-500/20">推荐</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark font-sans leading-none">估算 1RM</span>
                      <span className="text-xl font-black font-mono text-primary mt-1">
                        {brzyckiVal > 0 && isRepsValid ? `${brzyckiVal} ${exUnit}` : `-- ${exUnit}`}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-secondary/80 leading-tight">
                      公式: W × 36 / (37 - R)<br />
                      特点: 适合 10-15 次中高重复
                    </span>
                    <button
                      type="button"
                      className="btn-main w-full h-8 min-h-8 rounded-lg text-xs mt-1 font-bold text-white bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none border-0"
                      disabled={!(brzyckiVal > 0 && isRepsValid)}
                      onClick={() => applyValue(brzyckiVal)}
                    >
                      应用此值
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Inputs with standard unified layout (matching Formula mode) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Weight Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="section-subtitle select-none mb-0">测试重量 ({exUnit})</label>
                    <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="重量"
                        value={calcWeight}
                        onChange={(e) => setCalcWeight(e.target.value)}
                        className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                      />
                      <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                    </div>
                  </div>

                  {/* e1RM Display Card (styled like standard input, but readonly and highlighted) */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="section-subtitle select-none mb-0">e1RM ({exUnit})</label>
                      <span className="badge badge-info badge-xs scale-90 px-1 py-0.5 font-bold text-[9px] bg-blue-500/15 text-blue-500 border border-blue-500/20">自动</span>
                    </div>
                    <div className="input input-bordered flex items-center gap-1 bg-primary/5 border-primary/20 px-3 h-11 transition-colors select-none">
                      <div className="w-full font-mono font-black text-sm text-primary text-right pr-0.5">
                        {computedE1RM > 0 ? `${computedE1RM}` : `0`}
                      </div>
                      <span className="text-sm font-bold text-primary/70 select-none">{exUnit}</span>
                    </div>
                  </div>
                </div>

                {/* Infinite pickers */}
                <InfiniteScrollPicker
                  options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                  value={parsedRepsForRpe}
                  onChange={setCalcReps}
                  label="次数 (Reps)"
                />

                <InfiniteScrollPicker
                  options={[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]}
                  value={calcRpe}
                  onChange={setCalcRpe}
                  label="RPE (自感用力程度)"
                />

                {/* RTS RPE Formula Info Note */}
                <span className="text-[9px] text-text-secondary/80 leading-tight text-center block mt-1">
                  RTS RPE 公式: 重量 / RTS 百分比 (来自 Mike Tuchscherer 强度百分比表)
                </span>

                {/* Apply Button */}
                <button
                  type="button"
                  className="btn-main w-full h-11 min-h-11 font-bold text-white bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none border-0"
                  onClick={() => applyValue(computedE1RM)}
                  disabled={!(computedE1RM > 0)}
                >
                  填入预估 1RM
                </button>
              </div>
            )}

            {/* Reps warning notice (User note requirement) */}
            <div className="p-3 rounded-xl bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/50 dark:border-border-card-dark/50 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed mt-2">
              <span className="font-bold text-text-main dark:text-text-main-dark flex items-center gap-1 mb-1">
                💡 估算提示与建议
              </span>
              估算公式在重复次数较少时（如 <b>2-8 次</b>）最为准确。如果次数过多（<b>大于 15 次</b>），由于耐力因素影响，估算误差会随之变大。建议使用低重复组数据进行估算。
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-aux w-8 h-8 rounded-full" onClick={onBack} aria-label="返回"><ArrowLeft size={18} /></button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 GZCLP</h3>
      </div>

      <div className="alert-box text-sm leading-relaxed border-l-4 mb-4">
        💡 <b>GZCLP 配置向导（推荐配置流程）：</b><br />
        1️⃣ <b>第一步：</b> 填入您的各主项 1RM，系统将以此计算合理的起步重量。如果您不知道 1RM，可以直接跳到第二步。<br />
        2️⃣ <b>第二步：</b> 确认首训的起始重量。如果您在第一步中点击了一键应用，此处将自动填充；否则，您需要在此手动填入首次训练的重量。<br />
        3️⃣ <b>第三步：</b> 挑选并配置您的 T3 辅助动作（如二头弯举、高位下拉等），以补充主项训练。
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <ShieldAlert size={14} className="flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert-box !border-success dark:!border-success bg-green-500/10 dark:bg-green-500/5 !text-success dark:!text-success flex items-center gap-2 text-sm border-l-4">
          <CheckCircle size={14} className="flex-shrink-0" /><span>{successMsg}</span>
        </div>
      )}

      {/* 训练日程 */}
      <div className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark select-none">训练日程</h3>

        {/* 日程模式选择 */}
        <div className="flex gap-2">
          <button type="button"
            className={`btn btn-sm flex-1 font-bold text-xs cursor-pointer transition-all ${
              scheduleType === 'weekly' ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
            }`}
            onClick={() => setScheduleType('weekly')}
          >
            每周固定几天
          </button>
          <button type="button"
            className={`btn btn-sm flex-1 font-bold text-xs cursor-pointer transition-all ${
              scheduleType === 'custom-ratio' ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
            }`}
            onClick={() => setScheduleType('custom-ratio')}
          >
            练 N 休 M
          </button>
        </div>

        {/* 每周固定几天模式 */}
        {scheduleType === 'weekly' && (
          <>
            <div className="flex gap-1.5 sm:gap-2 justify-between">
              {weekdays.map(d => (
                <button key={d.key} type="button"
                  className={`btn btn-sm flex-1 max-w-10 aspect-square min-h-0 min-w-0 p-0 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                    trainingDays.includes(d.key) ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
                  }`}
                  onClick={() => setTrainingDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
                >{d.label}</button>
              ))}
            </div>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">每周 {trainingDays.length} 天训练</p>
          </>
        )}

        {/* 练 N 休 M 模式 */}
        {scheduleType === 'custom-ratio' && (
          <div className="flex items-center gap-3 justify-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">练</span>
              <select
                className="select-standard !h-9 !w-16 !text-xs !rounded-lg"
                value={trainDays}
                onChange={(e) => setTrainDays(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">天</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">休</span>
              <select
                className="select-standard !h-9 !w-16 !text-xs !rounded-lg"
                value={restDays}
                onChange={(e) => setRestDays(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">天</span>
            </div>
          </div>
        )}
      </div>

      {/* 开始日期 */}
      <div className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Calendar size={16} className="text-primary" /><span>开始日期</span>
        </h3>
        <input type="date"
          className="input input-bordered w-full bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
          value={startDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
          默认从今天开始，你也可以选择未来的某一天开始训练
        </p>
      </div>

      {/* 1. 各主项 1RM 与进阶参数 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Zap size={16} className="text-primary" /><span>第一步：设置各主项 1RM 与进阶参数（推荐）</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-2.5">
          👉 <b>最佳实践：</b>请在此输入您的 1RM（单次最大重量），然后点击下方的<b>「一键应用 1RM → 起始重量」</b>按钮。系统将自动按 <b>85%</b> 的安全比例计算首训起始重量并同步到下方的「第二步」。<br />
          ⚠️ <i>如果您不知道 1RM，可以直接跳过此步，直接到「第二步」手动填入起始重量。</i>
        </p>

        <div className="flex flex-col gap-3">
          {(() => {
            const lifts = [
              { key: 'squat',    label: '深蹲 (Squat)',    oneRm: squatOneRm,    setOneRm: setSquatOneRm,    t1Step: squatT1Step, setT1: setSquatT1Step,    t2Step: squatT2Step, setT2: setSquatT2Step,    t1Chain: squatT1Chain, setT1Chain: setSquatT1Chain, t2Chain: squatT2Chain, setT2Chain: setSquatT2Chain },
              { key: 'bench',    label: '卧推 (Bench)',    oneRm: benchOneRm,    setOneRm: setBenchOneRm,    t1Step: benchT1Step, setT1: setBenchT1Step,    t2Step: benchT2Step, setT2: setBenchT2Step,    t1Chain: benchT1Chain, setT1Chain: setBenchT1Chain, t2Chain: benchT2Chain, setT2Chain: setBenchT2Chain },
              { key: 'deadlift', label: '硬拉 (Deadlift)', oneRm: deadliftOneRm, setOneRm: setDeadliftOneRm, t1Step: deadliftT1Step, setT1: setDeadliftT1Step, t2Step: deadliftT2Step, setT2: setDeadliftT2Step, t1Chain: deadliftT1Chain, setT1Chain: setDeadliftT1Chain, t2Chain: deadliftT2Chain, setT2Chain: setDeadliftT2Chain },
              { key: 'press',    label: '推举 (Press)',    oneRm: pressOneRm,    setOneRm: setPressOneRm,    t1Step: pressT1Step, setT1: setPressT1Step,    t2Step: pressT2Step, setT2: setPressT2Step,    t1Chain: pressT1Chain, setT1Chain: setPressT1Chain, t2Chain: pressT2Chain, setT2Chain: setPressT2Chain },
            ];
            return lifts.map(L => {
              const exUnit = exerciseUnits[L.key] || weightUnit;
              const rm = parseFloat(L.oneRm) || 0;
              let t1Start = deriveStartFromOneRm(rm, 0.85);
              let t2Start = deriveStartFromOneRm(rm, 0.65);
              if (gymEquipmentConfig) {
                const barWeight = gymEquipmentConfig[exUnit]?.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
                const enabledPlates = gymEquipmentConfig[exUnit]?.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
                const plateLimits = gymEquipmentConfig[exUnit]?.barbell?.plate_limits || {};
                t1Start = roundToClosestLoadable(t1Start, barWeight, enabledPlates, plateLimits);
                t2Start = roundToClosestLoadable(t2Start, barWeight, enabledPlates, plateLimits);
              }
              const cloudOneRm = latestOneRms[L.key];
              return (
                <div key={L.key} className="p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base font-bold text-text-main dark:text-text-main-dark">{L.label}</span>
                    {cloudOneRm && (
                      <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono">
                        云端 1RM: {cloudOneRm.e1rm_kg}kg
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => applyOneRmToInitial(L.key)}
                    className="btn-main w-full"
                    title={`用 1RM × 0.85 自动填入起始重量`}
                  >
                    <Sparkles size={14} />一键应用 1RM → 起始重量
                  </button>

                  {/* 1RM 输入 + T1/T2 加重 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between h-6">
                        <label className="section-subtitle select-none mb-0">1RM ({exUnit})</label>
                        <button
                          type="button"
                          className="btn-aux h-5 px-1 rounded text-[10px] font-extrabold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer flex items-center gap-0.5"
                          onClick={() => {
                            setCalcLift(L.key);
                            setCalcTab('formula');
                            setCalcWeight(L.oneRm || '');
                            setCalcReps(5);
                            setCalcRpe(8);
                          }}
                          title="估算 1RM"
                        >
                          <Calculator size={10} />
                          <span>估算</span>
                        </button>
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-11 transition-colors">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={L.oneRm}
                          onChange={(e) => L.setOneRm(e.target.value)}
                          className={inputClass}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center h-6">
                        <label className="section-subtitle select-none mb-0">T1 加重</label>
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-11 transition-colors">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={L.t1Step}
                          onChange={(e) => L.setT1(e.target.value)}
                          className={inputClass}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center h-6">
                        <label className="section-subtitle select-none mb-0">T2 加重</label>
                      </div>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-11 transition-colors">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={L.t2Step}
                          onChange={(e) => L.setT2(e.target.value)}
                          className={inputClass}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                      </div>
                    </div>
                  </div>

                  {rm > 0 && (
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-mono bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-2">
                      💡 1RM 推导：T1 起始 <span className="font-bold text-primary">{t1Start}{exUnit}</span>
                      <span className="mx-1 opacity-50">·</span>
                      T2 起始 <span className="font-bold text-primary">{t2Start}{exUnit}</span>
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <ProgressionChainEditor
                      tierLabel="T1"
                      chain={L.t1Chain}
                      onChange={L.setT1Chain}
                    />
                    <ProgressionChainEditor
                      tierLabel="T2"
                      chain={L.t2Chain}
                      onChange={L.setT2Chain}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* 2. 首训默认重量 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Scale size={16} className="text-primary" /><span>第二步：确认或手动设置「首训起始重量」</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 rounded-lg p-2.5">
          👉 <b>如何确定该值：</b><br />
          1. <b>如果您已完成第一步：</b>点击上方的「一键应用」后，此处的重量已被自动填充为 1RM × 85%（T1 推荐起始重），请在此核对确认即可。<br />
          2. <b>如果您跳过了第一步：</b>请根据您的真实训练水平，在此手动填入您首次训练该动作时的负重（如空杆 20kg 或者是较轻的安全负荷）。
        </p>

        {/* 全局单位切换 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-text-secondary dark:text-text-secondary-dark">全局单位</span>
          <div className="flex bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded-lg overflow-hidden">
            <button type="button"
              className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => setWeightUnit('kg')}>KG</button>
            <button type="button"
              className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${weightUnit === 'lbs' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => setWeightUnit('lbs')}>LBS</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[['squat', '深蹲 (Squat)', squatWeight, setSquatWeight],
            ['bench', '卧推 (Bench)', benchWeight, setBenchWeight],
            ['deadlift', '硬拉 (Deadlift)', deadliftWeight, setDeadliftWeight],
            ['press', '推举 (Press)', pressWeight, setPressWeight]
          ].map(([key, label, val, setter]) => {
            const exUnit = exerciseUnits[key] || weightUnit;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="section-subtitle select-none">{label}</label>
                  <div className="flex bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded overflow-hidden">
                    <button type="button"
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${exUnit === 'kg' ? 'bg-primary text-white' : 'text-text-secondary'}`}
                      onClick={() => setExerciseUnits(prev => ({ ...prev, [key]: 'kg' }))}>KG</button>
                    <button type="button"
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${exUnit === 'lbs' ? 'bg-primary text-white' : 'text-text-secondary'}`}
                      onClick={() => setExerciseUnits(prev => ({ ...prev, [key]: 'lbs' }))}>LB</button>
                  </div>
                </div>
                <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                  <input type="number" step="0.5" className={inputClass} value={val} onChange={(e) => setter(e.target.value)} />
                  <span className="text-sm font-medium text-text-secondary/50 select-none">{exUnit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. T3 辅助动作配置 */}
      <div className="card flex flex-col gap-4">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Dumbbell size={16} className="text-primary" /><span>第三步：T3 辅助动作配置</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
          GZCLP 推荐使用 T3 辅助动作（高次数、小重量、接近力竭）来针对性增强弱项肌肉并提升耐力。请为每一天选择 1-2 个辅助动作，并设定它们的起始重量和加重步长。
        </p>

        {/* 每日 T3 动作选择 */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark">每日 T3 动作选择</h4>
          {dayTemplate.map((day, dayIdx) => (
            <div key={day.label} className="flex flex-col gap-2 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-main dark:text-text-main-dark">{day.label}</span>
                <div className="flex items-center gap-1">
                  <button type="button"
                    className="btn-aux"
                    onClick={() => {
                      const newTemplate = [...dayTemplate];
                      newTemplate[dayIdx] = { ...day, t3: [...day.t3, ''] };
                      setDayTemplate(newTemplate);
                    }}
                    disabled={day.t3.length >= 4}
                  >
                    +
                  </button>
                  <button type="button"
                    className="btn-aux"
                    onClick={() => {
                      if (day.t3.length <= 1) return;
                      const newTemplate = [...dayTemplate];
                      newTemplate[dayIdx] = { ...day, t3: day.t3.slice(0, -1) };
                      setDayTemplate(newTemplate);
                    }}
                    disabled={day.t3.length <= 1}
                  >
                    -
                  </button>
                </div>
              </div>
               <div className="flex flex-col gap-2">
                 {day.t3.map((exName, exIdx) => {
                   const exInfo = exerciseNameMap[exName];
                   const displayName = exInfo?.name_cn || exName;
                   return (
                     <button key={exIdx} type="button"
                       className="btn btn-sm btn-outline border-border-card dark:border-border-card-dark text-left justify-start cursor-pointer"
                       onClick={() => {
                         setSelectingTarget({ dayLabel: day.label, idx: exIdx });
                         setSelectorOpen(true);
                       }}
                     >
                       <span className={`truncate ${exName ? 'text-text-main dark:text-text-main-dark font-semibold' : 'text-text-secondary italic'}`}>
                         {displayName || '点击选择动作...'}
                       </span>
                     </button>
                   );
                 })}
               </div>
            </div>
          ))}
        </div>

        {/* T3 动作配置池 */}
        {(() => {
          // 只渲染当前在 dayTemplate 中使用的动作
          const usedT3Names = new Set();
          dayTemplate.forEach(day => {
            day.t3.forEach(name => { if (name && name.trim()) usedT3Names.add(name.trim()); });
          });
          const activeT3Exercises = t3Exercises.filter(ex => usedT3Names.has(ex.name));
          
          return activeT3Exercises.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark">T3 动作进阶配置</h4>
              {activeT3Exercises.map((ex) => {
                const exIdx = t3Exercises.findIndex(e => e.name === ex.name);
                const exUnit = exerciseUnits[ex.name] || weightUnit;
              return (
                <div key={ex.name} className="flex flex-col gap-2 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs">T3</span>
                       <span className="text-sm font-bold text-text-main dark:text-text-main-dark">{exerciseNameMap[ex.name]?.name_cn || ex.name}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="flex bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded overflow-hidden">
                         <button type="button"
                           className={`px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${exUnit === 'kg' ? 'bg-primary text-white' : 'text-text-secondary'}`}
                           onClick={() => setExerciseUnits(prev => ({ ...prev, [ex.name]: 'kg' }))}>KG</button>
                         <button type="button"
                           className={`px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${exUnit === 'lbs' ? 'bg-primary text-white' : 'text-text-secondary'}`}
                           onClick={() => setExerciseUnits(prev => ({ ...prev, [ex.name]: 'lbs' }))}>LB</button>
                       </div>
                     </div>
                  </div>
                   <div className="grid grid-cols-3 gap-2">
                     <div className="flex flex-col gap-1">
                       <label className="section-subtitle select-none">起始重量</label>
                       <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                         <input type="number" step="0.5" min="0"
                           className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                           value={exUnit === 'lbs' ? convertWeight(ex.startWeightKg ?? 10, 'lbs') : (ex.startWeightKg ?? 10)}
                           onChange={(e) => {
                             const val = parseFloat(e.target.value) || 0;
                             const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                             const newT3 = [...t3Exercises];
                             newT3[exIdx] = { ...newT3[exIdx], startWeightKg: kgVal };
                             setT3Exercises(newT3);
                           }}
                         />
                         <span className="text-xs text-text-secondary/50">{exUnit}</span>
                       </div>
                     </div>
                     <div className="flex flex-col gap-1">
                       <label className="section-subtitle select-none">加重步长</label>
                       <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                         <input type="number" step="0.5" min="0.5"
                           className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                           value={exUnit === 'lbs' ? convertWeight(ex.incrementKg, 'lbs') : ex.incrementKg}
                           onChange={(e) => {
                             const val = parseFloat(e.target.value) || 0.5;
                             const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                             const newT3 = [...t3Exercises];
                             newT3[exIdx] = { ...newT3[exIdx], incrementKg: kgVal };
                             setT3Exercises(newT3);
                           }}
                         />
                         <span className="text-xs text-text-secondary/50">{exUnit}</span>
                       </div>
                     </div>
                    <div className="flex flex-col gap-1">
                      <label className="section-subtitle select-none">达标门槛</label>
                      <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                        <input type="number" step="1" min="5"
                          className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                          value={ex.targetReps}
                          onChange={(e) => {
                            const newT3 = [...t3Exercises];
                            newT3[exIdx] = { ...newT3[exIdx], targetReps: parseInt(e.target.value) || 5 };
                            setT3Exercises(newT3);
                          }}
                        />
                        <span className="text-xs text-text-secondary/50">次</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
        })()}
      </div>

      {/* T3 动作选择器模态框 */}
      {selectorOpen && selectingTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark w-full max-w-sm rounded-2xl shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-3.5 border-b border-border-card dark:border-border-card-dark flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-main dark:text-text-main-dark">选择 T3 辅助动作</h3>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                  为 {selectingTarget.dayLabel} 选择动作
                </p>
              </div>
              <button type="button" onClick={() => setSelectorOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-secondary hover:text-text-main flex items-center justify-center transition-all text-sm font-bold cursor-pointer">
                ×
              </button>
            </div>

            {/* Search & Filter */}
            <div className="p-3 border-b border-border-card dark:border-border-card-dark space-y-2">
              <div className="relative">
                <input type="text" placeholder="搜索动作名称、器械..."
                  className="input input-bordered input-sm w-full pl-8 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus:border-primary"
                  value={selectorSearch} onChange={(e) => setSelectorSearch(e.target.value)} autoFocus />
                <Search size={14} className="absolute left-2.5 top-2.5 text-text-secondary/50" />
                {selectorSearch && (
                  <button type="button" onClick={() => setSelectorSearch('')}
                    className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-main text-xs cursor-pointer">
                    ×
                  </button>
                )}
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {muscleCategories.map(cat => (
                  <button key={cat.label} type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                      selectorMuscleFilter === cat.value
                        ? 'bg-primary text-white border-primary shadow-md'
                        : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary dark:text-text-secondary-dark border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                    }`}
                    onClick={() => setSelectorMuscleFilter(cat.value)}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-[150px] max-h-[40vh]">
              <button type="button" onClick={() => {
                const newTemplate = dayTemplate.map(d =>
                  d.label === selectingTarget.dayLabel
                    ? { ...d, t3: d.t3.map((ex, i) => i === selectingTarget.idx ? '' : ex) }
                    : d
                );
                setDayTemplate(newTemplate);
                setSelectorOpen(false);
              }}
                className="w-full text-left p-2 rounded-lg border border-dashed border-border-card/60 dark:border-border-card-dark/60 hover:border-error/40 hover:bg-bg-alert/10 text-text-secondary hover:text-error flex items-center justify-between transition-all">
                <span className="text-xs font-semibold">🚫 清除选择</span>
              </button>

              {filteredExercises.map(ex => {
                const isSelected = dayTemplate.find(d => d.label === selectingTarget.dayLabel)?.t3[selectingTarget.idx] === ex.name;
                return (
                  <button key={ex.name} type="button"
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-bg-main/20 dark:bg-bg-main-dark/20 hover:bg-bg-hover dark:hover:bg-bg-hover-dark border-border-card/30 dark:border-border-card-dark/30 text-text-main dark:text-text-main-dark'
                    }`}
                    onClick={() => {
                      const newTemplate = dayTemplate.map(d =>
                        d.label === selectingTarget.dayLabel
                          ? { ...d, t3: d.t3.map((name, i) => i === selectingTarget.idx ? ex.name : name) }
                          : d
                      );
                      setDayTemplate(newTemplate);
                      setSelectorOpen(false);
                    }}>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate">{ex.name_cn || ex.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{(ex.primary_muscles || []).slice(0, 2).join(', ')}</span>
                        <span className="text-[10px] text-text-secondary/50">•</span>
                        <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{(ex.equipment || []).slice(0, 1).join(', ')}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">当前</span>
                    )}
                  </button>
                );
              })}

              {filteredExercises.length === 0 && (
                <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark italic text-xs">
                  未找到匹配的动作
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <button type="button"
        className="btn-main w-full mt-2 mb-8"
        onClick={handleSave} disabled={saving}
      >
        {saving
          ? <><Loader2 className="animate-spin" size={18} /><span>正在保存设定...</span></>
          : <><Save size={18} /><span>{isExisting ? '保存配置' : '保存并开始计划'}</span></>}
      </button>

      {calcLift && renderE1RMCalculatorSheet()}
    </div>
  );
}

// ==================== 通用配置（其他计划） ====================

function GenericConfig({ program, exercisesMap, onBack, onActivated, isExisting }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [userProgramId, setUserProgramId] = useState(null);
  const config = program.config || {};
  const defaultWeights = config.default_weights || {};
  const defaultIncrements = config.default_increment || {};

  // 日程模式
  const [scheduleType, setScheduleType] = useState('weekly');
  const [trainDays, setTrainDays] = useState(1);
  const [restDays, setRestDays] = useState(1);

  // 开始日期（与 GzclpConfig 对齐，确保非 GZCLP 计划也有正确的训练日判断）
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const allExercises = new Set();
  if (config.day_map) {
    Object.values(config.day_map).forEach(day => {
      if (Array.isArray(day)) day.forEach(e => allExercises.add(e.exercise));
      else {
        if (day.T1) allExercises.add(day.T1);
        if (day.T2) allExercises.add(day.T2);
        if (day.T3) (day.T3 || []).forEach(e => allExercises.add(e));
      }
    });
  }

  const [exerciseConfig, setExerciseConfig] = useState(() => {
    const init = {};
    allExercises.forEach(ex => {
      const defaultIncr = typeof defaultIncrements === 'object'
        ? (defaultIncrements[Object.keys(defaultIncrements)[0]] ?? 2.5)
        : (defaultIncrements ?? 2.5);
      init[ex] = { initial_weight: defaultWeights[ex] ?? 20, increment: defaultIncr };
    });
    return init;
  });

  const [trainingDays, setTrainingDays] = useState(() => {
    const saved = localStorage.getItem('training_days');
    if (saved) { try { return JSON.parse(saved); } catch (e) { console.warn('解析本地训练日程缓存失败:', e); } }
    return ['Monday', 'Wednesday', 'Friday', 'Saturday'];
  });

  const weekdays = [
    { key: 'Monday', label: '一' }, { key: 'Tuesday', label: '二' },
    { key: 'Wednesday', label: '三' }, { key: 'Thursday', label: '四' },
    { key: 'Friday', label: '五' }, { key: 'Saturday', label: '六' },
    { key: 'Sunday', label: '日' },
  ];

  useEffect(() => {
    const loadExisting = async () => {
      try {
        // 1. 先查找当前活跃的计划订阅
        const existingActive = await fetchActiveUserProgram(program.id);
        let existingUP = existingActive;
        let isExistingActive = !!existingUP;

        // 2. 如果没有活跃订阅，寻找最近一次结束的订阅进行配置回填
        if (!existingUP) {
          const pastUP = await fetchLastEndedUserProgram(program.id);
          if (pastUP) {
            existingUP = pastUP;
          }
        }

        if (existingUP) {
          if (isExistingActive) {
            setUserProgramId(existingUP.id);
          } else {
            setUserProgramId(null); // 全新订阅，执行写入
          }
          if (existingUP.exercise_config) {
            setExerciseConfig(existingUP.exercise_config);
          }
          if (existingUP.schedule) {
            if (existingUP.schedule.scheduleType) setScheduleType(existingUP.schedule.scheduleType);
            if (existingUP.schedule.trainDays) setTrainDays(existingUP.schedule.trainDays);
            if (existingUP.schedule.restDays) setRestDays(existingUP.schedule.restDays);
            if (existingUP.schedule.training_days) setTrainingDays(existingUP.schedule.training_days);
          }
        }
      } catch (err) {
        console.warn('加载历史配置失败:', err.message);
      }
    };
    loadExisting();
  }, [program.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dayKeys = config.day_map ? Object.keys(config.day_map) : ['A'];
      const initialState = {
        current_day: dayKeys[0],
        start_date: startDate,
        last_training_date: startDate
      };

      const schedule = scheduleType === 'weekly'
        ? { scheduleType: 'weekly', training_days: trainingDays }
        : { scheduleType: 'custom-ratio', trainDays, restDays };

      const upData = {
        is_active: true,
        ended_at: null, // 激活计划时确保结束时间清空
        program_state: initialState,
        exercise_config: exerciseConfig,
        schedule,
        updated_at: new Date().toISOString()
      };

      await saveUserProgram(userProgramId, program.id, upData);

      localStorage.setItem('training_days', JSON.stringify(trainingDays));
      if (onActivated) onActivated();
    } catch (err) {
      setError('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-aux w-8 h-8 rounded-full" onClick={onBack}>←</button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 {program.name}</h3>
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <span>{error}</span>
        </div>
      )}

      <div className="card flex flex-col gap-3">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">训练日程</h4>

        {/* 日程模式选择 */}
        <div className="flex gap-2">
          <button type="button"
            className={`btn btn-sm flex-1 font-bold text-xs cursor-pointer transition-all ${
              scheduleType === 'weekly' ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
            }`}
            onClick={() => setScheduleType('weekly')}
          >
            每周固定几天
          </button>
          <button type="button"
            className={`btn btn-sm flex-1 font-bold text-xs cursor-pointer transition-all ${
              scheduleType === 'custom-ratio' ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
            }`}
            onClick={() => setScheduleType('custom-ratio')}
          >
            练 N 休 M
          </button>
        </div>

        {/* 每周固定几天模式 */}
        {scheduleType === 'weekly' && (
          <div className="flex gap-1.5 sm:gap-2 justify-between">
            {weekdays.map(d => (
              <button key={d.key} type="button"
                className={`btn btn-sm flex-1 max-w-10 aspect-square min-h-0 min-w-0 p-0 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                  trainingDays.includes(d.key) ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
                }`}
                onClick={() => setTrainingDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
              >{d.label}</button>
            ))}
          </div>
        )}

        {/* 练 N 休 M 模式 */}
        {scheduleType === 'custom-ratio' && (
          <div className="flex items-center gap-3 justify-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">练</span>
              <select
                className="select-standard !h-9 !w-16 !text-xs !rounded-lg"
                value={trainDays}
                onChange={(e) => setTrainDays(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">天</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">休</span>
              <select
                className="select-standard !h-9 !w-16 !text-xs !rounded-lg"
                value={restDays}
                onChange={(e) => setRestDays(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-text-main dark:text-text-main-dark">天</span>
            </div>
          </div>
        )}
      </div>

      {/* 开始日期（与 GzclpConfig 对齐） */}
      <div className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Calendar size={16} className="text-primary" /><span>开始日期</span>
        </h3>
        <input type="date"
          className="input input-bordered w-full bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
          value={startDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="card flex flex-col gap-4">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">首训默认重量 (kg)</h4>
        <div className="grid grid-cols-2 gap-3">
          {Array.from(allExercises).map(ex => (
            <div key={ex} className="flex flex-col gap-1">
              <label className="section-subtitle select-none">{getCNName(ex, exercisesMap)}</label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-9 transition-colors">
                <input type="number" step="0.5"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={exerciseConfig[ex]?.initial_weight ?? ''}
                  onChange={(e) => setExerciseConfig(prev => ({ ...prev, [ex]: { ...prev[ex], initial_weight: e.target.value === '' ? '' : parseFloat(e.target.value) } }))}
                />
                <span className="text-xs font-medium text-text-secondary/50 select-none">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button"
        className="btn-main w-full mt-2 mb-8"
        onClick={handleSave} disabled={saving}
      >
        {saving
          ? <><Loader2 className="animate-spin" size={18} /><span>保存中...</span></>
          : <><Save size={18} /><span>{isExisting ? '保存配置' : '保存并开始计划'}</span></>}
      </button>
    </div>
  );
}

// ==================== 主入口 ====================

function ProgramConfigScreen({ program, exercisesMap, onBack, onProgramStarted, gymEquipmentConfig = null }) {
  const engineType = program.config?.engine_type;
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkActive = async () => {
      try {
        const active = await fetchActiveUserProgram(program.id);
        setIsActive(!!active);
      } catch (err) {
        console.warn('Check active program failed:', err);
      }
    };
    checkActive();
  }, [program.id]);

  if (engineType === 'gzclp') {
    return <GzclpConfig program={program} onBack={onBack} onActivated={onProgramStarted} isExisting={isActive} gymEquipmentConfig={gymEquipmentConfig} />;
  }

  return <GenericConfig program={program} exercisesMap={exercisesMap} onBack={onBack} onActivated={onProgramStarted} isExisting={isActive} />;
}

export default ProgramConfigScreen;
