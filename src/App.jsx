import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  EXERCISE_NAMES_CN, 
  DAY_WORKOUT_MAP, 
  DAY_T3_MAP,
  getNextDay, 
  getT1Progression, 
  getT2Progression,
  getT3Progression
} from './progression';
import TodayScreen from './TodayScreen';
import PlanScreen from './PlanScreen';
import CalendarScreen from './CalendarScreen';
import TrainSession from './TrainSession';
import FloatingBall from './FloatingBall';
import OnboardingScreen from './OnboardingScreen';
import { 
  Dumbbell, 
  CheckCircle, 
  AlertTriangle, 
  Sun,
  Moon
} from 'lucide-react';

// 获取星期的英文名称
const getWeekdayEnglish = (date) => {
  const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdaysEng[date.getDay()];
};

// 获取星期的中文名称
const getWeekdayCN = (date) => {
  const weekdaysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdaysCN[date.getDay()];
};

// 计算下一个训练日程日期
const calculateNextTrainingDate = (trainingDaysArr, baseDate = new Date()) => {
  if (!trainingDaysArr || trainingDaysArr.length === 0) return null;
  
  const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIndices = trainingDaysArr.map(day => weekdaysEng.indexOf(day)).filter(idx => idx !== -1);
  if (targetIndices.length === 0) return null;

  const baseDayIdx = baseDate.getDay();
  
  // 寻找大于 baseDayIdx 的最小索引
  let nextDayIdx = targetIndices.find(idx => idx > baseDayIdx);
  let daysDiff = 0;
  
  if (nextDayIdx !== undefined) {
    daysDiff = nextDayIdx - baseDayIdx;
  } else {
    // 没找到，说明要回绕到下一周的最小索引
    const minIdx = Math.min(...targetIndices);
    daysDiff = 7 - baseDayIdx + minIdx;
  }
  
  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(baseDate.getDate() + daysDiff);
  return nextDate;
};

function App() {
  // 1. 选项卡 Tab 状态 ('today' | 'plan' | 'calendar')
  const [activeTab, setActiveTab] = useState('today');

  // 2. 全局主题状态 (日间/夜间模式，默认夜间)
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // 3. 全局数据加载及保存状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: '' }
  
  const [currentDay, setCurrentDay] = useState('Day1');

  // Onboarding 引导状态
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trainingDays, setTrainingDays] = useState(null);
  const [userNickname, setUserNickname] = useState(() => localStorage.getItem('user_nickname') || '');

  // 挂载时检查是否已完成引导
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    if (!completed) {
      setShowOnboarding(true);
    }
  }, []);
  
  // 自定义重量、进阶步长与 T3 达标门槛状态
  const [customWeights, setCustomWeights] = useState({});
  const [customIncrements, setCustomIncrements] = useState({});
  const [customT3Targets, setCustomT3Targets] = useState({});

  // 动作中文名映射状态
  const [exercisesCnMap, setExercisesCnMap] = useState({});

  // 今日 T1/T2/T3 动作代号
  const [t1Exercise, setT1Exercise] = useState('squat');
  const [t2Exercise, setT2Exercise] = useState('bench');
  const [t3Exercise, setT3Exercise] = useState('pullup');
  
  // 今日建议重量
  const [t1Weight, setT1Weight] = useState(40.0);
  const [t2Weight, setT2Weight] = useState(30.0);
  const [t3Weight, setT3Weight] = useState(10.0);
  
  // 今日计划次数
  const [t1PlannedReps, setT1PlannedReps] = useState(3);
  const [t2PlannedReps, setT2PlannedReps] = useState(10);
  const [t3PlannedReps, setT3PlannedReps] = useState(15);
  
  // 今日方案描述
  const [t1SchemeText, setT1SchemeText] = useState('');
  const [t2SchemeText, setT2SchemeText] = useState('');
  const [t3SchemeText, setT3SchemeText] = useState('');
  
  // 最后一组实际历史
  const [t1LastRecord, setT1LastRecord] = useState(null);
  const [t2LastRecord, setT2LastRecord] = useState(null);
  const [t3LastRecord, setT3LastRecord] = useState(null);

  // 今日是否已完成训练打卡及摘要
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);
  const [todayWorkoutSummary, setTodayWorkoutSummary] = useState([]);

  // 4. 实时打卡会话状态 (sessionState)
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isMinimized: false,
    setsData: {
      T1: [],
      T2: [],
      T3: []
    }
  });

  // 挂载/切换时设定 HTML 节点的主题属性
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);


  // Toast 计时器
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 根据计划数反推组数
  const getT1TotalSets = (reps) => {
    if (reps === 3) return 5;
    if (reps === 2) return 6;
    if (reps === 1) return 10;
    return 5;
  };

  // 核心数据获取与计算逻辑
  const loadWorkoutData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 检查今天本地是否已打卡完成训练 (按本地时区判定 00:00:00 起的数据)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [lastWorkoutRes, settingsRes, progressionRes, exercisesRes, todayWorkoutsRes, profileRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('user_settings')
          .select('*'),
        supabase
          .from('exercise_progression_settings')
          .select('*'),
        supabase
          .from('exercises')
          .select('*'),
        supabase
          .from('workouts')
          .select('*')
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('user_profiles')
          .select('*')
          .limit(1)
      ]);

      if (lastWorkoutRes.error) throw lastWorkoutRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (progressionRes.error) throw progressionRes.error;
      if (exercisesRes.error) throw exercisesRes.error;
      if (todayWorkoutsRes.error) throw todayWorkoutsRes.error;
      if (profileRes.error) throw profileRes.error;

      // 解析今日打卡状态
      const todayWorkouts = todayWorkoutsRes.data || [];
      const hasTodayWorkout = todayWorkouts.length > 0;
      setIsTodayCompleted(hasTodayWorkout);
      setTodayWorkoutSummary(todayWorkouts);

      // 解析用户画像日程
      const profileData = profileRes.data || [];
      let trainingDaysArray = null;
      if (profileData.length > 0 && profileData[0].training_days) {
        try {
          trainingDaysArray = JSON.parse(profileData[0].training_days);
        } catch (e) {
          console.error('Failed to parse training_days json:', e);
        }
      }
      setTrainingDays(trainingDaysArray);
      setUserNickname(localStorage.getItem('user_nickname') || '');

      // 解析当前/下一次训练日
      let determinedDay = 'Day1';
      const lastWorkoutData = lastWorkoutRes.data || [];
      if (lastWorkoutData.length > 0) {
        // 如果今天已经练完了，展示的 currentDay 依然是下一个训练日（供界面暗示及后续逻辑）
        determinedDay = getNextDay(lastWorkoutData[0].training_day);
      }
      setCurrentDay(determinedDay);

      // 解析用户自定义初始重量
      const weightsMap = {};
      const settingsData = settingsRes.data || [];
      settingsData.forEach(row => {
        weightsMap[row.exercise] = row.initial_weight;
      });
      setCustomWeights(weightsMap);

      // 解析用户自定义进阶步长映射与 T3 门槛次数
      const incrementsMap = {};
      const t3TargetsMap = {};
      const progressionData = progressionRes.data || [];
      progressionData.forEach(row => {
        if (!incrementsMap[row.exercise]) {
          incrementsMap[row.exercise] = {};
        }
        incrementsMap[row.exercise][row.tier] = row.increment;
        if (row.tier === 'T3') {
          t3TargetsMap[row.exercise] = row.target_reps || 25;
        }
      });
      setCustomIncrements(incrementsMap);
      setCustomT3Targets(t3TargetsMap);

      // 解析 exercises 动作表的中文名映射
      const cnNames = {};
      const dbExercises = exercisesRes.data || [];
      dbExercises.forEach(row => {
        const key = row.name || row.exercise || '';
        const cnName = row.name_cn || row.title || row.chinese_name || '';
        if (key && cnName) {
          cnNames[key] = cnName;
        }
      });
      setExercisesCnMap(cnNames);

      // 根据训练日确定今日/下一次动作组合
      const t1t2Exercises = DAY_WORKOUT_MAP[determinedDay];
      const activeT1 = t1t2Exercises.T1;
      const activeT2 = t1t2Exercises.T2;
      const activeT3 = DAY_T3_MAP[determinedDay];

      setT1Exercise(activeT1);
      setT2Exercise(activeT2);
      setT3Exercise(activeT3);

      // 分别查询三个动作在其对应 Tier 的所有历史记录（按 created_at 升序，用于 progression 计算）
      const [t1HistoryRes, t2HistoryRes, t3HistoryRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('*')
          .eq('exercise', activeT1)
          .eq('tier', 'T1')
          .order('created_at', { ascending: true }),
        supabase
          .from('workouts')
          .select('*')
          .eq('exercise', activeT2)
          .eq('tier', 'T2')
          .order('created_at', { ascending: true }),
        supabase
          .from('workouts')
          .select('*')
          .eq('exercise', activeT3)
          .eq('tier', 'T3')
          .order('created_at', { ascending: true })
      ]);

      if (t1HistoryRes.error) throw t1HistoryRes.error;
      if (t2HistoryRes.error) throw t2HistoryRes.error;
      if (t3HistoryRes.error) throw t3HistoryRes.error;

      const t1History = t1HistoryRes.data || [];
      const t2History = t2HistoryRes.data || [];
      const t3History = t3HistoryRes.data || [];

      // 保存最后一组实际历史
      setT1LastRecord(t1History.length > 0 ? t1History[t1History.length - 1] : null);
      setT2LastRecord(t2History.length > 0 ? t2History[t2History.length - 1] : null);
      setT3LastRecord(t3History.length > 0 ? t3History[t3History.length - 1] : null);

      // 提取初始重量设置与增重步长 (包含 T3)
      const t1CustomWeight = weightsMap[activeT1];
      const t2CustomWeight = weightsMap[activeT2];
      const t3CustomWeight = weightsMap[activeT3];
      
      const t1Increment = (incrementsMap[activeT1] && incrementsMap[activeT1]['T1'] !== undefined)
        ? incrementsMap[activeT1]['T1']
        : 2.5;
      
      const t2Increment = (incrementsMap[activeT2] && incrementsMap[activeT2]['T2'] !== undefined)
        ? incrementsMap[activeT2]['T2']
        : 2.5;

      const t3Increment = (incrementsMap[activeT3] && incrementsMap[activeT3]['T3'] !== undefined)
        ? incrementsMap[activeT3]['T3']
        : 2.5;

      const t3TargetReps = (t3TargetsMap[activeT3] !== undefined)
        ? t3TargetsMap[activeT3]
        : 25;

      // 运行 GZCLP 核心进步算法
      const t1Result = getT1Progression(activeT1, t1History, t1CustomWeight, t1Increment);
      const t2Result = getT2Progression(activeT2, t2History, t2CustomWeight, t2Increment);
      const t3Result = getT3Progression(activeT3, t3History, t3CustomWeight, t3Increment, t3TargetReps);

      setT1Weight(t1Result.weight_kg);
      setT1PlannedReps(t1Result.planned_reps);
      setT1SchemeText(t1Result.scheme_text);

      setT2Weight(t2Result.weight_kg);
      setT2PlannedReps(t2Result.planned_reps);
      setT2SchemeText(t2Result.scheme_text);

      setT3Weight(t3Result.weight_kg);
      setT3PlannedReps(t3Result.planned_reps);
      setT3SchemeText(t3Result.scheme_text);

    } catch (err) {
      console.error(err);
      setError('无法加载配置或训练记录，请检查连接：' + err.message);
      setToast({ type: 'error', message: '数据加载失败！' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkoutData();
  }, []);

  // 4. 开启实时打卡会话 (startTrainSession)
  const startTrainSession = () => {
    // 动态生成 T1 实际组数
    const t1TotalSets = getT1TotalSets(t1PlannedReps);

    const t1Sets = Array.from({ length: t1TotalSets }, (_, idx) => ({
      set_number: idx + 1,
      planned_reps: t1PlannedReps,
      actual_reps: '', // 空表示默认使用 planned_reps
      completed: false,
      weight_kg: t1Weight
    }));

    // T2 固定为 3 组
    const t2Sets = Array.from({ length: 3 }, (_, idx) => ({
      set_number: idx + 1,
      planned_reps: t2PlannedReps,
      actual_reps: '',
      completed: false,
      weight_kg: t2Weight
    }));

    // T3 固定为 3 组
    const t3Sets = Array.from({ length: 3 }, (_, idx) => ({
      set_number: idx + 1,
      planned_reps: t3PlannedReps,
      actual_reps: '',
      completed: false,
      weight_kg: t3Weight
    }));

    setSessionState({
      isActive: true,
      isMinimized: false,
      setsData: {
        T1: t1Sets,
        T2: t2Sets,
        T3: t3Sets
      }
    });
  };

  // 恢复或者开始训练
  const handleStartOrRestoreTrain = () => {
    if (sessionState.isActive) {
      setSessionState(prev => ({ ...prev, isMinimized: false }));
    } else {
      startTrainSession();
    }
  };

  // 放弃/销毁打卡会话
  const handleCancelSession = () => {
    setSessionState({
      isActive: false,
      isMinimized: false,
      setsData: { T1: [], T2: [], T3: [] }
    });
    setToast({ type: 'success', message: '已放弃本次训练数据。' });
  };

  // 5. 双写并行保存 (workouts & workout_sets)
  const handleSaveSession = async () => {
    const { T1: t1Sets, T2: t2Sets, T3: t3Sets } = sessionState.setsData;

    // 校验每个动作的最后一组实际次数 (必填校验)
    const t1Last = t1Sets[t1Sets.length - 1];
    const t2Last = t2Sets[t2Sets.length - 1];
    const t3Last = t3Sets[t3Sets.length - 1];

    const getFinalReps = (setObj) => {
      if (setObj.actual_reps === '' || setObj.actual_reps === undefined) {
        return setObj.planned_reps;
      }
      return parseInt(setObj.actual_reps, 10);
    };

    const t1LastReps = getFinalReps(t1Last);
    const t2LastReps = getFinalReps(t2Last);
    const t3LastReps = getFinalReps(t3Last);

    if (isNaN(t1LastReps) || t1LastReps < 0 ||
        isNaN(t2LastReps) || t2LastReps < 0 ||
        isNaN(t3LastReps) || t3LastReps < 0) {
      setToast({ type: 'error', message: '打卡保存失败：最后一组的实际次数必须是有效的正数' });
      return;
    }

    setSaving(true);
    try {
      // A. 组装 workouts 日级汇总表记录 (actual_last_set_reps 从对应动作的最后一组中提取)
      const t1Record = {
        training_day: currentDay,
        tier: 'T1',
        exercise: t1Exercise,
        weight_kg: t1Weight,
        planned_reps: t1PlannedReps,
        actual_last_set_reps: t1LastReps
      };

      const t2Record = {
        training_day: currentDay,
        tier: 'T2',
        exercise: t2Exercise,
        weight_kg: t2Weight,
        planned_reps: t2PlannedReps,
        actual_last_set_reps: t2LastReps
      };

      const t3Record = {
        training_day: currentDay,
        tier: 'T3',
        exercise: t3Exercise,
        weight_kg: t3Weight,
        planned_reps: t3PlannedReps,
        actual_last_set_reps: t3LastReps
      };

      // B. 组装 workout_sets 单组明细记录
      const setsToInsert = [];

      const mapSets = (sets, exerciseName, tierName) => {
        return sets.map(s => ({
          exercise: exerciseName,
          tier: tierName,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          planned_reps: s.planned_reps,
          actual_reps: getFinalReps(s),
          completed: s.completed,
          notes: null
        }));
      };

      setsToInsert.push(...mapSets(t1Sets, t1Exercise, 'T1'));
      setsToInsert.push(...mapSets(t2Sets, t2Exercise, 'T2'));
      setsToInsert.push(...mapSets(t3Sets, t3Exercise, 'T3'));

      // C. 并行保存写入 Supabase 两张表
      const [insertWorkoutsRes, insertSetsRes] = await Promise.all([
        supabase
          .from('workouts')
          .insert([t1Record, t2Record, t3Record]),
        supabase
          .from('workout_sets')
          .insert(setsToInsert)
      ]);

      if (insertWorkoutsRes.error) throw insertWorkoutsRes.error;
      if (insertSetsRes.error) throw insertSetsRes.error;

      // 保存成功后提示并刷新数据
      const nextDay = getNextDay(currentDay);
      let toastMsg = `保存成功！下次训练动作方案为 ${nextDay}`;
      if (trainingDays && trainingDays.length > 0) {
        const nextDate = calculateNextTrainingDate(trainingDays, new Date());
        if (nextDate) {
          toastMsg = `保存成功！下次训练日为 ${nextDate.getMonth() + 1}月${nextDate.getDate()}日 (${getWeekdayCN(nextDate)})`;
        }
      }
      setToast({ 
        type: 'success', 
        message: toastMsg 
      });

      // 重置打卡状态
      setSessionState({
        isActive: false,
        isMinimized: false,
        setsData: { T1: [], T2: [], T3: [] }
      });

      // 重载当前数据计算新建议
      await loadWorkoutData();

    } catch (err) {
      console.error('双写保存训练记录失败：', err);
      setToast({ type: 'error', message: '保存记录失败：' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // 计算当前最小化悬浮球的打卡进度文案
  const getSessionProgress = (setsData) => {
    if (!setsData) return '';
    const tiers = ['T1', 'T2', 'T3'];
    for (const tier of tiers) {
      const sets = setsData[tier] || [];
      const completedCount = sets.filter(s => s.completed).length;
      if (completedCount < sets.length) {
        return `${tier} ${completedCount}/${sets.length}`;
      }
    }
    const t3Sets = setsData.T3 || [];
    return `T3 ${t3Sets.length}/${t3Sets.length}`;
  };

  // 获取步长 (展示卡片右上角增重用)
  const getIncrementStep = (exercise, tier) => {
    if (customIncrements[exercise] && customIncrements[exercise][tier] !== undefined) {
      return customIncrements[exercise][tier];
    }
    return 2.5;
  };

  // 获取中文名翻译
  const getExerciseCNName = (exercise) => {
    return exercisesCnMap[exercise] || EXERCISE_NAMES_CN[exercise] || exercise;
  };

  const getNextTrainingDateFormatted = () => {
    if (!trainingDays || trainingDays.length === 0) return '';
    const todayEnglish = getWeekdayEnglish(new Date());
    const isTodayScheduled = trainingDays.includes(todayEnglish);
    
    let baseDate = new Date();
    if (isTodayScheduled && !isTodayCompleted) {
      return baseDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } else {
      const nextDate = calculateNextTrainingDate(trainingDays, baseDate);
      if (!nextDate) return '';
      return nextDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-[480px] w-full mx-auto bg-bg-main dark:bg-bg-main-dark text-text-main dark:text-text-main-dark border-x border-border-card dark:border-border-card-dark shadow-2xl relative transition-colors duration-200">
      {/* Toast 提示 */}
      {toast && (
        <div className="toast toast-top toast-center z-[9999] min-w-[320px] max-w-[440px] px-4">
          <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg rounded-xl flex items-center gap-3`}>
            {toast.type === 'success' ? (
              <CheckCircle size={18} className="text-white shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-white shrink-0" />
            )}
            <span className="text-sm font-semibold text-white break-words text-left">{toast.message}</span>
          </div>
        </div>
      )}

      {/* 头部区 - DaisyUI Navbar */}
      <div className="navbar sticky top-0 z-50 bg-bg-card/90 dark:bg-bg-card-dark/90 border-b border-border-card dark:border-border-card-dark backdrop-blur px-4">
        <div className="flex-1 flex items-center gap-2">
          <Dumbbell size={20} className="text-primary filter drop-shadow-[0_0_8px_rgba(255,107,53,0.4)]" />
          <span className="text-base font-extrabold tracking-wide bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            训练助手
          </span>
          {currentDay && (
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20 ml-1">
              {currentDay}
            </span>
          )}
          {userNickname && (
            <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark px-2 py-0.5 bg-bg-hover dark:bg-bg-hover-dark rounded-full ml-1">
              {userNickname}
            </span>
          )}
        </div>
        <div className="flex-none">
          {/* 主题切换按钮，拥有至少 44px 独立触控区域 */}
          <button 
            type="button" 
            className="btn btn-ghost btn-circle text-text-secondary dark:text-text-secondary-dark hover:bg-bg-hover dark:hover:bg-bg-hover-dark"
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            aria-label="切换配色模式"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* 主屏幕区域 - pt-6 pb-24 提升呼吸间距并彻底消除 Header 遮挡 */}
      <main className="flex-1 pt-6 pb-24 px-5 w-full flex flex-col gap-6">
        
        {/* TAB 1: 今日训练页面 */}
        <div style={{ display: activeTab === 'today' ? 'block' : 'none' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-4">
              <span className="loading loading-spinner text-primary loading-lg"></span>
              <p className="text-sm font-semibold">正在计算今日训练建议...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-error dark:text-error gap-4 p-6 text-center">
              <AlertTriangle size={48} className="text-error" />
              <p className="text-sm font-bold max-w-xs">{error}</p>
              <button 
                type="button"
                className="btn btn-primary px-6 mt-2 font-bold cursor-pointer"
                onClick={loadWorkoutData}
              >
                重新尝试
              </button>
            </div>
          ) : (
            <TodayScreen
              currentDay={currentDay}
              t1Exercise={t1Exercise}
              t2Exercise={t2Exercise}
              t3Exercise={t3Exercise}
              t1Weight={t1Weight}
              t2Weight={t2Weight}
              t3Weight={t3Weight}
              t1PlannedReps={t1PlannedReps}
              t2PlannedReps={t2PlannedReps}
              t3PlannedReps={t3PlannedReps}
              t1SchemeText={t1SchemeText}
              t2SchemeText={t2SchemeText}
              t3SchemeText={t3SchemeText}
              sessionState={sessionState}
              onStartTrain={handleStartOrRestoreTrain}
              getIncrementStep={getIncrementStep}
              getExerciseCNName={getExerciseCNName}
              isTodayCompleted={isTodayCompleted && !sessionState.isActive}
              todayWorkoutSummary={todayWorkoutSummary}
              isRestDay={
                trainingDays && trainingDays.length > 0 
                  ? !trainingDays.includes(getWeekdayEnglish(new Date()))
                  : false
              }
              nextTrainingDate={getNextTrainingDateFormatted()}
            />
          )}
        </div>

        {/* TAB 2: 计划页面 */}
        <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
          <PlanScreen 
            onSettingsSaved={() => {
              setToast({ type: 'success', message: '初始重量与进阶步长保存成功！今日建议重量已同步更新。' });
              loadWorkoutData();
            }}
          />
        </div>

        {/* TAB 3: 训练日历页面 */}
        <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
          <CalendarScreen 
            getExerciseCNName={getExerciseCNName}
          />
        </div>

      </main>

      {/* 底部固定导航栏 - 使用 DaisyUI v5 dock，精准以 1/2 对齐中线 */}
      <div className="dock fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-bg-card/90 dark:bg-bg-card-dark/90 border-t border-border-card dark:border-border-card-dark backdrop-blur h-16">
        <button 
          type="button" 
          className={`transition-all duration-200 ${
            activeTab === 'today' 
              ? 'dock-active text-primary font-bold bg-transparent' 
              : 'text-text-secondary dark:text-text-secondary-dark'
          }`}
          onClick={() => setActiveTab('today')}
        >
          <span className="text-xl">🏋️</span>
          <span className="dock-label text-xs font-bold">今日</span>
        </button>
        <button 
          type="button" 
          className={`transition-all duration-200 ${
            activeTab === 'plan' 
              ? 'dock-active text-primary font-bold bg-transparent' 
              : 'text-text-secondary dark:text-text-secondary-dark'
          }`}
          onClick={() => setActiveTab('plan')}
        >
          <span className="text-xl">📋</span>
          <span className="dock-label text-xs font-bold">计划</span>
        </button>
        <button 
          type="button" 
          className={`transition-all duration-200 ${
            activeTab === 'calendar' 
              ? 'dock-active text-primary font-bold bg-transparent' 
              : 'text-text-secondary dark:text-text-secondary-dark'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          <span className="text-xl">📅</span>
          <span className="dock-label text-xs font-bold">日历</span>
        </button>
      </div>

      {/* 实时训练遮罩层 */}
      {sessionState.isActive && (
        <div style={{ display: sessionState.isMinimized ? 'none' : 'block' }}>
          <TrainSession
            currentDay={currentDay}
            sessionState={sessionState}
            setSessionState={setSessionState}
            t1Exercise={t1Exercise}
            t2Exercise={t2Exercise}
            t3Exercise={t3Exercise}
            t1Weight={t1Weight}
            t2Weight={t2Weight}
            t3Weight={t3Weight}
            getExerciseCNName={getExerciseCNName}
            onMinimize={() => {
              setSessionState(prev => ({ ...prev, isMinimized: true }));
            }}
            onSave={handleSaveSession}
            onCancel={handleCancelSession}
          />
        </div>
      )}

      {/* 缩小打卡后的拖拽悬浮球 */}
      {sessionState.isActive && sessionState.isMinimized && (
        <FloatingBall
          progress={getSessionProgress(sessionState.setsData)}
          onRestore={() => {
            setSessionState(prev => ({ ...prev, isMinimized: false }));
          }}
          onCancel={handleCancelSession}
        />
      )}

      {/* 新用户画像引导 */}
      {showOnboarding && (
        <OnboardingScreen
          onComplete={(tabToGoTo) => {
            setShowOnboarding(false);
            if (tabToGoTo) {
              setActiveTab(tabToGoTo);
            }
            setToast({
              type: 'success',
              message: '画像保存成功！请在此配置各个动作的初始重量和进阶步长。'
            });
            loadWorkoutData();
          }}
          onSkip={() => {
            setShowOnboarding(false);
            setToast({
              type: 'success',
              message: '已跳过引导，您可随时在今日面板开始训练。'
            });
            loadWorkoutData();
          }}
        />
      )}
    </div>
  );
}

export default App;

