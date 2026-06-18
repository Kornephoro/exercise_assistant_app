import { useState, useEffect, useMemo, useRef } from 'react';
import {
  fetchActiveUserProgram,
  fetchLastEndedUserProgram,
  fetchExercises,
  fetchOneRmRecords,
  saveUserProgram,
  fetchWorkoutTemplates
} from './services/programService';
import { Loader2, ArrowLeft, Save, ShieldAlert, Scale, Zap, Dumbbell, Calendar, Sparkles, Calculator, X, Shuffle, Info, RotateCcw, Ban, Activity, Lightbulb, AlertTriangle } from 'lucide-react';
import { convertWeight, toStorageWeight, roundToClosestLoadable } from './unitUtils';
import { deriveStartFromOneRm, MAIN_LIFT_KEYS } from './oneRmUtils';
import { getCNName } from './exerciseNames';
import ExercisePickerModal from './components/ExercisePickerModal';
import InfiniteScrollPicker from './components/InfiniteScrollPicker';
import WarmupSetsEditor from './components/WarmupSetsEditor';
import ProgressionChainEditor from './components/ProgressionChainEditor';

// 根据 1RM 和杠铃片情况计算默认加重步长（1RM 的 5% 并进行杠铃片就近圆整）
function calculateDefaultIncrement(oneRmStr, liftKey, exerciseUnits = {}, weightUnit = 'kg', gymEquipmentConfig = null) {
  const rm = parseFloat(oneRmStr);
  if (isNaN(rm) || rm <= 0) return '2.5';

  const rawIncr = rm * 0.05;
  const exUnit = exerciseUnits[liftKey] || weightUnit || 'kg';

  const config = gymEquipmentConfig;
  const barWeight = config?.[exUnit]?.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
  const enabledPlates = config?.[exUnit]?.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
  const plateLimits = config?.[exUnit]?.barbell?.plate_limits || {};

  const roundedIncr = roundToClosestLoadable(rawIncr + barWeight, barWeight, enabledPlates, plateLimits) - barWeight;

  if (roundedIncr <= 0) {
    const sortedPlates = [...enabledPlates].map(p => parseFloat(p)).sort((a, b) => a - b);
    const minPlatesIncrement = sortedPlates.length > 0 ? sortedPlates[0] * 2 : (exUnit === 'kg' ? 2.5 : 5);
    return minPlatesIncrement.toString();
  }

  return roundedIncr.toString();
}

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

// 默认 chain 已移至 ProgressionChainEditor 组件内部；
// 此处仍保留常量引用，供 GzclpConfig state 初始化使用
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

// 四大主项默认 1RM 估值（仅用于云端同步时判断用户是否已手动修改过）
const DEFAULT_ONE_RM = { squat: 80, bench: 60, deadlift: 100, press: 40 };

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

// ==================== GZCLP 完整配置 ====================

function GzclpConfig({ program, onBack, onActivated, isExisting, gymEquipmentConfig = null }) {
  const defaultWeights = program.config?.default_weights || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 初始重量
  // 第二步：T1/T2 首训起始重量（GZCLP 区分 T1 重低次 与 T2 轻高次）
  const [squatT1Weight, setSquatT1Weight] = useState('');
  const [squatT2Weight, setSquatT2Weight] = useState('');
  const [benchT1Weight, setBenchT1Weight] = useState('');
  const [benchT2Weight, setBenchT2Weight] = useState('');
  const [deadliftT1Weight, setDeadliftT1Weight] = useState('');
  const [deadliftT2Weight, setDeadliftT2Weight] = useState('');
  const [pressT1Weight, setPressT1Weight] = useState('');
  const [pressT2Weight, setPressT2Weight] = useState('');

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

  // 热身组配置状态
  const [squatWarmupEnabled, setSquatWarmupEnabled] = useState(false);
  const [squatWarmupSets, setSquatWarmupSets] = useState([]);
  const [benchWarmupEnabled, setBenchWarmupEnabled] = useState(false);
  const [benchWarmupSets, setBenchWarmupSets] = useState([]);
  const [deadliftWarmupEnabled, setDeadliftWarmupEnabled] = useState(false);
  const [deadliftWarmupSets, setDeadliftWarmupSets] = useState([]);
  const [pressWarmupEnabled, setPressWarmupEnabled] = useState(false);
  const [pressWarmupSets, setPressWarmupSets] = useState([]);

  // 模板库与导入状态
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [templateImporterOpen, setTemplateImporterOpen] = useState(false);
  const [importerTarget, setImporterTarget] = useState(null); // { dayLabel, type: 'warmup' | 'stretching' }

  // 1RM 拉取钩子
  const latestOneRms = useLatestOneRms();

  // e1RM 计算器相关状态
  const [calcLift, setCalcLift] = useState(null); // 'squat' | 'bench' | 'deadlift' | 'press' | null
  const [calcTab, setCalcTab] = useState('formula'); // 'formula' | 'rpe'
  const [calcWeight, setCalcWeight] = useState('');
  const [calcReps, setCalcReps] = useState(5); // 1 to 12 in RPE, or string in formula
  const [calcRpe, setCalcRpe] = useState(8); // 6 to 10

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
    { label: 'Day1', T1: 'squat', T2: 'bench', t3: [] },
    { label: 'Day2', T1: 'deadlift', T2: 'press', t3: [] },
    { label: 'Day3', T1: 'bench', T2: 'squat', t3: [] },
    { label: 'Day4', T1: 'press', T2: 'deadlift', t3: [] },
  ]);
  const [t3Exercises, setT3Exercises] = useState([]); // { name, targetReps, incrementKg, startWeightKg }
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState(null); // { dayLabel, idx }
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorMuscleFilter, setSelectorMuscleFilter] = useState('');
  const [selectorShowAll, setSelectorShowAll] = useState(false);
  const [t3SupersetCreator, setT3SupersetCreator] = useState({});
  const [customT2Weights, setCustomT2Weights] = useState({});
  const [customT2Steps, setCustomT2Steps] = useState({});

  // 单位系统
  const [weightUnit, setWeightUnit] = useState('kg');
  const [exerciseUnits, setExerciseUnits] = useState({});

  // 开始日期
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 原始 program_state 用于保存时保留进度
  const [existingProgramState, setExistingProgramState] = useState(null);

  // 全局减载周期配置
  const [deloadTriggerType, setDeloadTriggerType] = useState('none');
  const [deloadTriggerValue, setDeloadTriggerValue] = useState(8);
  const [deloadDuration, setDeloadDuration] = useState('1week');
  const [deloadIntensityPct, setDeloadIntensityPct] = useState(20);
  const [deloadVolumeType, setDeloadVolumeType] = useState('subtract_sets');
  const [deloadVolumeValue, setDeloadVolumeValue] = useState(2);
  const [deloadTransitionPolicy, setDeloadTransitionPolicy] = useState('direct_return');

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
    setLoading(true);
    setError(null);
    try {
      // 并行加载：user_programs 当前活跃配置 + 动作库 + 模板库
      const [existingActive, exRes, templatesRes] = await Promise.all([
        fetchActiveUserProgram(program.id),
        fetchExercises(),
        fetchWorkoutTemplates().catch(err => {
          console.warn('加载模板库失败:', err);
          return [];
        })
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
        setExistingProgramState(existingUP.program_state || null);
      } else {
        setUserProgramId(null); // 这是一轮全新的训练周期
        setExistingProgramState(null);
      }

      // 加载动作库
      setExercises(exRes || []);
      // 加载模板库
      setWorkoutTemplates(templatesRes || []);

      // 从 exercise_config 加载 T3 动作配置
      const t3Names = Object.keys(ec).filter(key =>
        !MAIN_LIFT_KEYS.includes(key) && ec[key]?.increment_t3
      );
      const loadedT3Exercises = t3Names.map(name => {
        const deloadMode = ec[name]?.deload_mode || (ec[name]?.deload_frequency && ec[name]?.deload_frequency > 0 ? 'sessions' : 'none');
        const deloadValue = ec[name]?.deload_value ?? ec[name]?.deload_frequency ?? 4;
        return {
          name,
          targetReps: ec[name]?.target_reps ?? 25,
          incrementKg: ec[name]?.increment_t3 ?? 2.5,
          startWeightKg: ec[name]?.initial_weight ?? 10,
          progressionType: ec[name]?.progression_type ?? 'gzclp_default',
          minReps: ec[name]?.min_reps ?? 12,
          maxReps: ec[name]?.max_reps ?? 15,
          sets: ec[name]?.sets ?? 3,
          deloadMode,
          deloadValue
        };
      });
      setT3Exercises(loadedT3Exercises);

      // 优先使用用户已保存的 day_map，兜底用程序默认 day_map
      const userDayMap = existingUP?.day_map;
      const baseDayMap = userDayMap || program.config?.day_map || {};
      const template = Object.keys(baseDayMap).map(label => ({
        label,
        T1: baseDayMap[label]?.T1 || null,
        T2: baseDayMap[label]?.T2 || null,
        t3: baseDayMap[label]?.T3 || [],
        warmup: baseDayMap[label]?.warmup || [],
        stretching: baseDayMap[label]?.stretching || [],
        T2_superset: baseDayMap[label]?.T2_superset || { enabled: false, exercise: '', rest_between: 45, rest_after: 90 },
        T3_supersets: baseDayMap[label]?.T3_supersets || []
      }));
      if (template.length > 0) {
        setDayTemplate(template);
      }

      // 从 exercise_config 或默认值加载主项配置（T1/T2 分开，向后兼容旧单值 initial_weight）
      const getT1Weight = (ex) => ec[ex]?.initial_weight_t1 ?? ec[ex]?.initial_weight ?? defaultWeights[ex] ?? 60;
      const getT2Weight = (ex) => ec[ex]?.initial_weight_t2 ?? (ec[ex]?.initial_weight ? parseFloat(ec[ex].initial_weight) * 0.65 : (defaultWeights[ex] ?? 30));
      const getOneRm = (ex) => ec[ex]?.one_rm ?? null;
      const getT1Chain = (ex) => ec[ex]?.t1_chain;
      const getT2Chain = (ex) => ec[ex]?.t2_chain;

      // 加载单位设置
      const savedUnit = ec._unit || 'kg';
      setWeightUnit(savedUnit);
      const savedExerciseUnits = {};
      [...MAIN_LIFT_KEYS, ...t3Names].forEach(ex => {
        if (ec[ex]?.unit) savedExerciseUnits[ex] = ec[ex].unit;
      });
      setExerciseUnits(savedExerciseUnits);

      // 从 exercise_config 或默认值加载其它动作 T2 配置
      const customW = {};
      const customS = {};
      Object.keys(ec).forEach(ex => {
        if (!['squat', 'bench', 'deadlift', 'press', '_unit'].includes(ex)) {
          const u = ec[ex]?.unit || savedUnit;
          let weightInKg = 30;
          if (ec[ex]?.initial_weight_t2 !== undefined) {
            weightInKg = ec[ex].initial_weight_t2;
          } else if (ec[ex]?.initial_weight !== undefined) {
            weightInKg = parseFloat(ec[ex].initial_weight) * 0.65;
          }
          let stepInKg = ec[ex]?.increment_t2 ?? 2.5;

          customW[ex] = u === 'lbs' ? convertWeight(weightInKg, 'lbs').toString() : weightInKg.toString();
          customS[ex] = u === 'lbs' ? convertWeight(stepInKg, 'lbs').toString() : stepInKg.toString();
        }
      });
      setCustomT2Weights(customW);
      setCustomT2Steps(customS);

      const getT1Incr = (ex) => {
        if (ec[ex]?.increment_t1 !== undefined && ec[ex]?.increment_t1 !== null) {
          return ec[ex].increment_t1;
        }
        const unit = savedExerciseUnits[ex] || savedUnit;
        const rmKg = getOneRm(ex) || DEFAULT_ONE_RM[ex];
        const rmInUnit = unit === 'lbs' ? convertWeight(rmKg, 'lbs') : rmKg;
        const stepInUnit = parseFloat(calculateDefaultIncrement(rmInUnit.toString(), ex, savedExerciseUnits, savedUnit, gymEquipmentConfig));
        return unit === 'lbs' ? parseFloat((stepInUnit / 2.20462).toFixed(4)) : stepInUnit;
      };
      const getT2Incr = (ex) => {
        if (ec[ex]?.increment_t2 !== undefined && ec[ex]?.increment_t2 !== null) {
          return ec[ex].increment_t2;
        }
        const unit = savedExerciseUnits[ex] || savedUnit;
        const rmKg = getOneRm(ex) || DEFAULT_ONE_RM[ex];
        const rmInUnit = unit === 'lbs' ? convertWeight(rmKg, 'lbs') : rmKg;
        const stepInUnit = parseFloat(calculateDefaultIncrement(rmInUnit.toString(), ex, savedExerciseUnits, savedUnit, gymEquipmentConfig));
        return unit === 'lbs' ? parseFloat((stepInUnit / 2.20462).toFixed(4)) : stepInUnit;
      };

      // 转换显示重量（数据库存 kg，根据单位显示）
      const displayTWeight = (ex, tier) => {
        const kg = tier === 'T1' ? getT1Weight(ex) : getT2Weight(ex);
        const unit = savedExerciseUnits[ex] || savedUnit;
        return unit === 'lbs' ? convertWeight(kg, 'lbs') : kg;
      };
      const displayIncr = (ex, tier) => {
        const kg = tier === 'T1' ? getT1Incr(ex) : getT2Incr(ex);
        const unit = savedExerciseUnits[ex] || savedUnit;
        return unit === 'lbs' ? convertWeight(kg, 'lbs') : kg;
      };

      setSquatT1Weight(displayTWeight('squat', 'T1').toString());
      setSquatT2Weight(displayTWeight('squat', 'T2').toString());
      setBenchT1Weight(displayTWeight('bench', 'T1').toString());
      setBenchT2Weight(displayTWeight('bench', 'T2').toString());
      setDeadliftT1Weight(displayTWeight('deadlift', 'T1').toString());
      setDeadliftT2Weight(displayTWeight('deadlift', 'T2').toString());
      setPressT1Weight(displayTWeight('press', 'T1').toString());
      setPressT2Weight(displayTWeight('press', 'T2').toString());

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

      // 加载各主项的热身配置
      setSquatWarmupEnabled(ec.squat?.warmup_enabled || false);
      setSquatWarmupSets(ec.squat?.warmup_sets || []);
      setBenchWarmupEnabled(ec.bench?.warmup_enabled || false);
      setBenchWarmupSets(ec.bench?.warmup_sets || []);
      setDeadliftWarmupEnabled(ec.deadlift?.warmup_enabled || false);
      setDeadliftWarmupSets(ec.deadlift?.warmup_sets || []);
      setPressWarmupEnabled(ec.press?.warmup_enabled || false);
      setPressWarmupSets(ec.press?.warmup_sets || []);

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

      // 从 exercise_config 加载全局计划减载配置
      const gd = ec._global_deload || {};
      setDeloadTriggerType(gd.trigger_type || 'none');
      setDeloadTriggerValue(gd.trigger_value ?? 8);
      setDeloadDuration(gd.duration || '1week');
      setDeloadIntensityPct(gd.intensity_pct ?? 20);
      setDeloadVolumeType(gd.volume_type || 'subtract_sets');
      setDeloadVolumeValue(gd.volume_value ?? 2);
      setDeloadTransitionPolicy(gd.transition_policy || 'direct_return');
    } catch (err) {
      setError('加载配置失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cloudSyncDone = useRef(false);

  // 同步云端 1RM → state (仅在 fetch 完成后, 如果本地初始 80/60/100/40 还没被用户改过)
  // 策略: 加载时如果云端有, 用云端的 (因为这是真实测试)
  useEffect(() => {
    if (Object.keys(latestOneRms).length === 0 || cloudSyncDone.current) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      cloudSyncDone.current = true;

      const updateStep = (lift, cloudVal) => {
        const cloudStr = String(cloudVal);
        const newStep = calculateDefaultIncrement(cloudStr, lift, exerciseUnits, weightUnit, gymEquipmentConfig);
        if (lift === 'squat') {
          setSquatOneRm(cloudStr);
          setSquatT1Step(newStep);
          setSquatT2Step(newStep);
        } else if (lift === 'bench') {
          setBenchOneRm(cloudStr);
          setBenchT1Step(newStep);
          setBenchT2Step(newStep);
        } else if (lift === 'deadlift') {
          setDeadliftOneRm(cloudStr);
          setDeadliftT1Step(newStep);
          setDeadliftT2Step(newStep);
        } else if (lift === 'press') {
          setPressOneRm(cloudStr);
          setPressT1Step(newStep);
          setPressT2Step(newStep);
        }
      };

      const sqCloud = latestOneRms.squat?.e1rm_kg;
      if (sqCloud && (Number(squatOneRm) === DEFAULT_ONE_RM.squat || !squatOneRm)) {
        updateStep('squat', sqCloud);
      }
      const beCloud = latestOneRms.bench?.e1rm_kg;
      if (beCloud && (Number(benchOneRm) === DEFAULT_ONE_RM.bench || !benchOneRm)) {
        updateStep('bench', beCloud);
      }
      const deCloud = latestOneRms.deadlift?.e1rm_kg;
      if (deCloud && (Number(deadliftOneRm) === DEFAULT_ONE_RM.deadlift || !deadliftOneRm)) {
        updateStep('deadlift', deCloud);
      }
      const prCloud = latestOneRms.press?.e1rm_kg;
      if (prCloud && (Number(pressOneRm) === DEFAULT_ONE_RM.press || !pressOneRm)) {
        updateStep('press', prCloud);
      }
    });
    return () => { cancelled = true; };
  }, [latestOneRms, squatOneRm, benchOneRm, deadliftOneRm, pressOneRm, exerciseUnits, weightUnit, gymEquipmentConfig]);

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

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setT3Exercises(prev => {
        const currentMap = {};
        prev.forEach(ex => { currentMap[ex.name] = ex; });

        const result = [];
        usedT3Names.forEach(name => {
          if (currentMap[name]) {
            result.push(currentMap[name]);
          } else {
            result.push({ 
              name, 
              targetReps: 25, 
              incrementKg: 2.5, 
              startWeightKg: 10,
              progressionType: 'gzclp_default',
              minReps: 12,
              maxReps: 15,
              sets: 3,
              deloadMode: 'sessions',
              deloadValue: 4
            });
          }
        });

        return result;
      });
    });
    return () => { cancelled = true; };
  }, [dayTemplate, exercises]);

  const handleSave = async () => {
    const squatT1W = parseFloat(squatT1Weight), squatT2W = parseFloat(squatT2Weight);
    const benchT1W = parseFloat(benchT1Weight), benchT2W = parseFloat(benchT2Weight);
    const deadliftT1W = parseFloat(deadliftT1Weight), deadliftT2W = parseFloat(deadliftT2Weight);
    const pressT1W = parseFloat(pressT1Weight), pressT2W = parseFloat(pressT2Weight);

    const t1Weights = [squatT1W, benchT1W, deadliftT1W, pressT1W];
    const t2Weights = [squatT2W, benchT2W, deadliftT2W, pressT2W];
    if ([...t1Weights, ...t2Weights].some(v => isNaN(v) || v <= 0)) {
      setError('所有主项的 T1 和 T2 起始重量必须为大于 0 的有效数字');
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

    // 验证 T1/T2 训练日搭配
    for (const day of dayTemplate) {
      if (!day.T1 || !day.T2) {
        setError(`「第二步」${day.label} 未配置 T1 或 T2，请为每个训练日选择 T1 和 T2 主项`);
        setSuccessMsg(null);
        return;
      }
      if (day.T1 === day.T2) {
        setError(`「第二步」${day.label} 的 T1 和 T2 不能选择相同动作`);
        setSuccessMsg(null);
        return;
      }
    }
    const t1Set = new Set(dayTemplate.map(d => d.T1));
    const t2Set = new Set(dayTemplate.map(d => d.T2));
    if (t1Set.size < dayTemplate.length) {
      setError('「第二步」T1 存在重复：每个主项在 T1 中只能出现一次');
      setSuccessMsg(null);
      return;
    }
    if (t2Set.size < dayTemplate.length) {
      setError('「第二步」T2 存在重复：每个主项在 T2 中只能出现一次');
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
        _global_deload: {
          trigger_type: deloadTriggerType,
          trigger_value: deloadTriggerValue,
          duration: deloadDuration,
          intensity_pct: deloadIntensityPct,
          volume_type: deloadVolumeType,
          volume_value: deloadVolumeValue,
          transition_policy: deloadTransitionPolicy,
        },
        squat: {
          initial_weight_t1: toKg(squatT1W, 'squat'),
          initial_weight_t2: toKg(squatT2W, 'squat'),
          initial_weight: toKg(squatT1W, 'squat'), // 向后兼容旧引擎
          one_rm: toKgVal(sqRM, 'squat'),
          increment_t1: toKg(sqT1, 'squat'),
          increment_t2: toKg(sqT2, 'squat'),
          t1_chain: squatT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: squatT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.squat || weightUnit,
          warmup_enabled: squatWarmupEnabled,
          warmup_sets: squatWarmupSets,
        },
        bench: {
          initial_weight_t1: toKg(benchT1W, 'bench'),
          initial_weight_t2: toKg(benchT2W, 'bench'),
          initial_weight: toKg(benchT1W, 'bench'),
          one_rm: toKgVal(beRM, 'bench'),
          increment_t1: toKg(beT1, 'bench'),
          increment_t2: toKg(beT2, 'bench'),
          t1_chain: benchT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: benchT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.bench || weightUnit,
          warmup_enabled: benchWarmupEnabled,
          warmup_sets: benchWarmupSets,
        },
        deadlift: {
          initial_weight_t1: toKg(deadliftT1W, 'deadlift'),
          initial_weight_t2: toKg(deadliftT2W, 'deadlift'),
          initial_weight: toKg(deadliftT1W, 'deadlift'),
          one_rm: toKgVal(deRM, 'deadlift'),
          increment_t1: toKg(deT1, 'deadlift'),
          increment_t2: toKg(deT2, 'deadlift'),
          t1_chain: deadliftT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: deadliftT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.deadlift || weightUnit,
          warmup_enabled: deadliftWarmupEnabled,
          warmup_sets: deadliftWarmupSets,
        },
        press: {
          initial_weight_t1: toKg(pressT1W, 'press'),
          initial_weight_t2: toKg(pressT2W, 'press'),
          initial_weight: toKg(pressT1W, 'press'),
          one_rm: toKgVal(prRM, 'press'),
          increment_t1: toKg(prT1, 'press'),
          increment_t2: toKg(prT2, 'press'),
          t1_chain: pressT1Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          t2_chain: pressT2Chain.map(s => ({ sets: s.sets, reps: s.reps, amrap: !!s.amrap })),
          unit: exerciseUnits.press || weightUnit,
          warmup_enabled: pressWarmupEnabled,
          warmup_sets: pressWarmupSets,
        },
        ...Object.fromEntries(t3Exercises.map(ex => {
          const unit = exerciseUnits[ex.name] || weightUnit;
          return [
            ex.name,
            {
              initial_weight: unit === 'lbs' ? toStorageWeight(ex.startWeightKg ?? 10, 'lbs') : (ex.startWeightKg ?? 10),
              increment_t3: unit === 'lbs' ? toStorageWeight(ex.incrementKg, 'lbs') : ex.incrementKg,
              target_reps: ex.targetReps,
              unit,
              progression_type: ex.progressionType || 'gzclp_default',
              min_reps: ex.minReps ?? 12,
              max_reps: ex.maxReps ?? 15,
              sets: ex.sets ?? 3,
              deload_mode: ex.deloadMode || 'sessions',
              deload_value: Number(ex.deloadValue) || 4,
              deload_frequency: ex.deloadMode === 'sessions' ? (Number(ex.deloadValue) || 4) : 0
            }
          ];
        }))
      };

      // 合并自定义 T2 超级组动作配置到 exerciseConfig 中
      for (const day of dayTemplate) {
        if (day.T2_superset?.enabled && day.T2_superset.exercise) {
          const ex = day.T2_superset.exercise;
          const unit = exerciseUnits[ex] || weightUnit;
          const w = parseFloat(customT2Weights[ex]) || (unit === 'lbs' ? 65 : 30);
          const s = parseFloat(customT2Steps[ex]) || (unit === 'lbs' ? 5 : 2.5);

          exerciseConfig[ex] = {
            ...exerciseConfig[ex],
            initial_weight_t2: unit === 'lbs' ? toStorageWeight(w, 'lbs') : w,
            increment_t2: unit === 'lbs' ? toStorageWeight(s, 'lbs') : s,
            unit,
            t2_chain: exerciseConfig[ex]?.t2_chain || DEFAULT_T2_CHAIN.map(sc => ({ sets: sc.sets, reps: sc.reps, amrap: !!sc.amrap }))
          };
        }
      }

      // 构建更新后的 day_map（包含用户选择的 T1/T2 搭配、T3 动作、热身和拉伸动作以及超级组配置）
      const updatedDayMap = {};
      for (const day of dayTemplate) {
        // 清理 T3 超级组中的无效动作
        const validT3List = (day.t3 || []).filter(name => name && name.trim());
        const cleanedT3Supersets = (day.T3_supersets || []).map(ss => ({
          ...ss,
          exercises: ss.exercises.filter(ex => validT3List.includes(ex))
        })).filter(ss => ss.exercises.length >= 2);

        updatedDayMap[day.label] = {
          ...program.config?.day_map?.[day.label],
          T1: day.T1 || null,
          T2: day.T2 || null,
          T3: validT3List,
          warmup: (day.warmup || []).filter(item => item.exercise && item.exercise.trim()),
          stretching: (day.stretching || []).filter(item => item.exercise && item.exercise.trim()),
          T2_superset: day.T2_superset || { enabled: false, exercise: '', rest_between: 45, rest_after: 90 },
          T3_supersets: cleanedT3Supersets
        };
      }

      const dayKeys = Object.keys(updatedDayMap);

      // 构建 schedule 对象
      const schedule = scheduleType === 'weekly'
        ? { scheduleType: 'weekly', training_days: trainingDays }
        : { scheduleType: 'custom-ratio', trainDays, restDays };

      // 运行期重测状态重置与自增
      const hasStarted = existingProgramState?.total_sessions > 0;
      let finalProgramState = {
        ...(existingProgramState || {
          current_day: dayKeys[0] || 'Day1',
          scheme_index: {},
          start_date: startDate,
          last_training_date: startDate
        }),
        global_deload: existingProgramState?.global_deload || {
          status: 'inactive',
          last_deload_completed_at: null,
          last_deload_session_count: 0,
          postponed_until: null,
          active_start_at: null,
          active_end_at: null,
          pending_next_session: false,
          transition_week_index: null
        }
      };

      if (hasStarted && finalProgramState.exercises) {
        const updatedExercises = JSON.parse(JSON.stringify(finalProgramState.exercises));
        const newWeights = {
          squat: { T1: squatT1Weight, T2: squatT2Weight },
          bench: { T1: benchT1Weight, T2: benchT2Weight },
          deadlift: { T1: deadliftT1Weight, T2: deadliftT2Weight },
          press: { T1: pressT1Weight, T2: pressT2Weight }
        };

        for (const lift of ['squat', 'bench', 'deadlift', 'press']) {
          const exState = updatedExercises[lift] || {};
          const isT1Retest = exState.T1?.status === 'needs_retest';
          const isT2Retest = exState.T2?.status === 'needs_retest';

          if (isT1Retest || isT2Retest) {
            if (exState.T1) {
              const newT1Weight = parseFloat(newWeights[lift].T1);
              exState.T1.status = 'active';
              exState.T1.scheme_index = 0;
              if (!isNaN(newT1Weight)) {
                exState.T1.weight = toKg(newT1Weight, lift);
              }
              exState.T1.major_cycle = (exState.T1.major_cycle || 0) + 1;
            }
            if (exState.T2) {
              const newT2Weight = parseFloat(newWeights[lift].T2);
              exState.T2.status = 'active';
              exState.T2.scheme_index = 0;
              if (!isNaN(newT2Weight)) {
                exState.T2.weight = toKg(newT2Weight, lift);
              }
              exState.T2.major_cycle = (exState.T2.major_cycle || 0) + 1;
            }
          }
          updatedExercises[lift] = exState;
        }
        finalProgramState.exercises = updatedExercises;
      }

      const upData = {
        is_active: true,
        ended_at: null, // 激活计划时确保结束时间清空
        program_state: finalProgramState,
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

  // ============== 从模板库导入热身/拉伸 ==============
  const handleImportTemplate = (template) => {
    if (!importerTarget) return;
    const { dayLabel, type } = importerTarget;
    
    const newExercises = (template.exercises || []).map(item => ({
      exercise: item.exercise,
      sets: item.sets || 2,
      reps: item.reps || 10,
      recording_method: item.recording_method || 'reps_only'
    }));

    const newTemplate = dayTemplate.map(d => {
      if (d.label === dayLabel) {
        return {
          ...d,
          [type]: [
            ...(d[type] || []).filter(ex => ex.exercise), // 过滤掉未填写的空行
            ...newExercises
          ]
        };
      }
      return d;
    });

    setDayTemplate(newTemplate);
    setTemplateImporterOpen(false);
  };

  // ============== 一键应用: 1RM → initial_weight ==============
  const applyOneRmToInitial = (lift) => {
    const oneRmMap = {
      squat: parseFloat(squatOneRm), bench: parseFloat(benchOneRm),
      deadlift: parseFloat(deadliftOneRm), press: parseFloat(pressOneRm),
    };
    const t1SetterMap = { squat: setSquatT1Weight, bench: setBenchT1Weight, deadlift: setDeadliftT1Weight, press: setPressT1Weight };
    const t2SetterMap = { squat: setSquatT2Weight, bench: setBenchT2Weight, deadlift: setDeadliftT2Weight, press: setPressT2Weight };
    const rm = oneRmMap[lift];
    if (!rm || rm <= 0) { setError(`请先填写 ${LIFT_CN_NAMES[lift]} 的有效 1RM`); return; }
    const t1 = deriveStartFromOneRm(rm, 0.85);
    const t2 = deriveStartFromOneRm(rm, 0.65);
    let roundedT1 = t1, roundedT2 = t2;
    const exUnit = exerciseUnits[lift] || weightUnit;
    if (gymEquipmentConfig) {
      const barWeight = gymEquipmentConfig[exUnit]?.barbell?.bar_weight ?? (exUnit === 'kg' ? 20 : 45);
      const enabledPlates = gymEquipmentConfig[exUnit]?.barbell?.enabled_plates || (exUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
      const plateLimits = gymEquipmentConfig[exUnit]?.barbell?.plate_limits || {};
      roundedT1 = roundToClosestLoadable(t1, barWeight, enabledPlates, plateLimits);
      roundedT2 = roundToClosestLoadable(t2, barWeight, enabledPlates, plateLimits);
    }
    t1SetterMap[lift](String(roundedT1));
    t2SetterMap[lift](String(roundedT2));
    setSuccessMsg(`${LIFT_CN_NAMES[lift]}: T1 起始 ${roundedT1}${exUnit} · T2 起始 ${roundedT2}${exUnit}`);
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
        const valStr = String(val);
        setter(valStr);
        const newStep = calculateDefaultIncrement(valStr, calcLift, exerciseUnits, weightUnit, gymEquipmentConfig);
        const t1Setter = calcLift === 'squat' ? setSquatT1Step
          : calcLift === 'bench' ? setBenchT1Step
          : calcLift === 'deadlift' ? setDeadliftT1Step
          : setPressT1Step;
        const t2Setter = calcLift === 'squat' ? setSquatT2Step
          : calcLift === 'bench' ? setBenchT2Step
          : calcLift === 'deadlift' ? setDeadliftT2Step
          : setPressT2Step;
        t1Setter(newStep);
        t2Setter(newStep);
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
                <Lightbulb size={14} className="inline shrink-0" /> 估算提示与建议
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
        <Lightbulb size={14} className="inline shrink-0" /> <b>GZCLP 配置向导（推荐配置流程）：</b><br />
        1️⃣ <b>第一步：</b> 统一设置重量单位（KG / LBS），也可按动作单独微调。<br />
        2️⃣ <b>第二步：</b> 搭配每个训练日的 T1/T2 主项。标准 GZCLP 采用四天轮转，T1 大重量低次数，T2 次极限容量组。<br />
        3️⃣ <b>第三步：</b> 填入您的各主项 1RM，系统将以此计算合理的起步重量。如果您不知道 1RM，可以直接跳到第四步。<br />
        4️⃣ <b>第四步：</b> 确认首训的起始重量。如果您在第三步中点击了一键应用，此处将自动填充。<br />
        5️⃣ <b>第五步：</b> 配置「全局减载周期」控制系统何时及如何进行计划减载。<br />
        6️⃣ <b>第六步：</b> 挑选并配置 T3 辅助动作，设定它们的起始重量和加重步长。<br />
        7️⃣ <b>第七步：</b> 为各训练日配置练前热身与练后拉伸动作。
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <ShieldAlert size={14} className="flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert-box !border-success dark:!border-success bg-green-500/10 dark:bg-green-500/5 !text-success dark:!text-success flex items-center gap-2 text-sm border-l-4">
          <Sparkles size={14} className="flex-shrink-0" /><span>{successMsg}</span>
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
              {weekdays.map(d => {
                const isSelected = trainingDays.includes(d.key);
                return (
                <button key={d.key} type="button"
                  className={`btn btn-sm flex-1 max-w-10 aspect-square min-h-0 min-w-0 p-0 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                    isSelected ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
                  }`}
                  onClick={() => setTrainingDays(prev => isSelected ? prev.filter(x => x !== d.key) : [...prev, d.key])}
                >{d.label}</button>
                );
              })}
            </div>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">每周 {trainingDays.length} 天训练</p>
            <p className="text-[10px] text-text-secondary/60 dark:text-text-secondary-dark/60 leading-relaxed"><Lightbulb size={12} className="inline shrink-0" /> 4个训练日配置（ABCD）按顺序轮转，与每周练几天无关。如每周5天则为 ABCDA，6天为 ABCDAB，以此类推。</p>
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

      {/* 第一步：单位设置 */}
      <div className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Scale size={16} className="text-primary" /><span>第一步：单位设置</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark shrink-0">全局单位</span>
          <div className="flex bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded-lg overflow-hidden">
            <button type="button"
              className={`px-4 py-1.5 text-sm font-bold transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => {
                if (weightUnit === 'kg') return;
                // 全局单位切换时，所有未单独设置单位的动作自动换算
                const converter = (v) => { const n = parseFloat(v); return isNaN(n) ? v : (n / 2.20462).toFixed(1); };
                ['squat', 'bench', 'deadlift', 'press'].forEach(lift => {
                  if (exerciseUnits[lift] && exerciseUnits[lift] !== weightUnit) return; // 已单独设置则不换算
                  const setters = lift === 'squat' ? [setSquatOneRm, setSquatT1Weight, setSquatT2Weight, setSquatT1Step, setSquatT2Step]
                    : lift === 'bench' ? [setBenchOneRm, setBenchT1Weight, setBenchT2Weight, setBenchT1Step, setBenchT2Step]
                    : lift === 'deadlift' ? [setDeadliftOneRm, setDeadliftT1Weight, setDeadliftT2Weight, setDeadliftT1Step, setDeadliftT2Step]
                    : [setPressOneRm, setPressT1Weight, setPressT2Weight, setPressT1Step, setPressT2Step];
                  setters.forEach(set => set(prev => converter(prev)));
                });
                setWeightUnit('kg');
              }}>KG</button>
            <button type="button"
              className={`px-4 py-1.5 text-sm font-bold transition-all cursor-pointer ${weightUnit === 'lbs' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => {
                if (weightUnit === 'lbs') return;
                const converter = (v) => { const n = parseFloat(v); return isNaN(n) ? v : (n * 2.20462).toFixed(1); };
                ['squat', 'bench', 'deadlift', 'press'].forEach(lift => {
                  if (exerciseUnits[lift] && exerciseUnits[lift] !== weightUnit) return;
                  const setters = lift === 'squat' ? [setSquatOneRm, setSquatT1Weight, setSquatT2Weight, setSquatT1Step, setSquatT2Step]
                    : lift === 'bench' ? [setBenchOneRm, setBenchT1Weight, setBenchT2Weight, setBenchT1Step, setBenchT2Step]
                    : lift === 'deadlift' ? [setDeadliftOneRm, setDeadliftT1Weight, setDeadliftT2Weight, setDeadliftT1Step, setDeadliftT2Step]
                    : [setPressOneRm, setPressT1Weight, setPressT2Weight, setPressT1Step, setPressT2Step];
                  setters.forEach(set => set(prev => converter(prev)));
                });
                setWeightUnit('lbs');
              }}>LBS</button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">按动作微调</span>
          <div className="grid grid-cols-2 gap-2">
            {['squat', 'bench', 'deadlift', 'press'].map(key => {
              const exUnit = exerciseUnits[key] || weightUnit;
              const toUnit = (v, from, to) => {
                if (!v || from === to) return v;
                const num = parseFloat(v);
                if (isNaN(num)) return v;
                return to === 'lbs'
                  ? (num * 2.20462).toFixed(1)
                  : (num / 2.20462).toFixed(1);
              };
              const switchUnit = (to) => {
                if (exUnit === to) return;
                const from = exUnit;
                // 转换该动作下所有涉及单位的数值
                if (key === 'squat') {
                  setSquatOneRm(prev => toUnit(prev, from, to));
                  setSquatT1Weight(prev => toUnit(prev, from, to));
                  setSquatT2Weight(prev => toUnit(prev, from, to));
                  setSquatT1Step(prev => toUnit(prev, from, to));
                  setSquatT2Step(prev => toUnit(prev, from, to));
                } else if (key === 'bench') {
                  setBenchOneRm(prev => toUnit(prev, from, to));
                  setBenchT1Weight(prev => toUnit(prev, from, to));
                  setBenchT2Weight(prev => toUnit(prev, from, to));
                  setBenchT1Step(prev => toUnit(prev, from, to));
                  setBenchT2Step(prev => toUnit(prev, from, to));
                } else if (key === 'deadlift') {
                  setDeadliftOneRm(prev => toUnit(prev, from, to));
                  setDeadliftT1Weight(prev => toUnit(prev, from, to));
                  setDeadliftT2Weight(prev => toUnit(prev, from, to));
                  setDeadliftT1Step(prev => toUnit(prev, from, to));
                  setDeadliftT2Step(prev => toUnit(prev, from, to));
                } else if (key === 'press') {
                  setPressOneRm(prev => toUnit(prev, from, to));
                  setPressT1Weight(prev => toUnit(prev, from, to));
                  setPressT2Weight(prev => toUnit(prev, from, to));
                  setPressT1Step(prev => toUnit(prev, from, to));
                  setPressT2Step(prev => toUnit(prev, from, to));
                }
                setExerciseUnits(prev => ({ ...prev, [key]: to }));
              };
              return (
                <div key={key} className="flex flex-col items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded-lg p-2">
                  <span className="text-xs font-bold text-text-secondary">{LIFT_CN_NAMES[key]}</span>
                  <div className="flex bg-bg-card dark:bg-bg-card-dark border border-border-card/50 rounded-md overflow-hidden">
                    <button type="button"
                      className={`px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${exUnit === 'kg' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
                      onClick={() => switchUnit('kg')}>KG</button>
                    <button type="button"
                      className={`px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${exUnit === 'lbs' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-main'}`}
                      onClick={() => switchUnit('lbs')}>LBS</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-text-secondary/60 leading-relaxed">
          <Lightbulb size={12} className="inline shrink-0" /> 全局单位影响所有主项的显示和计算。如需个别动作使用不同单位（如深蹲用 KG、卧推用 LBS），可在上方按动作微调。T3 辅助动作的单位请在第五步中单独设置。
        </p>
      </div>

      {/* 第二步：T1/T2 训练日搭配 */}
      {(() => {
        const MAIN_LIFTS = [
          { key: 'squat', label: '深蹲 (Squat)' },
          { key: 'bench', label: '卧推 (Bench)' },
          { key: 'deadlift', label: '硬拉 (Deadlift)' },
          { key: 'press', label: '推举 (Press)' },
        ];

        // 计算 T1/T2 分配校验
        const t1Used = dayTemplate.map(d => d.T1).filter(Boolean);
        const t2Used = dayTemplate.map(d => d.T2).filter(Boolean);
        const t1Conflicts = MAIN_LIFTS.filter(l => t1Used.filter(x => x === l.key).length > 1).map(l => l.key);
        const t2Conflicts = MAIN_LIFTS.filter(l => t2Used.filter(x => x === l.key).length > 1).map(l => l.key);
        const t1Missing = MAIN_LIFTS.filter(l => !t1Used.includes(l.key)).map(l => l.key);
        const t2Missing = MAIN_LIFTS.filter(l => !t2Used.includes(l.key)).map(l => l.key);
        const sameDayConflicts = dayTemplate.filter(d => d.T1 && d.T2 && d.T1 === d.T2).map(d => d.label);
        const supersetSameConflicts = dayTemplate.filter(d => d.T2_superset?.enabled && d.T2_superset.exercise && d.T2 === d.T2_superset.exercise).map(d => d.label);

        const hasViolations = t1Conflicts.length > 0 || t2Conflicts.length > 0 || sameDayConflicts.length > 0 || supersetSameConflicts.length > 0;

        const setDayT1 = (dayLabel, liftKey) => {
          setDayTemplate(prev => prev.map(d => d.label === dayLabel ? { ...d, T1: liftKey } : d));
        };
        const setDayT2 = (dayLabel, liftKey) => {
          setDayTemplate(prev => prev.map(d => d.label === dayLabel ? { ...d, T2: liftKey } : d));
        };

        const resetToDefault = () => {
          setDayTemplate(prev => {
            const defaults = [
              { label: 'Day1', T1: 'squat', T2: 'bench' },
              { label: 'Day2', T1: 'deadlift', T2: 'press' },
              { label: 'Day3', T1: 'bench', T2: 'squat' },
              { label: 'Day4', T1: 'press', T2: 'deadlift' },
            ];
            return prev.map((d, i) => {
              const def = defaults[i];
              return def ? { ...d, T1: def.T1, T2: def.T2 } : d;
            });
          });
        };

        return (
          <div className="card flex flex-col gap-4">
            <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
              <Shuffle size={16} className="text-primary" /><span>第二步：T1/T2 训练日搭配</span>
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 rounded-lg p-2.5">
              <Info size={14} className="text-primary shrink-0" /> <b>GZCLP 标准四天轮转：</b>每个主项分别作为 T1（大重量低次数）和 T2（次极限容量组）各出现一次。<br />
              您可以根据自身偏好调整搭配（例如改为 Upper/Lower 分法），只需确保每个主项在 T1 和 T2 中各出现一次即可。
            </p>

            {/* 校验错误提示 */}
            {hasViolations && (
              <div className="p-2.5 rounded-lg bg-bg-alert/10 dark:bg-bg-alert-dark/10 border border-alert/20 dark:border-alert-dark/20 flex flex-col gap-1 text-xs text-alert dark:text-alert-dark">
                {t1Conflicts.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>T1 重复：{t1Conflicts.map(k => MAIN_LIFTS.find(l => l.key === k)?.label || k).join('、')} 被分配了多次</span>
                  </div>
                )}
                {t1Missing.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>T1 缺失：{t1Missing.map(k => MAIN_LIFTS.find(l => l.key === k)?.label || k).join('、')} 未被分配到任何训练日</span>
                  </div>
                )}
                {t2Conflicts.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>T2 重复：{t2Conflicts.map(k => MAIN_LIFTS.find(l => l.key === k)?.label || k).join('、')} 被分配了多次</span>
                  </div>
                )}
                {t2Missing.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>T2 缺失：{t2Missing.map(k => MAIN_LIFTS.find(l => l.key === k)?.label || k).join('、')} 未被分配到任何训练日</span>
                  </div>
                )}
                {sameDayConflicts.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>同日冲突：{sameDayConflicts.join('、')} 的 T1 和 T2 选择了相同动作</span>
                  </div>
                )}
                {supersetSameConflicts.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>同日超级组冲突：{supersetSameConflicts.join('、')} 的 T2 主项与其绑定的超级组搭配动作相同</span>
                  </div>
                )}
              </div>
            )}

            {/* 每个训练日的 T1/T2 选择 */}
            <div className="flex flex-col gap-3">
              {dayTemplate.map((day) => {
                const daySameConflict = day.T1 && day.T2 && day.T1 === day.T2;
                return (
                  <div key={day.label} className={`p-3 rounded-xl border transition-colors ${
                    daySameConflict
                      ? 'bg-bg-alert/5 border-alert/30 dark:bg-bg-alert-dark/5 dark:border-alert-dark/30'
                      : 'bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card/50 dark:border-border-card-dark/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-black text-text-main dark:text-text-main-dark">{day.label}</span>
                      {daySameConflict && (
                        <span className="text-[10px] font-bold text-alert dark:text-alert-dark bg-alert/10 px-1.5 py-0.5 rounded">T1 ≠ T2</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* T1 选择器 */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-tier-t1 dark:text-tier-t1-dark uppercase tracking-wide">T1 · 大重量极限</label>
                        <select
                          className={`select-standard ${
                            day.T1 && t1Conflicts.includes(day.T1)
                              ? '!border-alert dark:!border-alert-dark !ring-1 !ring-alert/30'
                              : ''
                          }`}
                          value={day.T1 || ''}
                          onChange={(e) => setDayT1(day.label, e.target.value || null)}
                        >
                          <option value="">请选择 T1...</option>
                          {MAIN_LIFTS.map(l => (
                            <option key={l.key} value={l.key}>{l.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* T2 选择器 */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-tier-t2 dark:text-tier-t2-dark uppercase tracking-wide">T2 · 容量次极限</label>
                        <select
                          className={`select-standard ${
                            day.T2 && t2Conflicts.includes(day.T2)
                              ? '!border-alert dark:!border-alert-dark !ring-1 !ring-alert/30'
                              : ''
                          }`}
                          value={day.T2 || ''}
                          onChange={(e) => setDayT2(day.label, e.target.value || null)}
                        >
                          <option value="">请选择 T2...</option>
                          {MAIN_LIFTS.map(l => (
                            <option key={l.key} value={l.key}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {day.T2 && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 dark:border-border-card-dark/30 flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-text-main dark:text-text-main-dark cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-xs"
                            checked={day.T2_superset?.enabled || false}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setDayTemplate(prev => prev.map(d => d.label === day.label ? {
                                ...d,
                                T2_superset: {
                                  ...(d.T2_superset || { exercise: '', rest_between: 45, rest_after: 90 }),
                                  enabled
                                }
                              } : d));
                            }}
                          />
                          <span>🔗 开启 T2 超级组</span>
                        </label>

                        {day.T2_superset?.enabled && (
                          <div className="flex flex-col gap-2.5 pl-6 mt-1 border-l-2 border-primary/20">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">超级组搭配动作</label>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline border-border-card dark:border-border-card-dark text-left justify-start cursor-pointer h-9 bg-bg-card dark:bg-bg-card-dark text-xs"
                                onClick={() => {
                                  setSelectingTarget({ type: 'T2_superset', dayLabel: day.label, idx: 0 });
                                  setSelectorOpen(true);
                                }}
                              >
                                <span className={`truncate text-xs ${day.T2_superset?.exercise ? 'text-text-main dark:text-text-main-dark font-semibold' : 'text-text-secondary italic'}`}>
                                  {getCNName(day.T2_superset?.exercise, exerciseNameMap) || '点击选择动作...'}
                                </span>
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-secondary">动作间休息 (秒)</label>
                                <input
                                  type="number"
                                  className="input input-bordered input-xs h-8 bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark text-xs rounded-lg font-bold"
                                  min="0"
                                  placeholder="45"
                                  value={day.T2_superset?.rest_between ?? 45}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setDayTemplate(prev => prev.map(d => d.label === day.label ? {
                                      ...d,
                                      T2_superset: { ...d.T2_superset, rest_between: val }
                                    } : d));
                                  }}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-secondary">整组后休息 (秒)</label>
                                <input
                                  type="number"
                                  className="input input-bordered input-xs h-8 bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark text-xs rounded-lg font-bold"
                                  min="0"
                                  placeholder="90"
                                  value={day.T2_superset?.rest_after ?? 90}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setDayTemplate(prev => prev.map(d => d.label === day.label ? {
                                      ...d,
                                      T2_superset: { ...d.T2_superset, rest_after: val }
                                    } : d));
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 重置按钮 */}
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-aux flex items-center gap-1"
                onClick={resetToDefault}
                title="恢复 GZCLP 标准四天搭配"
              >
                <RotateCcw size={12} /><span>恢复 GZCLP 默认搭配</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 第三步：各主项 1RM 与进阶参数 */}
      {(() => {
        const hasStarted = existingProgramState?.total_sessions > 0;
        return (
          <div className="card">
            <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
              <Zap size={16} className="text-primary" />
              <span>
                第三步：{hasStarted ? '力量监控与 1RM 重测 (计划进行中)' : '设置各主项 1RM 与进阶参数（推荐）'}
              </span>
            </h3>
            {hasStarted ? (
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                <Info size={14} className="text-primary shrink-0" /> <b>运行期提示：</b> 您的训练已正式开始，目前系统以您实际打卡的进阶重量为基准。<br />
                平时无需点击“应用”以防覆盖当前的进阶负荷。当某个动作挑战 10×1 失败需重测时，系统将在此激活重测应用按钮，帮您推算下一轮起始负荷。
              </p>
            ) : (
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                <Info size={14} className="text-primary shrink-0" /> <b>最佳实践：</b>请在此输入您的 1RM（单次最大重量），然后点击下方的<b>「一键应用 1RM → 起始重量」</b>按钮。系统将自动按 <b>85%</b> 的安全比例计算 T1 首训起始重量并同步到下方的「第四步」，同时 T2 按 <b>65%</b> 比例计算。<br />
                <AlertTriangle size={14} className="inline shrink-0" /> <i>如果您不知道 1RM，可以直接跳过此步，直接到「第四步」手动填入起始重量。</i>
              </p>
            )}

            <div className="flex flex-col gap-3">
              {(() => {
                const lifts = [
                  { key: 'squat',    label: '深蹲 (Squat)',    oneRm: squatOneRm,    setOneRm: setSquatOneRm,    t1Step: squatT1Step, setT1: setSquatT1Step,    t2Step: squatT2Step, setT2: setSquatT2Step,    t1Chain: squatT1Chain, setT1Chain: setSquatT1Chain, t2Chain: squatT2Chain, setT2Chain: setSquatT2Chain, warmupEnabled: squatWarmupEnabled, setWarmupEnabled: setSquatWarmupEnabled, warmupSets: squatWarmupSets, setWarmupSets: setSquatWarmupSets },
                  { key: 'bench',    label: '卧推 (Bench)',    oneRm: benchOneRm,    setOneRm: setBenchOneRm,    t1Step: benchT1Step, setT1: setBenchT1Step,    t2Step: benchT2Step, setT2: setBenchT2Step,    t1Chain: benchT1Chain, setT1Chain: setBenchT1Chain, t2Chain: benchT2Chain, setT2Chain: setBenchT2Chain, warmupEnabled: benchWarmupEnabled, setWarmupEnabled: setBenchWarmupEnabled, warmupSets: benchWarmupSets, setWarmupSets: setBenchWarmupSets },
                  { key: 'deadlift', label: '硬拉 (Deadlift)', oneRm: deadliftOneRm, setOneRm: setDeadliftOneRm, t1Step: deadliftT1Step, setT1: setDeadliftT1Step, t2Step: deadliftT2Step, setT2: setDeadliftT2Step, t1Chain: deadliftT1Chain, setT1Chain: setDeadliftT1Chain, t2Chain: deadliftT2Chain, setT2Chain: setDeadliftT2Chain, warmupEnabled: deadliftWarmupEnabled, setWarmupEnabled: setDeadliftWarmupEnabled, warmupSets: deadliftWarmupSets, setWarmupSets: setDeadliftWarmupSets },
                  { key: 'press',    label: '推举 (Press)',    oneRm: pressOneRm,    setOneRm: setPressOneRm,    t1Step: pressT1Step, setT1: setPressT1Step,    t2Step: pressT2Step, setT2: setPressT2Step,    t1Chain: pressT1Chain, setT1Chain: setPressT1Chain, t2Chain: pressT2Chain, setT2Chain: setPressT2Chain, warmupEnabled: pressWarmupEnabled, setWarmupEnabled: setPressWarmupEnabled, warmupSets: pressWarmupSets, setWarmupSets: setPressWarmupSets },
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

                  // 运行期状态解析
                  const exState = existingProgramState?.exercises?.[L.key] || {};
                  const currentT1Weight = exState.T1?.weight;
                  const currentT2Weight = exState.T2?.weight;
                  const isT1Retest = exState.T1?.status === 'needs_retest';
                  const isT2Retest = exState.T2?.status === 'needs_retest';
                  const isRetest = isT1Retest || isT2Retest;

                  const cardBorderClass = hasStarted && isRetest 
                    ? 'border-2 border-orange-500 bg-orange-500/5 dark:bg-orange-500/10' 
                    : 'border-border-card/50 dark:border-border-card-dark/50';

                  return (
                    <div key={L.key} className={`p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border flex flex-col gap-3 ${cardBorderClass}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                          {L.label}
                          {hasStarted && isRetest && (
                            <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded animate-pulse">⚠️ 待重测</span>
                          )}
                        </span>
                        {cloudOneRm && (
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono">
                            云端 1RM: {cloudOneRm.e1rm_kg}kg
                          </span>
                        )}
                      </div>

                      {/* 当前实际进阶负负荷展示 */}
                      {hasStarted && (
                        <div className="flex items-center justify-between text-[11px] bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 rounded-lg p-2 font-semibold select-none">
                          <span className="text-text-secondary">当前执行负荷:</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-tier-t1">T1: {currentT1Weight ?? '--'}{exUnit}</span>
                            <span className="opacity-30">|</span>
                            <span className="text-tier-t2">T2: {currentT2Weight ?? '--'}{exUnit}</span>
                          </div>
                        </div>
                      )}

                      {/* 应用按钮按状态分发 */}
                      {hasStarted ? (
                        isRetest ? (
                          <button
                            type="button"
                            onClick={() => applyOneRmToInitial(L.key)}
                            className="btn w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold flex items-center justify-center gap-1.5 animate-pulse rounded-xl h-11 border-none cursor-pointer text-xs md:text-sm"
                            title="点击应用新 1RM，计算该动作下一轮的起始重量"
                          >
                            <Sparkles size={14} />极限重测：应用新 1RM 推算下轮起始负荷
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="btn w-full bg-base-300 dark:bg-neutral-800 text-text-secondary/50 font-bold flex items-center justify-center gap-1.5 rounded-xl h-11 border-none opacity-60 cursor-not-allowed text-xs md:text-sm"
                            title="目前动作进阶正常，无需应用 1RM"
                          >
                            计划进行中（负荷自动进阶中）
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => applyOneRmToInitial(L.key)}
                          className="btn-main w-full text-xs md:text-sm"
                          title={`用 1RM × 0.85 自动填入起始重量`}
                        >
                          <Sparkles size={14} />一键应用 1RM → 起始重量
                        </button>
                      )}

                      {/* 1RM 输入 + T1/T2 加重 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between h-6">
                            <label className="section-subtitle select-none mb-0">1RM</label>
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
                              onChange={(e) => {
                                const val = e.target.value;
                                L.setOneRm(val);
                                const newStep = calculateDefaultIncrement(val, L.key, exerciseUnits, weightUnit, gymEquipmentConfig);
                                L.setT1(newStep);
                                L.setT2(newStep);
                              }}
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
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-start gap-1.5">
                            <Lightbulb size={14} className="text-primary shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                              <div>
                                1RM 推导：T1 起始 <span className="font-bold text-primary">{t1Start}{exUnit}</span>
                                <span className="mx-1 opacity-50">·</span>
                                T2 起始 <span className="font-bold text-primary">{t2Start}{exUnit}</span>
                              </div>
                              <div className="text-[10px] text-text-secondary/70">
                                加重提示：T1/T2 初始加重默认为该动作 1RM 的 5% 并根据杠铃片就近取值
                              </div>
                            </div>
                          </div>
                        </div>
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
                        <WarmupSetsEditor
                          enabled={L.warmupEnabled}
                          onEnabledChange={L.setWarmupEnabled}
                          sets={L.warmupSets}
                          onSetsChange={L.setWarmupSets}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        );
      })()}

      {/* 第四步：首训起始重量（T1/T2 分开） */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Scale size={16} className="text-primary" /><span>第四步：确认或手动设置「首训起始重量」</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-4 leading-relaxed bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 rounded-lg p-2.5">
          <Info size={14} className="text-primary shrink-0" /> <b>GZCLP 区分 T1 与 T2：</b>T1 使用较重的负重、低次数（如 5×3）；T2 使用较轻的负重、高次数（如 3×10）。<br />
          1. <b>如果您已完成第三步：</b>点击上方的「一键应用」后，T1（85%×1RM）和 T2（65%×1RM）已被自动填充。<br />
          2. <b>如果您跳过了第三步：</b>请手动填入首次训练时 T1 和 T2 各自的起始负重。
        </p>

        <div className="flex flex-col gap-4">
          {[
            { key: 'squat', label: '深蹲 (Squat)', t1w: squatT1Weight, t2w: squatT2Weight, setT1: setSquatT1Weight, setT2: setSquatT2Weight },
            { key: 'bench', label: '卧推 (Bench)', t1w: benchT1Weight, t2w: benchT2Weight, setT1: setBenchT1Weight, setT2: setBenchT2Weight },
            { key: 'deadlift', label: '硬拉 (Deadlift)', t1w: deadliftT1Weight, t2w: deadliftT2Weight, setT1: setDeadliftT1Weight, setT2: setDeadliftT2Weight },
            { key: 'press', label: '推举 (Press)', t1w: pressT1Weight, t2w: pressT2Weight, setT1: setPressT1Weight, setT2: setPressT2Weight },
          ].map(({ key, label, t1w, t2w, setT1, setT2 }) => {
            const exUnit = exerciseUnits[key] || weightUnit;
            return (
              <div key={key} className="p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-text-main dark:text-text-main-dark">{label}</span>
                  <span className="text-[10px] text-text-secondary font-mono">{exUnit}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-tier-t1 uppercase">T1 起始重量</label>
                    <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-10 transition-colors">
                      <input type="number" step="0.5" className={inputClass} value={t1w} onChange={(e) => setT1(e.target.value)} placeholder="如 60" />
                      <span className="text-xs text-text-secondary/50 select-none">{exUnit}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-tier-t2 uppercase">T2 起始重量</label>
                    <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-10 transition-colors">
                      <input type="number" step="0.5" className={inputClass} value={t2w} onChange={(e) => setT2(e.target.value)} placeholder="如 45" />
                      <span className="text-xs text-text-secondary/50 select-none">{exUnit}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* T2 超级组动作配置 */}
          {(() => {
            const activeSupersetExercises = [];
            const seen = new Set();
            dayTemplate.forEach(day => {
              if (day.T2_superset?.enabled && day.T2_superset.exercise) {
                const exName = day.T2_superset.exercise.trim();
                if (exName && !seen.has(exName)) {
                  seen.add(exName);
                  activeSupersetExercises.push(exName);
                }
              }
            });

            if (activeSupersetExercises.length === 0) return null;

            return (
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border-card/30 dark:border-border-card-dark/30">
                <h4 className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark flex items-center gap-1.5 select-none">
                  <Link size={14} className="text-primary animate-pulse" />
                  <span>🔗 T2 超级组动作起始配置</span>
                </h4>
                {activeSupersetExercises.map(exName => {
                  const exUnit = exerciseUnits[exName] || weightUnit;
                  const weight = customT2Weights[exName] ?? (exUnit === 'lbs' ? '65' : '30');
                  const step = customT2Steps[exName] ?? (exUnit === 'lbs' ? '5' : '2.5');

                  return (
                    <div key={exName} className="p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs">T2</span>
                          <span className="text-sm font-bold text-text-main dark:text-text-main-dark">{getCNName(exName, exerciseNameMap)}</span>
                        </div>
                        <span className="text-[10px] text-text-secondary font-mono">{exUnit}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-text-secondary uppercase">T2 起始重量</label>
                          <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-10 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              className={inputClass}
                              value={weight}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomT2Weights(prev => ({ ...prev, [exName]: val }));
                              }}
                              placeholder="如 30"
                            />
                            <span className="text-xs text-text-secondary/50 select-none">{exUnit}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-text-secondary uppercase">T2 递增步长</label>
                          <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-10 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              className={inputClass}
                              value={step}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomT2Steps(prev => ({ ...prev, [exName]: val }));
                              }}
                              placeholder="如 2.5"
                            />
                            <span className="text-xs text-text-secondary/50 select-none">{exUnit}</span>
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
      </div>

      {/* 第五步：全局计划减载周期配置 */}
      <div className="card flex flex-col gap-4">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <RotateCcw size={16} className="text-primary" /><span>第五步：全局计划减载（Deload）周期配置</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
          适当的减载能够清除神经疲劳、恢复关节损伤，是长期进步的关键。系统将自动或者按您的设置定时下发降低强度的恢复性训练。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 触发方式 */}
          <div className="flex flex-col gap-1.5">
            <label className="section-subtitle select-none">减载触发方式</label>
            <select
              className="select-standard"
              value={deloadTriggerType}
              onChange={(e) => setDeloadTriggerType(e.target.value)}
            >
              <option value="none">不减载</option>
              <option value="manual_only">仅手动减载</option>
              <option value="weeks">按周自动减载</option>
              <option value="sessions">按打卡次数自动减载</option>
            </select>
          </div>

          {/* 自动阈值数值输入 (当选择按周或按次时) */}
          {(deloadTriggerType === 'weeks' || deloadTriggerType === 'sessions') && (
            <div className="flex flex-col gap-1.5">
              <label className="section-subtitle select-none">
                {deloadTriggerType === 'weeks' ? '触发周期 (周)' : '触发周期 (次训练)'}
              </label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right"
                  value={deloadTriggerValue}
                  onChange={(e) => setDeloadTriggerValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <span className="text-xs text-text-secondary/50 select-none ml-1">
                  {deloadTriggerType === 'weeks' ? '周' : '次'}
                </span>
              </div>
            </div>
          )}

          {/* 减载时长 */}
          <div className="flex flex-col gap-1.5">
            <label className="section-subtitle select-none">减载持续时长</label>
            <select
              className="select-standard"
              value={deloadDuration}
              onChange={(e) => setDeloadDuration(e.target.value)}
            >
              <option value="4days">4 天</option>
              <option value="1week">1 周</option>
              <option value="2weeks">2 周</option>
            </select>
          </div>

          {/* 强度降重 */}
          <div className="flex flex-col gap-1.5">
            <label className="section-subtitle select-none">强度降低幅度 (重量削减 %)</label>
            <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right"
                value={deloadIntensityPct}
                onChange={(e) => setDeloadIntensityPct(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
              />
              <span className="text-xs text-text-secondary/50 select-none ml-1">%</span>
            </div>
            <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-normal">
              减量期间所有重量将降低至原计划的 {100 - deloadIntensityPct}%
            </span>
          </div>

          {/* 容量削减 */}
          <div className="flex flex-col gap-1.5">
            <label className="section-subtitle select-none">容量削减方案</label>
            <select
              className="select-standard"
              value={deloadVolumeType}
              onChange={(e) => setDeloadVolumeType(e.target.value)}
            >
              <option value="none">容量不变 (只降重)</option>
              <option value="subtract_sets">方案 A：固定减少组数</option>
              <option value="scale_sets_pct">方案 B：百分比减少组数</option>
              <option value="scale_reps_pct">方案 C：组数不变次数砍半</option>
            </select>
          </div>

          {/* 容量扣除设定值 (方案A和方案B显示) */}
          {(deloadVolumeType === 'subtract_sets' || deloadVolumeType === 'scale_sets_pct') && (
            <div className="flex flex-col gap-1.5">
              <label className="section-subtitle select-none">
                {deloadVolumeType === 'subtract_sets' ? '扣减组数 (组)' : '保留比例 (%)'}
              </label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-11 transition-colors">
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right"
                  value={deloadVolumeValue}
                  onChange={(e) => setDeloadVolumeValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <span className="text-xs text-text-secondary/50 select-none ml-1">
                  {deloadVolumeType === 'subtract_sets' ? '组' : '%'}
                </span>
              </div>
            </div>
          )}

          {/* 过渡策略 */}
          <div className="flex flex-col gap-1.5">
            <label className="section-subtitle select-none">结束后回归策略</label>
            <select
              className="select-standard"
              value={deloadTransitionPolicy}
              onChange={(e) => setDeloadTransitionPolicy(e.target.value)}
            >
              <option value="direct_return">策略一：直接回归原有进度 (100%)</option>
              <option value="step_up">策略二：梯度式恢复 (第一周 90%，第二周恢复)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 第六步：T3 辅助动作配置 */}
      <div className="card flex flex-col gap-4">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Dumbbell size={16} className="text-primary" /><span>第六步：T3 辅助动作配置</span>
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
                   const displayName = getCNName(exName, exerciseNameMap);
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

               {/* T3 超级组设置 */}
               {(() => {
                 const validT3List = (day.t3 || []).filter(name => name && name.trim());
                 if (validT3List.length < 2) return null;

                 const cleanSupersets = (day.T3_supersets || []).map(ss => ({
                   ...ss,
                   exercises: ss.exercises.filter(ex => validT3List.includes(ex))
                 })).filter(ss => ss.exercises.length >= 2);

                 const exercisesInSupersets = new Set();
                 cleanSupersets.forEach(ss => ss.exercises.forEach(ex => exercisesInSupersets.add(ex)));

                 const freeExercises = validT3List.filter(ex => !exercisesInSupersets.has(ex));

                 return (
                   <div className="mt-3 pt-3 border-t border-border-card/30 dark:border-border-card-dark/30 flex flex-col gap-2">
                     <span className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark flex items-center gap-1">
                       <Link size={12} className="text-primary" />
                       <span>🔗 T3 超级组配置</span>
                     </span>

                     {cleanSupersets.map((ss, ssIdx) => (
                       <div key={ssIdx} className="p-2 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-primary">
                             超级组 {ssIdx + 1}: {ss.exercises.map(ex => getCNName(ex, exerciseNameMap)).join(' + ')}
                           </span>
                           <button
                             type="button"
                             className="text-[10px] text-error hover:underline cursor-pointer font-bold"
                             onClick={() => {
                               const newTemplate = [...dayTemplate];
                               const updatedSS = [...cleanSupersets];
                               updatedSS.splice(ssIdx, 1);
                               newTemplate[dayIdx] = {
                                 ...day,
                                 T3_supersets: updatedSS
                               };
                               setDayTemplate(newTemplate);
                             }}
                           >
                             解除
                           </button>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2">
                           <div className="flex flex-col gap-1">
                             <label className="text-[9px] font-bold text-text-secondary">动作间休息 (秒)</label>
                             <input
                               type="number"
                               className="input input-bordered input-xs h-7 bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark text-xs rounded-lg font-bold"
                               min="0"
                               placeholder="30"
                               value={ss.rest_between ?? 30}
                               onChange={(e) => {
                                 const val = parseInt(e.target.value) || 0;
                                 const newTemplate = [...dayTemplate];
                                 const updatedSS = [...cleanSupersets];
                                 updatedSS[ssIdx] = { ...updatedSS[ssIdx], rest_between: val };
                                 newTemplate[dayIdx] = { ...day, T3_supersets: updatedSS };
                                 setDayTemplate(newTemplate);
                               }}
                             />
                           </div>
                           <div className="flex flex-col gap-1">
                             <label className="text-[9px] font-bold text-text-secondary">整组后休息 (秒)</label>
                             <input
                               type="number"
                               className="input input-bordered input-xs h-7 bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark text-xs rounded-lg font-bold"
                               min="0"
                               placeholder="90"
                               value={ss.rest_after ?? 90}
                               onChange={(e) => {
                                 const val = parseInt(e.target.value) || 0;
                                 const newTemplate = [...dayTemplate];
                                 const updatedSS = [...cleanSupersets];
                                 updatedSS[ssIdx] = { ...updatedSS[ssIdx], rest_after: val };
                                 newTemplate[dayIdx] = { ...day, T3_supersets: updatedSS };
                                 setDayTemplate(newTemplate);
                               }}
                             />
                           </div>
                         </div>
                       </div>
                     ))}

                     {freeExercises.length >= 2 && (
                       <div className="p-2 rounded-lg bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/30 dark:border-border-card-dark/30 flex flex-col gap-2">
                         <span className="text-[10px] font-bold text-text-secondary">组合空闲动作组成新超级组：</span>
                         <div className="flex flex-wrap gap-2">
                           {freeExercises.map(ex => {
                             const isChecked = (t3SupersetCreator[day.label] || []).includes(ex);
                             return (
                               <label key={ex} className="flex items-center gap-1 text-[11px] text-text-main dark:text-text-main-dark cursor-pointer select-none bg-bg-card dark:bg-bg-card-dark px-2 py-1 rounded border border-border-card/50">
                                 <input
                                   type="checkbox"
                                   className="checkbox checkbox-primary checkbox-xs scale-90"
                                   checked={isChecked}
                                   onChange={(e) => {
                                     const checked = e.target.checked;
                                     setT3SupersetCreator(prev => {
                                       const daySelected = prev[day.label] || [];
                                       const nextSelected = checked
                                         ? [...daySelected, ex]
                                         : daySelected.filter(x => x !== ex);
                                       return { ...prev, [day.label]: nextSelected };
                                     });
                                   }}
                                 />
                                 <span>{getCNName(ex, exerciseNameMap)}</span>
                               </label>
                             );
                           })}
                         </div>
                         
                         <button
                           type="button"
                           className="btn btn-xs btn-primary font-bold self-end h-6 min-h-0 text-[10px] rounded-lg mt-1"
                           disabled={(t3SupersetCreator[day.label] || []).length < 2}
                           onClick={() => {
                             const selected = t3SupersetCreator[day.label] || [];
                             if (selected.length < 2) return;
                             const newTemplate = [...dayTemplate];
                             const updatedSS = [...cleanSupersets, {
                               exercises: selected,
                               rest_between: 30,
                               rest_after: 90
                             }];
                             newTemplate[dayIdx] = {
                               ...day,
                               T3_supersets: updatedSS
                             };
                             setDayTemplate(newTemplate);
                             setT3SupersetCreator(prev => ({ ...prev, [day.label]: [] }));
                           }}
                         >
                           + 生成超级组
                         </button>
                       </div>
                     )}
                   </div>
                 );
               })()}
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
                       <span className="text-sm font-bold text-text-main dark:text-text-main-dark">{getCNName(ex.name, exerciseNameMap)}</span>
                     </div>
                     {(() => {
                       const recMethod = exerciseNameMap[ex.name]?.recording_method || 'standard';
                       const isNonStandard = recMethod === 'duration_only' || recMethod === 'distance_only';
                       if (isNonStandard) return null;
                       return (
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
                       );
                     })()}
                  </div>

                  {/* 进阶逻辑模式下拉框 */}
                  <div className="flex flex-col gap-1 mt-0.5">
                    <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark select-none">进阶逻辑模式</label>
                    <select
                      className="select select-bordered select-xs bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark h-8 min-h-0 text-xs rounded-lg font-bold w-full"
                      value={ex.progressionType || 'gzclp_default'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newT3 = [...t3Exercises];
                        newT3[exIdx] = { ...newT3[exIdx], progressionType: val };
                        setT3Exercises(newT3);
                      }}
                    >
                      <option value="gzclp_default">GZCLP 默认 (AMRAP 末组达标)</option>
                      <option value="double_progression">双进阶 (次数与重量交替进阶)</option>
                    </select>
                  </div>

                  {(() => {
                    const recMethod = exerciseNameMap[ex.name]?.recording_method || 'standard';
                    const isDoubleProg = ex.progressionType === 'double_progression';

                    if (isDoubleProg) {
                      let startLabel = '起始重量';
                      let incrLabel = '加重步长';
                      let rangeLabel = '次数区间';
                      let unitLabel = exUnit;
                      let rangeUnitLabel = '次';
                      let stepVal = '0.5';
                      let minVal = '0';

                      if (recMethod === 'duration_only') {
                        startLabel = '起始时长';
                        incrLabel = '增量';
                        rangeLabel = '时长区间';
                        unitLabel = '秒';
                        rangeUnitLabel = '秒';
                        stepVal = '5';
                        minVal = '5';
                      } else if (recMethod === 'distance_only') {
                        startLabel = '起始距离';
                        incrLabel = '增量';
                        rangeLabel = '距离区间';
                        unitLabel = '米';
                        rangeUnitLabel = '米';
                        stepVal = '10';
                        minVal = '10';
                      }

                      return (
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="grid grid-cols-3 gap-2">
                            {/* 起始值 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">{startLabel}</label>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                                <input type="number" step={stepVal} min={minVal}
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={recMethod === 'standard' && exUnit === 'lbs' ? convertWeight(ex.startWeightKg ?? 10, 'lbs') : (ex.startWeightKg ?? 10)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const kgVal = recMethod === 'standard' && exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], startWeightKg: kgVal };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{unitLabel}</span>
                              </div>
                            </div>
                            {/* 步长 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">{incrLabel}</label>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                                <input type="number" step={stepVal} min="0.5"
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={recMethod === 'standard' && exUnit === 'lbs' ? convertWeight(ex.incrementKg, 'lbs') : ex.incrementKg}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0.5;
                                    const kgVal = recMethod === 'standard' && exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], incrementKg: kgVal };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{unitLabel}</span>
                              </div>
                            </div>
                            {/* 计划组数 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">计划组数</label>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                                <input type="number" step="1" min="1" max="10"
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={ex.sets ?? 3}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 3;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], sets: val };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">组</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {/* 区间下限 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">区间下限</label>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                                <input type="number" step="1" min="1"
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={ex.minReps ?? 12}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], minReps: val };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{rangeUnitLabel}</span>
                              </div>
                            </div>
                            {/* 区间上限 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">区间上限</label>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                                <input type="number" step="1" min="1"
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={ex.maxReps ?? 15}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], maxReps: val };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{rangeUnitLabel}</span>
                              </div>
                            </div>
                            {/* 减载模式 */}
                            <div className="flex flex-col gap-1">
                              <label className="section-subtitle select-none">减载模式</label>
                              <select
                                className="select select-bordered select-xs bg-bg-card dark:bg-bg-card-dark border-border-card text-text-main dark:text-text-main-dark h-8 min-h-0 text-[10px] rounded-lg font-bold w-full"
                                value={ex.deloadMode ?? 'sessions'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], deloadMode: val };
                                  setT3Exercises(newT3);
                                }}
                              >
                                <option value="none">不减载</option>
                                <option value="sessions">几次后减</option>
                                <option value="weeks">几周后减</option>
                                <option value="follow_program">跟随计划</option>
                              </select>
                            </div>
                          </div>

                          {(ex.deloadMode === 'sessions' || ex.deloadMode === 'weeks') && (
                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                              <span className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark select-none">
                                {ex.deloadMode === 'sessions' ? '每完成' : '每经过'}
                              </span>
                              <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8 w-18">
                                <input type="number" step="1" min="1"
                                  className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                  value={ex.deloadValue ?? 4}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    const newT3 = [...t3Exercises];
                                    newT3[exIdx] = { ...newT3[exIdx], deloadValue: val };
                                    setT3Exercises(newT3);
                                  }}
                                />
                                <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50 ml-0.5 font-bold">
                                  {ex.deloadMode === 'sessions' ? '次' : '周'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark select-none">
                                训练后减载一次
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (recMethod === 'duration_only') {
                      // 仅时长动作：显示秒数配置
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">起始时长</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="5" min="5"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.startWeightKg ?? 30}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 5;
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], startWeightKg: val };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">秒</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">增量</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="1" min="1"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.incrementKg ?? 5}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1;
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], incrementKg: val };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">秒</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">达标门槛</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="5" min="5"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.targetReps ?? 25}
                                onChange={(e) => {
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], targetReps: parseInt(e.target.value) || 5 };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">秒</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (recMethod === 'distance_only') {
                      // 仅距离动作：显示米数配置
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">起始距离</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="10" min="10"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.startWeightKg ?? 100}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 10;
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], startWeightKg: val };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">米</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">增量</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="10" min="5"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.incrementKg ?? 10}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 10;
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], incrementKg: val };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">米</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="section-subtitle select-none">达标门槛</label>
                            <div className="input input-bordered input-sm flex items-center gap-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-8">
                              <input type="number" step="10" min="10"
                                className="w-full bg-transparent font-mono font-semibold text-xs text-text-main dark:text-text-main-dark focus:outline-none text-right"
                                value={ex.targetReps ?? 100}
                                onChange={(e) => {
                                  const newT3 = [...t3Exercises];
                                  newT3[exIdx] = { ...newT3[exIdx], targetReps: parseInt(e.target.value) || 10 };
                                  setT3Exercises(newT3);
                                }}
                              />
                              <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">米</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 默认：力量训练动作，保持原有重量/次数配置
                    return (
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
                            <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{exUnit}</span>
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
                            <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">{exUnit}</span>
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
                            <span className="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">次</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        );
        })()}
      </div>

      {/* 4. 练前热身与练后拉伸 */}
      <div className="card flex flex-col gap-4">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Sparkles size={16} className="text-primary" /><span>第七步：练前热身与练后拉伸</span>
        </h3>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
          合理的练前热身与练后拉伸可以显著改善关节活动度、提高训练表现并加速恢复。您可以为每个训练日独立配置动作，或直接从模板库导入常用组合。
        </p>

        <div className="flex flex-col gap-4">
          {dayTemplate.map((day, dayIdx) => (
            <div key={day.label} className="flex flex-col gap-3 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
              <div className="flex items-center justify-between border-b border-border-card/30 pb-1.5">
                <span className="text-sm font-black text-text-main dark:text-text-main-dark">{day.label} 动作流</span>
              </div>

              {/* 练前热身 (Warmup) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-tier-t1 flex items-center gap-1"><Zap size={12} /> 练前热身</span>
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline font-bold bg-transparent border-0 cursor-pointer"
                    onClick={() => {
                      setImporterTarget({ dayLabel: day.label, type: 'warmup' });
                      setTemplateImporterOpen(true);
                    }}
                  >
                    从模板导入
                  </button>
                </div>
                
                <div className="flex flex-col gap-2">
                  {(day.warmup || []).map((item, idx) => {
                    const displayName = getCNName(item.exercise, exerciseNameMap);
                    const suffix = item.recording_method === 'duration_only' ? '秒' : '次';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 bg-bg-card dark:bg-bg-card-dark p-1.5 rounded-lg border border-border-card/40 dark:border-border-card-dark/40">
                        {/* 动作选择按钮 */}
                        <button
                          type="button"
                          className="flex-1 text-left justify-start cursor-pointer truncate text-xs font-bold bg-transparent border-0 text-text-main dark:text-text-main-dark"
                          onClick={() => {
                            setSelectingTarget({ dayLabel: day.label, idx, type: 'warmup' });
                            setSelectorShowAll(false);
                            setSelectorOpen(true);
                          }}
                        >
                          <span className={item.exercise ? 'text-text-main dark:text-text-main-dark' : 'text-text-secondary/70 italic font-normal'}>
                            {displayName || '点击选择动作...'}
                          </span>
                        </button>
                        
                        {/* 组数输入 */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={item.sets || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newTemplate = [...dayTemplate];
                              newTemplate[dayIdx].warmup[idx].sets = val === '' ? 0 : Math.max(1, parseInt(val, 10) || 1);
                              setDayTemplate(newTemplate);
                            }}
                            className="h-7 w-8 rounded border border-border-card bg-bg-main/20 text-center text-xs font-semibold font-mono text-text-main dark:text-text-main-dark"
                          />
                          <span className="text-[10px] text-text-secondary">组</span>
                        </div>

                        {/* 次数/秒数输入 */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="600"
                            value={item.reps || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newTemplate = [...dayTemplate];
                              newTemplate[dayIdx].warmup[idx].reps = val === '' ? 0 : Math.max(1, parseInt(val, 10) || 1);
                              setDayTemplate(newTemplate);
                            }}
                            className="h-7 w-10 rounded border border-border-card bg-bg-main/20 text-center text-xs font-semibold font-mono text-text-main dark:text-text-main-dark"
                          />
                          <span className="text-[10px] text-text-secondary">{suffix}</span>
                        </div>

                        {/* 删除按钮 */}
                        <button
                          type="button"
                          className="text-error hover:text-error/80 p-1 font-extrabold text-xs shrink-0 bg-transparent border-0 cursor-pointer"
                          onClick={() => {
                            const newTemplate = [...dayTemplate];
                            newTemplate[dayIdx].warmup.splice(idx, 1);
                            setDayTemplate(newTemplate);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  
                  <button
                    type="button"
                    className="py-1 border border-dashed border-border-card/60 dark:border-border-card-dark/60 rounded-lg text-center text-xs text-text-secondary hover:text-text-main hover:bg-bg-main/30 font-bold cursor-pointer"
                    onClick={() => {
                      const newTemplate = [...dayTemplate];
                      newTemplate[dayIdx].warmup = [
                        ...(newTemplate[dayIdx].warmup || []),
                        { exercise: '', sets: 2, reps: 10, recording_method: 'reps_only' }
                      ];
                      setDayTemplate(newTemplate);
                    }}
                  >
                    + 添加热身动作
                  </button>
                </div>
              </div>

              {/* 练后拉伸 (Stretching) */}
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border-card/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-tier-t2 flex items-center gap-1"><Activity size={12} /> 练后拉伸</span>
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline font-bold bg-transparent border-0 cursor-pointer"
                    onClick={() => {
                      setImporterTarget({ dayLabel: day.label, type: 'stretching' });
                      setTemplateImporterOpen(true);
                    }}
                  >
                    从模板导入
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {(day.stretching || []).map((item, idx) => {
                    const displayName = getCNName(item.exercise, exerciseNameMap);
                    const suffix = item.recording_method === 'duration_only' ? '秒' : '次';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 bg-bg-card dark:bg-bg-card-dark p-1.5 rounded-lg border border-border-card/40 dark:border-border-card-dark/40">
                        {/* 动作选择按钮 */}
                        <button
                          type="button"
                          className="flex-1 text-left justify-start cursor-pointer truncate text-xs font-bold bg-transparent border-0 text-text-main dark:text-text-main-dark"
                          onClick={() => {
                            setSelectingTarget({ dayLabel: day.label, idx, type: 'stretching' });
                            setSelectorShowAll(false);
                            setSelectorOpen(true);
                          }}
                        >
                          <span className={item.exercise ? 'text-text-main dark:text-text-main-dark' : 'text-text-secondary/70 italic font-normal'}>
                            {displayName || '点击选择动作...'}
                          </span>
                        </button>
                        
                        {/* 组数输入 */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={item.sets || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newTemplate = [...dayTemplate];
                              newTemplate[dayIdx].stretching[idx].sets = val === '' ? 0 : Math.max(1, parseInt(val, 10) || 1);
                              setDayTemplate(newTemplate);
                            }}
                            className="h-7 w-8 rounded border border-border-card bg-bg-main/20 text-center text-xs font-semibold font-mono text-text-main dark:text-text-main-dark"
                          />
                          <span className="text-[10px] text-text-secondary">组</span>
                        </div>

                        {/* 次数/秒数输入 */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="600"
                            value={item.reps || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newTemplate = [...dayTemplate];
                              newTemplate[dayIdx].stretching[idx].reps = val === '' ? 0 : Math.max(1, parseInt(val, 10) || 1);
                              setDayTemplate(newTemplate);
                            }}
                            className="h-7 w-10 rounded border border-border-card bg-bg-main/20 text-center text-xs font-semibold font-mono text-text-main dark:text-text-main-dark"
                          />
                          <span className="text-[10px] text-text-secondary">{suffix}</span>
                        </div>

                        {/* 删除按钮 */}
                        <button
                          type="button"
                          className="text-error hover:text-error/80 p-1 font-extrabold text-xs shrink-0 bg-transparent border-0 cursor-pointer"
                          onClick={() => {
                            const newTemplate = [...dayTemplate];
                            newTemplate[dayIdx].stretching.splice(idx, 1);
                            setDayTemplate(newTemplate);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="py-1 border border-dashed border-border-card/60 dark:border-border-card-dark/60 rounded-lg text-center text-xs text-text-secondary hover:text-text-main hover:bg-bg-main/30 font-bold cursor-pointer"
                    onClick={() => {
                      const newTemplate = [...dayTemplate];
                      newTemplate[dayIdx].stretching = [
                        ...(newTemplate[dayIdx].stretching || []),
                        { exercise: '', sets: 2, reps: 30, recording_method: 'duration_only' }
                      ];
                      setDayTemplate(newTemplate);
                    }}
                  >
                    + 添加拉伸动作
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* 模板导入弹窗 */}
      {templateImporterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-bg-card dark:bg-bg-card-dark rounded-2xl w-full max-w-sm border border-border-card dark:border-border-card-dark shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-sheet-slide-up">
            <div className="p-4 border-b border-border-card dark:border-border-card-dark flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main dark:text-text-main-dark">
                选择要导入的 {importerTarget?.type === 'warmup' ? '热身' : '拉伸'} 模板
              </h3>
              <button
                type="button"
                onClick={() => setTemplateImporterOpen(false)}
                className="text-text-secondary hover:text-text-main font-bold text-sm bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {workoutTemplates
                .filter(t => t.type === importerTarget?.type)
                .map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left p-3 rounded-xl border border-border-card dark:border-border-card-dark bg-bg-main/10 hover:bg-bg-hover transition-colors flex flex-col gap-1 cursor-pointer"
                    onClick={() => handleImportTemplate(t)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-text-main dark:text-text-main-dark">{t.name}</span>
                      <div className="flex gap-1">
                        {(t.target_body_parts || []).map((p, idx) => (
                          <span key={idx} className="badge badge-xs badge-neutral text-[9px]">{p}</span>
                        ))}
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-[10px] text-text-secondary leading-relaxed mt-0.5">{t.description}</p>
                    )}
                    <div className="text-[9px] text-text-secondary/70 font-mono mt-1">
                      动作数量: {(t.exercises || []).length} 个
                    </div>
                  </button>
                ))}
              {workoutTemplates.filter(t => t.type === importerTarget?.type).length === 0 && (
                <div className="text-center py-8 text-text-secondary italic text-xs">
                  暂无匹配类型的模板，请先在「模板库」中创建。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 动作选择器模态框（共享组件） */}
      <ExercisePickerModal
        isOpen={selectorOpen && !!selectingTarget}
        onClose={() => setSelectorOpen(false)}
        className="z-[100]"
        title={
          selectingTarget?.type === 'warmup'
            ? '选择练前热身动作'
            : selectingTarget?.type === 'stretching'
              ? '选择练后拉伸动作'
              : selectingTarget?.type === 'T2_superset'
                ? '选择 T2 超级组搭配动作'
                : '选择 T3 辅助动作'
        }
        subtitle={selectingTarget ? `为 ${selectingTarget.dayLabel} 选择动作` : undefined}
        search={selectorSearch}
        onSearchChange={setSelectorSearch}
        searchPlaceholder="搜索动作名称、器械..."
        headerExtra={
          <button type="button"
            onClick={() => {
              if (!selectingTarget) return;
              const { type, dayLabel, idx } = selectingTarget;
              const newTemplate = dayTemplate.map(d => {
                if (d.label !== dayLabel) return d;
                if (type === 'warmup') return { ...d, warmup: d.warmup.map((item, i) => i === idx ? { ...item, exercise: '' } : item) };
                if (type === 'stretching') return { ...d, stretching: d.stretching.map((item, i) => i === idx ? { ...item, exercise: '' } : item) };
                if (type === 'T2_superset') return { ...d, T2_superset: { ...(d.T2_superset || { enabled: false, rest_between: 45, rest_after: 90 }), exercise: '' } };
                return { ...d, t3: d.t3.map((ex, i) => i === idx ? '' : ex) };
              });
              setDayTemplate(newTemplate);
              setSelectorOpen(false);
            }}
            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-dashed border-border-card/60 hover:border-error/40 hover:bg-bg-alert/10 text-text-secondary hover:text-error transition-all cursor-pointer">
            <Ban size={12} /> 清除选择
          </button>
        }
        exercises={filteredExercises}
        emptyMessage="未找到匹配 of 动作"
        renderItem={(ex) => {
          const isSelected = selectingTarget?.type === 'warmup'
            ? dayTemplate.find(d => d.label === selectingTarget.dayLabel)?.warmup[selectingTarget.idx]?.exercise === ex.name
            : selectingTarget?.type === 'stretching'
              ? dayTemplate.find(d => d.label === selectingTarget.dayLabel)?.stretching[selectingTarget.idx]?.exercise === ex.name
              : selectingTarget?.type === 'T2_superset'
                ? dayTemplate.find(d => d.label === selectingTarget.dayLabel)?.T2_superset?.exercise === ex.name
                : dayTemplate.find(d => d.label === selectingTarget.dayLabel)?.t3[selectingTarget.idx] === ex.name;

          return (
            <button key={ex.name} type="button"
              className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-bg-main/20 dark:bg-bg-main-dark/20 hover:bg-bg-hover dark:hover:bg-bg-hover-dark border-border-card/30 dark:border-border-card-dark/30 text-text-main dark:text-text-main-dark'
              }`}
              onClick={() => {
                if (!selectingTarget) return;
                const { type, dayLabel, idx } = selectingTarget;
                const newTemplate = dayTemplate.map(d => {
                  if (d.label !== dayLabel) return d;
                  if (type === 'warmup') return { ...d, warmup: d.warmup.map((item, i) => i === idx ? { exercise: ex.name, sets: item.sets || 2, reps: item.reps || (ex.recording_method === 'duration_only' ? 30 : 10), recording_method: ex.recording_method || 'reps_only' } : item) };
                  if (type === 'stretching') return { ...d, stretching: d.stretching.map((item, i) => i === idx ? { exercise: ex.name, sets: item.sets || 2, reps: item.reps || (ex.recording_method === 'duration_only' ? 30 : 10), recording_method: ex.recording_method || 'reps_only' } : item) };
                  if (type === 'T2_superset') return { ...d, T2_superset: { ...(d.T2_superset || { enabled: true, rest_between: 45, rest_after: 90 }), exercise: ex.name } };
                  return { ...d, t3: d.t3.map((name, i) => i === idx ? ex.name : name) };
                });
                setDayTemplate(newTemplate);
                setSelectorOpen(false);
              }}>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate">{ex.name_cn || ex.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{(ex.primary_muscles || []).slice(0, 2).join(', ')}</span>
                  <span className="text-[10px] text-text-secondary/50">•</span>
                  <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{(ex.equipment || []).slice(0, 1).join(', ')}</span>
                  {ex.exercise_type && ex.exercise_type !== 'strength' && (
                    <>
                      <span className="text-[10px] text-text-secondary/50">•</span>
                      <span className="text-[10px] text-primary font-bold">{ex.exercise_type === 'stretching' ? '拉伸' : ex.exercise_type === 'animal_flow' ? '动物流' : ex.exercise_type === 'mobility' ? '活动度' : '其它'}</span>
                    </>
                  )}
                </div>
              </div>
              {isSelected && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">当前</span>}
            </button>
          );
        }}
      >
        {/* 肌群筛选标签 */}
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
        {/* 显示动作库全部动作开关 */}
        <div className="flex items-center justify-between pt-1 select-none">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-text-secondary-dark cursor-pointer font-semibold">
            <input type="checkbox" checked={selectorShowAll} onChange={(e) => setSelectorShowAll(e.target.checked)} className="checkbox checkbox-xs checkbox-primary" />
            <span>显示动作库全部动作</span>
          </label>
        </div>
      </ExercisePickerModal>

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
  const [existingProgramState, setExistingProgramState] = useState(null);
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
            setExistingProgramState(existingUP.program_state || null);
          } else {
            setUserProgramId(null); // 全新订阅，执行写入
            setExistingProgramState(null);
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
        program_state: existingProgramState || initialState,
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

