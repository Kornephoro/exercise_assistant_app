import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, ArrowLeft, Save, ShieldAlert, CheckCircle, Scale, Zap, Dumbbell, Search, Calendar, Sparkles } from 'lucide-react';
import { convertWeight, toStorageWeight } from './unitUtils';
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
        const { data, error } = await supabase
          .from('one_rm_records')
          .select('exercise, e1rm_kg, date, weight_kg, reps, formula, source')
          .order('date', { ascending: false });
        if (error) throw error;
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

function GzclpConfig({ program, onBack, onActivated, isExisting }) {
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
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
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
      const [upActiveRes, exRes] = await Promise.all([
        supabase.from('user_programs').select('id, exercise_config, schedule, day_map').eq('program_id', program.id).eq('is_active', true).limit(1),
        supabase.from('exercises').select('id, name, name_cn, primary_muscles, secondary_muscles, equipment').order('name')
      ]);

      if (upActiveRes.error) throw upActiveRes.error;
      if (exRes.error) console.warn('加载动作库失败:', exRes.error.message);

      let existingUP = upActiveRes.data?.[0];
      let isExistingActive = !!existingUP;

      // 如果当前没有活跃的计划，尝试拉取最后一次结束的计划配置用于“数据回填”
      if (!existingUP) {
        const { data: pastUPs } = await supabase
          .from('user_programs')
          .select('exercise_config, schedule, day_map')
          .eq('program_id', program.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (pastUPs?.length) {
          existingUP = pastUPs[0];
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
      setExercises(exRes.data || []);

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
          T3: day.t3 || []
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

      let result;
      if (userProgramId) {
        result = await supabase.from('user_programs').update(upData).eq('id', userProgramId);
      } else {
        result = await supabase.from('user_programs').insert([{ program_id: program.id, ...upData }]);
      }
      if (result.error) throw result.error;

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
    // 默认用 T1 起始 (1RM × 0.85) 作为 initial_weight
    setterMap[lift](String(t1));
    setSuccessMsg(`✨ ${LIFT_CN_NAMES[lift]}: 1RM ${rm}kg → 起始 ${t1}kg (T1×0.85, T2 建议 ${t2}kg)`);
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

  const inputClass = "w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-aux w-8 h-8 rounded-full" onClick={onBack} aria-label="返回"><ArrowLeft size={18} /></button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 GZCLP</h3>
      </div>

      <div className="alert-box text-sm leading-relaxed border-l-4 mb-4">
        1. <b>默认重量</b>：仅在无训练历史的首次打卡时作为基准。<br />
        2. <b>增重步长</b>：打卡成功时下一次加重的幅度。<br />
        3. <b>T3 达标门槛</b>：三组实际次数累加满足该目标时方可晋级加重。
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
            <div className="flex gap-2 justify-between">
              {weekdays.map(d => (
                <button key={d.key} type="button"
                  className={`btn btn-sm h-10 w-10 rounded-xl font-bold text-sm cursor-pointer transition-all ${
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

      {/* 1. 重量设置 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Scale size={16} className="text-primary" /><span>1. 首训默认重量</span>
        </h3>

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

      {/* 2. 各主项进阶参数 (移植自插件 GzclpConfigPanel) */}
      <div className="card">
        <h3 className="text-lg font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Zap size={18} className="text-primary" /><span>2. 各主项进阶参数</span>
        </h3>
        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed">
          设置每个主项的 1RM、T1/T2 加重步长、进阶链 (失败时前进到下一阶段)。
          可用「✨ 一键应用」按 1RM × 0.85 自动填入起始重量。
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
              const t1Start = deriveStartFromOneRm(rm, 0.85);
              const t2Start = deriveStartFromOneRm(rm, 0.65);
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
                      <label className="section-subtitle select-none">1RM ({exUnit})</label>
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
                      <label className="section-subtitle select-none">T1 加重</label>
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
                      <label className="section-subtitle select-none">T2 加重</label>
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

      {/* 3. T3 辅助动作配置 */}
      <div className="card flex flex-col gap-4">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Dumbbell size={16} className="text-primary" /><span>3. T3 辅助动作配置</span>
        </h3>

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
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
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
      // 1. 先查找当前活跃的计划订阅
      let { data } = await supabase
        .from('user_programs')
        .select('id, exercise_config, schedule')
        .eq('program_id', program.id)
        .eq('is_active', true)
        .limit(1);
      
      let existingUP = data?.[0];
      let isExistingActive = !!existingUP;

      // 2. 如果没有活跃订阅，寻找最近一次结束的订阅进行配置回填
      if (!existingUP) {
        const { data: pastUPs } = await supabase
          .from('user_programs')
          .select('exercise_config, schedule')
          .eq('program_id', program.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (pastUPs?.length) {
          existingUP = pastUPs[0];
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
    };
    loadExisting();
  }, [program.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dayKeys = config.day_map ? Object.keys(config.day_map) : ['A'];
      const initialState = { current_day: dayKeys[0] };

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

      let result;
      if (userProgramId) {
        result = await supabase.from('user_programs').update(upData).eq('id', userProgramId);
      } else {
        result = await supabase.from('user_programs').insert([{ program_id: program.id, ...upData }]);
      }
      if (result.error) throw result.error;

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
          <div className="flex gap-2 justify-between">
            {weekdays.map(d => (
              <button key={d.key} type="button"
                className={`btn btn-sm h-10 w-10 rounded-xl font-bold text-sm cursor-pointer transition-all ${
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

function ProgramConfigScreen({ program, exercisesMap, onBack, onProgramStarted }) {
  const engineType = program.config?.engine_type;
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkActive = async () => {
      const { data } = await supabase
        .from('user_programs')
        .select('is_active')
        .eq('program_id', program.id)
        .limit(1);
      setIsActive(!!data?.[0]?.is_active);
    };
    checkActive();
  }, [program.id]);

  if (engineType === 'gzclp') {
    return <GzclpConfig program={program} onBack={onBack} onActivated={onProgramStarted} isExisting={isActive} />;
  }

  return <GenericConfig program={program} exercisesMap={exercisesMap} onBack={onBack} onActivated={onProgramStarted} isExisting={isActive} />;
}

export default ProgramConfigScreen;
