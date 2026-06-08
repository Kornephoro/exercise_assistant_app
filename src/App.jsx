import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Dumbbell, ClipboardList, UtensilsCrossed, ChartColumnIncreasing, User } from 'lucide-react';
import { fetchActivePrograms, fetchAllUserPrograms, fetchExercises, saveUserProgram } from './services/programService';
import { fetchUserProfile } from './services/profileService';
import { fetchBodyMetrics } from './services/bodyService';
import { fetchDietLog, fetchActiveUserNutritionConfig } from './services/dietService';
import {
  fetchProgramWorkoutsHistory,
  fetchTodayWorkouts,
  fetchLatestOneRmForExercises,
  completeWorkoutSession
} from './services/workoutService';
import { getNextWorkout, getNextDay, isTodayTrainingDay, getNextTrainingDate, getDaysUntilStart } from './programEngine';
import { calcE1RM, MAIN_LIFT_KEYS } from './oneRmUtils';
import { DEFAULT_GYM_EQUIPMENT_CONFIG } from './unitUtils';
import { getCNName } from './exerciseNames';
import { useRestTimer } from './hooks/useRestTimer';
import { useNavigation } from './hooks/useNavigation';
import { ensureAppUser, clearEnsureUserCache } from './supabaseClient';
import { getAuthState } from './services/authService';
import ErrorBoundary from './components/ErrorBoundary';
import {
  CheckCircle,
  AlertTriangle,
  SkipForward
} from 'lucide-react';

const TodayScreen = lazy(() => import('./TodayScreen'));
const PlanScreen = lazy(() => import('./PlanScreen'));
const DataScreen = lazy(() => import('./DataScreen'));
const MyPage = lazy(() => import('./MyPage'));
const DietScreen = lazy(() => import('./DietScreen'));
const TrainSession = lazy(() => import('./TrainSession'));
const FloatingBall = lazy(() => import('./FloatingBall'));
const OnboardingScreen = lazy(() => import('./OnboardingScreen'));
const WorkoutPreviewModal = lazy(() => import('./WorkoutPreviewModal'));

const ScreenFallback = ({ label = '加载中...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[240px] text-text-secondary dark:text-text-secondary-dark gap-3">
    <span className="loading loading-spinner text-primary"></span>
    <span className="text-xs font-semibold">{label}</span>
  </div>
);

const createSessionId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    const value = char === 'x' ? rand : (rand & 0x3 | 0x8);
    return value.toString(16);
  });
};

function App() {
  const [activeTab, setActiveTab] = useState('today');

  const [themeMode, setThemeMode] = useState(() => {
    const savedThemeMode = localStorage.getItem('theme_mode');
    return savedThemeMode || 'system';
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // 当前认证用户 ID（用于检测用户切换）
  const [currentUserId, setCurrentUserId] = useState(null);

  // 用户切换时清理 user-scoped localStorage
  const clearUserLocalStorage = () => {
    const keysToRemove = [
      'active_session_state',
      'active_session_details',
      'active_today_workout',
      'onboarding_completed',
      'onboarding_completed_at',
      'user_nickname',
      'training_days',
      'training_assistant_aerobic_items',
    ];
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    });
  };

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('onboarding_completed') !== 'true';
  });
  // 新架构：programs + user_programs
  const [programs, setPrograms] = useState([]);
  const [userPrograms, setUserPrograms] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(null);
  const [exercisesMap, setExercisesMap] = useState({});

  // 引擎输出：今日训练内容
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);
  const [todayWorkoutSummary, setTodayWorkoutSummary] = useState([]);

  // 用户画像与今日身体数据
  const [userProfile, setUserProfile] = useState(null);
  const [gymEquipmentConfig, setGymEquipmentConfig] = useState(DEFAULT_GYM_EQUIPMENT_CONFIG);
  const [todayBodyMetrics, setTodayBodyMetrics] = useState(null);

  // 用户饮食配置与今日对账单
  const [userNutritionConfig, setUserNutritionConfig] = useState(null);
  const [todayDietLog, setTodayDietLog] = useState(null);

  // 日程计算结果
  const [isRestDayValue, setIsRestDayValue] = useState(false);
  const [nextTrainingDateValue, setNextTrainingDateValue] = useState('');
  const [daysUntilStartValue, setDaysUntilStartValue] = useState(0);

  // 训练会话状态
  const [sessionState, setSessionState] = useState(() => {
    const saved = localStorage.getItem('active_session_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse active_session_state:', e);
      }
    }
    return {
      isActive: false,
      isMinimized: false,
      setsData: {},
      sessionDate: null,
      startTime: null,
      elapsedTime: 0,
      isPaused: false,
      sessionNotes: ''
    };
  });

  const [setDetails, setSetDetails] = useState(() => {
    const saved = localStorage.getItem('active_session_details');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse active_session_details:', e);
      }
    }
    return {};
  });

  // 防抖持久化：500ms 延迟合并高频写入，避免每组完成时触发同步磁盘 I/O
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('active_session_state', JSON.stringify(sessionState));
    }, 500);
    return () => clearTimeout(timer);
  }, [sessionState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('active_session_details', JSON.stringify(setDetails));
    }, 500);
    return () => clearTimeout(timer);
  }, [setDetails]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sessionState.isActive && todayWorkout) {
        localStorage.setItem('active_today_workout', JSON.stringify(todayWorkout));
      } else if (!sessionState.isActive) {
        localStorage.removeItem('active_today_workout');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [todayWorkout, sessionState.isActive]);

  // 训练预览弹窗
  const [previewOpen, setPreviewOpen] = useState(false);

  // 提升的计划库子界面状态
  const [configProgram, setConfigProgram] = useState(null);
  const [selectedActiveProgramId, setSelectedActiveProgramId] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);

  // 提升的动作组卡片状态
  const [showSetCard, setShowSetCard] = useState(false);
  const [focusedSet, setFocusedSet] = useState(null);

  // 操作锁定：训练中或预览弹窗打开时，禁止在 PlanScreen 结束/暂停计划
  const isOperationLocked = sessionState.isActive || previewOpen;

  // Hash 路由导航 (从 useNavigation hook)
  const navigation = useNavigation({
    loading,
    programs,
    sessionActive: sessionState.isActive,
    sessionMinimized: sessionState.isMinimized,
    activeTab, configProgram, selectedActiveProgramId, selectedProgram,
    previewOpen, showSetCard, focusedSet,
    setActiveTab, setConfigProgram, setSelectedActiveProgramId, setSelectedProgram,
    setPreviewOpen, setShowSetCard, setFocusedSet, setSessionState
  });
  const { updateNavigationState, parseHashAndSetState, openSetCard, closeSetCard } = navigation;

  // 组间休息计时 (依赖 openSetCard，必须在 useNavigation 之后调用)
  const { restTimer, setRestTimer } = useRestTimer({
    getFocusedSet: () => focusedSet,
    getExercises: () => todayWorkout?.exercises || [],
    getSetsData: () => sessionState.setsData || {},
    openSetCard
  });

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = themeMode;
      if (themeMode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeTheme = systemPrefersDark ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
      if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    localStorage.setItem('theme_mode', themeMode);
    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 核心数据加载
  const loadWorkoutData = async (overrideActiveProgramId) => {
    setLoading(true);
    setError(null);
    try {
      const prevUserId = currentUserId;

      // 支持"退出后停留在账号页"：MyPage signOut 前设置此标记
      const skipAuth = localStorage.getItem('skip_auto_auth') === 'true';
      if (skipAuth) {
        localStorage.removeItem('skip_auto_auth');
        setLoading(false);
        return;
      }

      await ensureAppUser();
      const { userId: newUserId } = await getAuthState();

      // 用户 ID 变化时清理 user-scoped localStorage，避免数据串号
      if (prevUserId && newUserId && prevUserId !== newUserId) {
        clearUserLocalStorage();
        // 重置本地训练状态
        setSessionState({
          isActive: false,
          isMinimized: false,
          setsData: {},
          sessionDate: null,
          startTime: null,
          elapsedTime: 0,
          isPaused: false,
          sessionNotes: ''
        });
        setSetDetails({});
        setTodayWorkout(null);
        setActiveProgramId(null);
        setShowOnboarding(true);
      }
      setCurrentUserId(newUserId);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const d = new Date();
      const todayISOString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const [programsData, userProgramsData, exercisesData, todayWorkoutsData, profileData, bodyMetricsData, nutritionConfigData, dietLogsData] = await Promise.all([
        fetchActivePrograms(),
        fetchAllUserPrograms(),
        fetchExercises(),
        fetchTodayWorkouts(todayStart.toISOString()),
        fetchUserProfile(),
        fetchBodyMetrics(todayISOString),
        fetchActiveUserNutritionConfig(),
        fetchDietLog(todayISOString)
      ]);

      // 解析 exercises map
      const exMap = {};
      (exercisesData || []).forEach(row => {
        if (row.name) exMap[row.name] = row;
      });
      setExercisesMap(exMap);

      // 解析 programs
      const allPrograms = programsData || [];
      setPrograms(allPrograms);

      // 解析 user_programs
      const allUserPrograms = userProgramsData || [];
      setUserPrograms(allUserPrograms);

      // 解析今日饮食记录
      setTodayDietLog(dietLogsData || null);

      // 解析用户饮食配置
      setUserNutritionConfig(nutritionConfigData || null);

      // 解析用户画像
      setUserProfile(profileData || null);
      if (profileData && profileData.training_days) {
        try { JSON.parse(profileData.training_days); } catch (e) { console.warn('解析训练日程失败:', e); }
      }

      // 解析用户器械配置
      let parsedConfig = DEFAULT_GYM_EQUIPMENT_CONFIG;
      if (profileData && profileData.gym_equipment_config) {
        try {
          parsedConfig = typeof profileData.gym_equipment_config === 'string'
            ? JSON.parse(profileData.gym_equipment_config)
            : profileData.gym_equipment_config;
        } catch (e) {
          console.warn('解析画像器械配置失败:', e);
        }
      } else {
        const localVal = localStorage.getItem('gym_equipment_config');
        if (localVal) {
          try { parsedConfig = JSON.parse(localVal); } catch (e) { console.warn('解析本地器械配置失败:', e); }
        }
      }
      setGymEquipmentConfig(parsedConfig);

      // 解析今日身体记录
      setTodayBodyMetrics(bodyMetricsData || null);
      // 确定当前活跃计划
      const activeUps = allUserPrograms.filter(up => up.is_active);
      let currentActiveId = overrideActiveProgramId !== undefined ? overrideActiveProgramId : activeProgramId;
      if (activeUps.length > 0 && !activeUps.find(u => u.id === currentActiveId)) {
        currentActiveId = activeUps[0].id;
      }
      if (activeUps.length === 0) currentActiveId = null;
      setActiveProgramId(currentActiveId);

      // 解析今日打卡状态 (按当前选择的活跃计划的 program_id 隔离)
      let currentProgramId = null;
      if (currentActiveId) {
        const activeUP = activeUps.find(u => u.id === currentActiveId);
        currentProgramId = activeUP?.program_id;
      }

      const todayWorkouts = todayWorkoutsData || [];
      const filteredTodayWorkouts = todayWorkouts.filter(w => w.program_id === currentProgramId);
      setIsTodayCompleted(filteredTodayWorkouts.length > 0);
      setTodayWorkoutSummary(filteredTodayWorkouts);

      // 用引擎计算今日训练
      if (currentActiveId) {
        const activeUP = activeUps.find(u => u.id === currentActiveId);
        const activeProgram = allPrograms.find(p => p.id === activeUP.program_id);
        if (activeProgram) {
          // 获取该计划所有相关动作的历史 (添加 gte 隔离不同计划订阅周期的数据)
          const historyData = await fetchProgramWorkoutsHistory(
            activeProgram.id,
            activeUP.started_at || activeUP.created_at
          );

          // 按 exercise+tier 分组历史
          const histByExTier = {};
          (historyData || []).forEach(row => {
            if (!histByExTier[row.exercise]) histByExTier[row.exercise] = {};
            if (!histByExTier[row.exercise][row.tier]) histByExTier[row.exercise][row.tier] = [];
            histByExTier[row.exercise][row.tier].push(row);
          });

          const savedWorkout = localStorage.getItem('active_today_workout');
          if (sessionState.isActive && savedWorkout) {
            try {
              setTodayWorkout(JSON.parse(savedWorkout));
            } catch (e) {
              console.warn('Failed to parse active_today_workout:', e);
              const result = getNextWorkout(activeProgram, activeUP, histByExTier, parsedConfig, exMap);
              setTodayWorkout(result);
            }
          } else {
            const result = getNextWorkout(activeProgram, activeUP, histByExTier, parsedConfig, exMap);
            setTodayWorkout(result);
          }

          // 计算日程相关值
          const schedule = activeUP.schedule || {};
          const programState = activeUP.program_state || {};
          const isRestDay = !isTodayTrainingDay(schedule, programState.last_training_date, programState.start_date);
          setIsRestDayValue(isRestDay);
          setNextTrainingDateValue(getNextTrainingDate(schedule, programState.last_training_date, programState.start_date));
          setDaysUntilStartValue(getDaysUntilStart(programState.start_date));
        }
      } else {
        setTodayWorkout(null);
        setIsRestDayValue(false);
        setNextTrainingDateValue('');
      }

      // 数据成功解析后，进行首次 URL Hash 路由解析
      if (!hasInitializedRef.current) {
        parseHashAndSetState(window.location.hash, allPrograms);
        hasInitializedRef.current = true;
      }

    } catch (err) {
      console.error(err);
      setError('无法加载配置或训练记录，请检查连接：' + err.message);
      setToast({ type: 'error', message: '数据加载失败！' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换活跃计划
  const switchActiveProgram = (programId) => {
    setActiveProgramId(programId);
    loadWorkoutData(programId);
  };

  // 乐观更新：立刻把 userPrograms state 中的某条记录打补丁，并同步联动 activeProgramId / todayWorkout
  // 单一真相源：App.jsx 的 userPrograms state 同步生效后，所有下游组件（PlanScreen、TodayScreen）同一帧内重渲染
  const optimisticUpdateUserProgram = (id, patch) => {
    setUserPrograms(prev => prev.map(up => up.id === id ? { ...up, ...patch } : up));
    if (patch.is_active === false) {
      setActiveProgramId(prev => (prev === id ? null : prev));
      setTodayWorkout(null);
      setIsRestDayValue(false);
      setNextTrainingDateValue('');
      setDaysUntilStartValue(0);
    } else if (patch.is_active === true) {
      setActiveProgramId(id);
    }
  };

  // 开始训练会话
  const startTrainSession = () => {
    if (!todayWorkout || !todayWorkout.exercises) return;

    const getSetExtraFields = (recordingMethod) => {
      switch (recordingMethod) {
        case 'duration_only': return { duration_seconds: 0 };
        case 'distance_only': return { distance_meters: 0 };
        case 'loaded_carry': return { distance_meters: 0 };
        default: return {};
      }
    };

    const setsData = {};
    todayWorkout.exercises.forEach((ex, idx) => {
      const method = exercisesMap[ex.exercise]?.recording_method || ex.recording_method || 'standard';
      const extra = getSetExtraFields(method);
      const isWarmupEx = ex.tier === 'warmup' || ex.tier === 'stretching';

      const warmupSets = (ex.warmup_sets || []).map((w, wIdx) => ({
        set_number: wIdx + 1,
        planned_reps: w.reps,
        actual_reps: w.reps,
        completed: false,
        weight_kg: w.weight,
        is_warmup: true,
        ...extra
      }));

      const workSets = Array.from({ length: ex.sets }, (_, setIdx) => ({
        set_number: warmupSets.length + setIdx + 1,
        planned_reps: ex.reps,
        actual_reps: (ex.amrap_last && setIdx === ex.sets - 1) ? '' : ex.reps,
        completed: false,
        weight_kg: ex.weight,
        is_warmup: isWarmupEx ? true : false,
        is_amrap: !!(ex.amrap_last && setIdx === ex.sets - 1),
        ...extra
      }));

      setsData[idx] = [...warmupSets, ...workSets]; // key = exercise index, supports multiple T3 per day
    });

    const d = new Date();
    const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSessionState({
      isActive: true,
      isMinimized: false,
      setsData,
      sessionDate,
      startTime: Date.now(),
      elapsedTime: 0,
      isPaused: false,
      sessionNotes: ''
    });
    updateNavigationState({ sessionActive: true, isMinimized: false });
  };

  const handleStartOrRestoreTrain = () => {
    if (sessionState.isActive) {
      updateNavigationState({ sessionActive: true, isMinimized: false });
    } else {
      startTrainSession();
    }
  };

  const handleCancelSession = () => {
    setSessionState({
      isActive: false,
      isMinimized: false,
      setsData: {},
      sessionDate: null,
      startTime: null,
      elapsedTime: 0,
      isPaused: false,
      sessionNotes: ''
    });
    setSetDetails({});
    setRestTimer({
      active: false,
      total: 90,
      remaining: 90,
      endTime: null
    });
    localStorage.removeItem('active_session_state');
    localStorage.removeItem('active_session_details');
    if (window.location.hash === '#session') {
      updateNavigationState({ sessionActive: false }, true);
    } else {
      updateNavigationState({ sessionActive: false });
    }
    setToast({ type: 'success', message: '已放弃本次训练数据。' });
  };

  // 跳过训练
  const handleSkipTraining = async (reason) => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram || !todayWorkout) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    const schedule = activeUP.schedule || {};
    const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date, activeUP.program_state?.start_date);
    
    const newState = {
      ...activeUP.program_state,
      current_day: nextDay,
      last_training_date: new Date().toISOString(),
      skipped_dates: [...(activeUP.program_state?.skipped_dates || []), {
        date: new Date().toISOString(),
        day_label: todayWorkout.dayLabel,
        reason: reason || '未记录'
      }].slice(-100)
    };
    
    await saveUserProgram(activeUP.id, null, { program_state: newState, updated_at: new Date().toISOString() });
    
    const nextDateStr = getNextTrainingDate(schedule, newState.last_training_date, newState.start_date);
    let toastMsg = `已跳过今日训练，下次训练日：${nextDay}`;
    if (nextDateStr) {
      toastMsg = `已跳过今日训练，下次训练日：${nextDateStr}`;
    }
    setToast({ type: 'info', message: toastMsg });
    await loadWorkoutData();
  };

  // 加练：启动训练会话（与正常训练日相同），打卡保存时自动推进 current_day
  const handleExtraTraining = async () => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram || !todayWorkout) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    // 不直接推进 current_day，而是启动训练会话让用户正常打卡
    setToast({ type: 'info', message: '加练模式已启动，完成打卡后训练进度将正常更新。' });
    startTrainSession();
  };

  // 保存训练记录
  const handleSaveSession = async (setDetails = {}) => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const setsData = sessionState.setsData;
    const getFinalReps = (setObj) => {
      if (setObj.actual_reps === '' || setObj.actual_reps === undefined) return setObj.planned_reps;
      return parseInt(setObj.actual_reps, 10);
    };

    const getRecordingMethod = (exerciseKey) => exercisesMap[exerciseKey]?.recording_method || 'standard';

    const validateLastSet = (lastSet, method) => {
      if (['standard', 'reps_only', 'bodyweight_added', 'bodyweight_assisted'].includes(method)) {
        const raw = lastSet.actual_reps;
        if (raw === '' || raw === undefined || raw === null) return false;
        const reps = parseInt(raw, 10);
        return !isNaN(reps) && reps >= 0;
      }
      if (method === 'duration_only') return lastSet.duration_seconds > 0;
      if (['distance_only', 'loaded_carry'].includes(method)) return lastSet.distance_meters > 0;
      return true;
    };

    const setsToInsert = [];
    const workoutRecords = [];
    const sessionId = createSessionId();
    const sessionDurationSeconds = Math.max(0, (sessionState.elapsedTime || 0) + (
      sessionState.isPaused
        ? 0
        : Math.floor((Date.now() - (sessionState.startTime || Date.now())) / 1000)
    ));
    let hasValidationError = false;
    let isFirstSetAdded = false;

    for (const [exIdx, tierEx] of (todayWorkout.exercises || []).entries()) {
      const tier = tierEx.tier || 'T1';
      const sets = setsData[exIdx] || [];
      if (sets.length === 0) continue;

      const method = getRecordingMethod(tierEx.exercise);
      const lastSet = sets[sets.length - 1];

      if (!validateLastSet(lastSet, method)) {
        setToast({ type: 'error', message: `打卡保存失败：${tier} 最后一组必须填写有效数据` });
        hasValidationError = true;
        break;
      }

      // workout summary record
      const record = {
        client_key: String(exIdx),
        training_day: todayWorkout.dayLabel,
        tier,
        exercise: tierEx.exercise,
        weight_kg: (lastSet && lastSet.weight_kg !== undefined && lastSet.weight_kg !== '') ? Number(lastSet.weight_kg) : tierEx.weight,
        program_id: activeProgram.id,
      };
      if (['standard', 'reps_only', 'bodyweight_added', 'bodyweight_assisted'].includes(method)) {
        record.planned_reps = tierEx.reps;
        const workSets = sets.filter(s => !s.is_warmup);
        if (tier === 'T2') {
          // T2: 存储所有组的实际总次数，需 ≥ threshold
          record.actual_last_set_reps = workSets.reduce((sum, s) => sum + getFinalReps(s), 0);
        } else {
          // T1 & T3: 存储所有组的最小次数，每组都必须 ≥ planned_reps (T1) 或 threshold (T3)
          record.actual_last_set_reps = workSets.length > 0 ? Math.min(...workSets.map(s => getFinalReps(s))) : 0;
        }
      } else if (method === 'duration_only') {
        record.actual_last_set_reps = lastSet.duration_seconds || 0;
      } else if (['distance_only', 'loaded_carry'].includes(method)) {
        record.actual_last_set_reps = lastSet.distance_meters || 0;
      }
      workoutRecords.push(record);

      // workout_sets detail records
      for (const [setIdx, s] of sets.entries()) {
        const setKey = `${tier}_${exIdx}_${setIdx}`;
        const detail = setDetails[setKey] || {};
        
        let finalNotes = detail.notes || null;
        if (!isFirstSetAdded) {
          if (sessionState.sessionNotes) {
            finalNotes = `[训练心得: ${sessionState.sessionNotes}]` + (detail.notes ? `\n${detail.notes}` : '');
          }
          isFirstSetAdded = true;
        }

        const base = {
          workout_client_key: String(exIdx),
          exercise: tierEx.exercise,
          tier,
          set_number: s.set_number,
          completed: s.completed,
          is_warmup: !!s.is_warmup,
          notes: finalNotes,
          rpe: detail.record_rpe !== false ? (detail.rpe ?? null) : null,
          tempo_eccentric: detail.record_tempo !== false ? (detail.tempo_eccentric ?? null) : null,
          tempo_pause_bottom: detail.record_tempo !== false ? (detail.tempo_pause_bottom ?? null) : null,
          tempo_concentric: detail.record_tempo !== false ? (detail.tempo_concentric ?? null) : null,
          tempo_pause_top: detail.record_tempo !== false ? (detail.tempo_pause_top ?? null) : null,
          rest_duration: detail.rest_duration ?? null,
        };
        if (['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(method)) {
          base.weight_kg = s.weight_kg;
          base.planned_reps = s.planned_reps;
          base.actual_reps = getFinalReps(s);
        } else if (method === 'reps_only') {
          base.planned_reps = s.planned_reps;
          base.actual_reps = getFinalReps(s);
        } else if (method === 'duration_only') {
          base.duration_seconds = s.duration_seconds || 0;
        } else if (method === 'distance_only') {
          base.distance_meters = s.distance_meters || 0;
        } else if (method === 'loaded_carry') {
          base.weight_kg = s.weight_kg;
          base.distance_meters = s.distance_meters || 0;
        } else {
          base.weight_kg = s.weight_kg;
          base.planned_reps = s.planned_reps;
          base.actual_reps = getFinalReps(s);
        }
        setsToInsert.push(base);
      }
    }

    if (hasValidationError) return;

    try {
      // ============== 任务 6: 自动推算 + 写入 one_rm_records ==============
      // 规则: 4 个主项 (squat/bench/deadlift/press) T1 高强度组 (reps ≤ 5) 自动推算 1RM
      // 过滤: 如果新 e1rm < 当前 latest × 0.9, 视为脏数据跳过
      const todayISO = sessionState.sessionDate || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      const candidates = [];
      (todayWorkout.exercises || []).forEach((tierEx, exIdx) => {
        const liftKey = tierEx.exercise;
        if (!MAIN_LIFT_KEYS.includes(liftKey)) return;
        const tier = tierEx.tier || 'T1';
        const sets = setsData[exIdx] || [];
        const workSets = sets.filter(s => !s.is_warmup);
        const lastSet = workSets[workSets.length - 1];
        if (!lastSet) return;
        const w = Number(lastSet.weight_kg) || 0;
        const r = Number(lastSet.actual_reps) || 0;
        if (w <= 0 || r <= 0) return;
        const isHighIntensity = tier === 'T1' || r <= 5;
        if (!isHighIntensity) return;
        const result = calcE1RM(w, r);
        if (!result.valid || result.e1rm <= 0) return;
        candidates.push({
          workout_client_key: String(exIdx),
          exercise: liftKey,
          date: todayISO,
          weight_kg: w,
          reps: r,
          e1rm_kg: result.e1rm,
          formula: result.formula,
          source: 'auto_from_workout',
        });
      });

      let oneRmRecords = [];
      if (candidates.length > 0) {
        try {
          const latestData = await fetchLatestOneRmForExercises(candidates.map(c => c.exercise));
          const latestByLift = {};
          (latestData || []).forEach(r => {
            if (!latestByLift[r.exercise]) {
              latestByLift[r.exercise] = r;
            }
          });

          const getDaysBetween = (d1Str, d2Str) => {
            if (!d1Str || !d2Str) return 0;
            const d1 = new Date(d1Str);
            const d2 = new Date(d2Str);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(0, 0, 0, 0);
            return Math.abs(Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)));
          };

          oneRmRecords = candidates.filter(c => {
            const cur = latestByLift[c.exercise];
            if (!cur) return true;

            const daysDiff = getDaysBetween(c.date, cur.date);
            if (daysDiff > 15) return true;
            return c.e1rm_kg >= cur.e1rm_kg * 0.9;
          });
        } catch (e) {
          // 1RM 过滤失败不阻塞主流程；本次训练仍会事务化保存
          console.warn('自动推算 1RM 流程出错 (非阻塞):', e.message);
        }
      }

      const schedule = activeUP.schedule || {};
      const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date, activeUP.program_state?.start_date);
      const newState = {
        ...activeUP.program_state,
        current_day: nextDay,
        last_training_date: new Date().toISOString()
      };
      const updatedAt = new Date().toISOString();

      await completeWorkoutSession({
        session_id: sessionId,
        session_duration_seconds: sessionDurationSeconds,
        user_program_id: activeUP.id,
        program_state: newState,
        updated_at: updatedAt,
        workout_records: workoutRecords,
        workout_sets: setsToInsert,
        one_rm_records: oneRmRecords
      });

      const nextDateStr = getNextTrainingDate(schedule, newState.last_training_date, newState.start_date);
      let toastMsg = `保存成功！下次训练日为 ${nextDay}`;
      if (nextDateStr) {
        toastMsg = `保存成功！下次训练日为 ${nextDateStr}`;
      }
      setToast({ type: 'success', message: toastMsg });

      setSessionState({
        isActive: false,
        isMinimized: false,
        setsData: {},
        sessionDate: null,
        startTime: null,
        elapsedTime: 0,
        isPaused: false,
        sessionNotes: ''
      });
      setSetDetails({});
      setRestTimer({
        active: false,
        total: 90,
        remaining: 90,
        endTime: null
      });
      localStorage.removeItem('active_session_state');
      localStorage.removeItem('active_session_details');

      if (window.location.hash === '#session') {
        updateNavigationState({ sessionActive: false }, true);
      } else {
        updateNavigationState({ sessionActive: false });
      }

      await loadWorkoutData();
    } catch (err) {
      console.error('保存训练记录失败：', err);
      setToast({ type: 'error', message: '保存记录失败：' + err.message });
    } finally {
      // no-op
    }
  };

  const getCurrentSetProgress = (setsData, exercises) => {
    if (!setsData || !exercises || exercises.length === 0) return '';
    
    const getAbbreviatedName = (name) => {
      if (!name) return '';
      let cleaned = name.replace(/杠铃|哑铃|坐姿|站姿|俯身|俯立|单臂|双臂|平板|上斜|下斜|绳索/g, '');
      return cleaned.length > 3 ? cleaned.slice(0, 3) : cleaned;
    };

    for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
      const ex = exercises[exIdx];
      const sets = setsData[exIdx] || [];
      const firstUncompletedIdx = sets.findIndex(s => !s.completed && !s.skipped);
      
      if (firstUncompletedIdx !== -1) {
        const set = sets[firstUncompletedIdx];
        const cnName = getExerciseCNName(ex.exercise) || ex.exercise;
        const shortName = getAbbreviatedName(cnName);
        
        const isWarmup = !!set.is_warmup;
        const warmupCount = sets.filter(s => s.is_warmup).length;
        const displaySetNum = isWarmup ? `W${set.set_number}` : `${set.set_number - warmupCount}`;
        
        return `${shortName} ${displaySetNum}`;
      }
    }
    return '已完结';
  };

  const getExerciseCNName = (exercise) => getCNName(exercise, exercisesMap);

  const getActiveProgram = () => {
    if (!activeProgramId) return null;
    const up = userPrograms.find(u => u.id === activeProgramId);
    if (!up) return null;
    return programs.find(p => p.id === up.program_id) || null;
  };

  const getActiveUserProgram = () => {
    return userPrograms.find(u => u.id === activeProgramId) || null;
  };

  const activeUserPrograms = userPrograms.filter(up => up.is_active);

  return (
    <div className="min-h-screen flex flex-col max-w-[480px] w-full mx-auto bg-bg-main dark:bg-bg-main-dark text-text-main dark:text-text-main-dark border-x border-border-card dark:border-border-card-dark shadow-2xl relative transition-colors duration-200">
      {toast && (
        <div className="toast toast-top toast-center z-[9999] min-w-[320px] max-w-[440px] px-4" style={{ top: '1.5rem' }}>
          <div className={`shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 border ${
            toast.type === 'success' ? 'bg-success-bg border-success/40 text-success' :
            toast.type === 'error' ? 'bg-error-bg border-error/40 text-error' :
            'bg-info-bg border-info/40 text-info'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle size={18} className="shrink-0" />
              : toast.type === 'error'
                ? <AlertTriangle size={18} className="shrink-0" />
                : <SkipForward size={18} className="shrink-0" />}
            <span className="text-sm font-semibold break-words text-left">{toast.message}</span>
          </div>
        </div>
      )}

      <ErrorBoundary>
        <main className="flex-1 pt-8 pb-24 px-5 w-full flex flex-col gap-6">

        {/* TAB 1: 今日训练 — 仅当前 tab 挂载，避免隐藏组件持续运行副作用 */}
        {activeTab === 'today' && (
          loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-4">
              <span className="loading loading-spinner text-primary loading-lg"></span>
              <p className="text-sm font-semibold">正在加载训练数据...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-error dark:text-error gap-4 p-6 text-center">
              <AlertTriangle size={48} className="text-error" />
              <p className="text-sm font-bold max-w-xs">{error}</p>
              <button type="button" className="btn btn-primary px-6 mt-2 font-bold cursor-pointer" onClick={loadWorkoutData}>
                重新尝试
              </button>
            </div>
          ) : (
            <Suspense fallback={<ScreenFallback label="正在加载今日..." />}>
              <TodayScreen
                activeProgram={getActiveProgram()}
                activeUserProgram={getActiveUserProgram()}
                activeUserPrograms={activeUserPrograms}
                programs={programs}
                todayWorkout={todayWorkout}
                exercisesMap={exercisesMap}
                sessionState={sessionState}
                onStartTrain={handleStartOrRestoreTrain}
                onOpenPreview={() => setPreviewOpen(true)}
                onSwitchProgram={switchActiveProgram}
                onGoToLibrary={() => setActiveTab('plan')}
                getExerciseCNName={getExerciseCNName}
                isTodayCompleted={isTodayCompleted && !sessionState.isActive}
                todayWorkoutSummary={todayWorkoutSummary}
                isRestDay={isRestDayValue}
                nextTrainingDate={nextTrainingDateValue}
                onSkipTraining={handleSkipTraining}
                onExtraTraining={handleExtraTraining}
                daysUntilStart={daysUntilStartValue}
                userProfile={userProfile}
                todayBodyMetrics={todayBodyMetrics}
                onRefreshBodyMetrics={loadWorkoutData}
                userNutritionConfig={userNutritionConfig}
                todayDietLog={todayDietLog}
                onRefreshDiet={loadWorkoutData}
                isRestDayValue={isRestDayValue}
              />
            </Suspense>
          )
        )}

        {/* TAB 2: 计划库 */}
        {activeTab === 'plan' && (
          <Suspense fallback={<ScreenFallback label="正在加载计划..." />}>
            <PlanScreen
              programs={programs}
              userPrograms={userPrograms}
              exercisesMap={exercisesMap}
              gymEquipmentConfig={gymEquipmentConfig}
              optimisticUpdateUserProgram={optimisticUpdateUserProgram}
              isOperationLocked={isOperationLocked}
              selectedProgram={selectedProgram}
              setSelectedProgram={(prog) => updateNavigationState({ selectedProgram: prog })}
              selectedActiveProgramId={selectedActiveProgramId}
              setSelectedActiveProgramId={(id) => updateNavigationState({ selectedActiveProgramId: id })}
              configProgram={configProgram}
              setConfigProgram={(prog) => updateNavigationState({ configProgram: prog })}
              onProgramStarted={() => {
                setToast({ type: 'success', message: '计划已启用！' });
                updateNavigationState({ tab: 'today' });
                loadWorkoutData();
              }}
              onProgramPaused={(userProgramId) => {
                optimisticUpdateUserProgram(userProgramId, { is_active: false, paused_at: new Date().toISOString() });
                setToast({ type: 'info', message: '计划已暂停。' });
                loadWorkoutData(null);
              }}
              onProgramResumed={(userProgramId) => {
                optimisticUpdateUserProgram(userProgramId, { is_active: true, paused_at: null });
                setToast({ type: 'success', message: '计划已恢复。' });
                updateNavigationState({ tab: 'today' });
                loadWorkoutData(userProgramId);
              }}
              onProgramEnded={(userProgramId) => {
                optimisticUpdateUserProgram(userProgramId, { is_active: false, ended_at: new Date().toISOString() });
                setToast({ type: 'info', message: '计划已结束，训练历史已保留。' });
                updateNavigationState({ tab: 'plan' });
                loadWorkoutData(null);
              }}
              onProgramError={(message) => {
                setToast({ type: 'error', message });
              }}
            />
          </Suspense>
        )}

        {/* TAB 3: 饮食 */}
        {activeTab === 'diet' && (
          <Suspense fallback={<ScreenFallback label="正在加载饮食..." />}>
            <DietScreen
              userProfile={userProfile}
              userNutritionConfig={userNutritionConfig}
              todayBodyMetrics={todayBodyMetrics}
              isRestDay={isRestDayValue}
              onRefreshDiet={loadWorkoutData}
            />
          </Suspense>
        )}

        {/* TAB 4: 数据 */}
        {activeTab === 'data' && (
          <Suspense fallback={<ScreenFallback label="正在加载数据..." />}>
            <DataScreen getExerciseCNName={getExerciseCNName} />
          </Suspense>
        )}

        {/* TAB 5: 我的 */}
        {activeTab === 'me' && (
          <Suspense fallback={<ScreenFallback label="正在加载设置..." />}>
            <MyPage
              themeMode={themeMode}
              onThemeModeChange={setThemeMode}
              onReOnboard={() => setShowOnboarding(true)}
              onOpenLibrary={() => setActiveTab('plan')}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              gymEquipmentConfig={gymEquipmentConfig}
              setGymEquipmentConfig={setGymEquipmentConfig}
              onRefreshProfile={loadWorkoutData}
              onAuthChange={() => {
                clearEnsureUserCache();
                setCurrentUserId(null);
                loadWorkoutData();
              }}
            />
          </Suspense>
        )}
        </main>
      </ErrorBoundary>

      {/* 底部导航 */}
      <div className="dock fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-bg-card/90 dark:bg-bg-card-dark/90 border-t border-border-card dark:border-border-card-dark backdrop-blur h-16">
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'today' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'today' })}
        >
          <Dumbbell size={22} />
          <span className="dock-label text-xs font-bold">今日</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'plan' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'plan' })}
        >
          <ClipboardList size={22} />
          <span className="dock-label text-xs font-bold">训练</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'diet' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'diet' })}
        >
          <UtensilsCrossed size={22} />
          <span className="dock-label text-xs font-bold">饮食</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'data' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'data' })}
        >
          <ChartColumnIncreasing size={22} />
          <span className="dock-label text-xs font-bold">数据</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'me' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'me' })}
        >
          <User size={22} />
          <span className="dock-label text-xs font-bold">我的</span>
        </button>
      </div>

      {/* 训练会话覆盖层 */}
      {sessionState.isActive && (
        <div style={{ display: sessionState.isMinimized ? 'none' : 'block' }}>
          <Suspense fallback={<ScreenFallback label="正在加载训练..." />}>
            <TrainSession
              currentDay={todayWorkout?.dayLabel || ''}
              sessionState={sessionState}
              setSessionState={setSessionState}
              todayWorkout={todayWorkout}
              setTodayWorkout={setTodayWorkout}
              exercisesMap={exercisesMap}
              getExerciseCNName={getExerciseCNName}
              setDetails={setDetails}
              setSetDetails={setSetDetails}
              showSetCard={showSetCard}
              focusedSet={focusedSet}
              openSetCard={openSetCard}
              closeSetCard={closeSetCard}
              onMinimize={() => {
                if (window.location.hash === '#session') {
                  window.history.back();
                } else {
                  updateNavigationState({ isMinimized: true });
                }
              }}
              onSave={handleSaveSession}
              onCancel={handleCancelSession}
              gymEquipmentConfig={gymEquipmentConfig}
              unit={getActiveUserProgram()?.exercise_config?._unit || 'kg'}
              restTimer={restTimer}
              setRestTimer={setRestTimer}
            />
          </Suspense>
        </div>
      )}

      {/* 悬浮球 */}
      {sessionState.isActive && sessionState.isMinimized && (
        <Suspense fallback={null}>
          <FloatingBall
            progress={getCurrentSetProgress(sessionState.setsData, todayWorkout?.exercises)}
            restTimer={restTimer}
            onRestore={() => updateNavigationState({ sessionActive: true, isMinimized: false })}
            onCancel={handleCancelSession}
          />
        </Suspense>
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingScreen
            onComplete={() => {
              setShowOnboarding(false);
              setToast({ type: 'success', message: '画像保存成功！请在计划库中选择一个训练计划。' });
              loadWorkoutData();
            }}
            onSkip={() => {
              setShowOnboarding(false);
              setToast({ type: 'success', message: '已跳过引导，您可随时在计划库中选择训练计划。' });
              loadWorkoutData();
            }}
          />
        </Suspense>
      )}

      {/* 今日训练预览弹窗 */}
      {previewOpen && (
        <Suspense fallback={null}>
          <WorkoutPreviewModal
            isOpen={previewOpen}
            onClose={() => {
              if (window.location.hash === '#preview') {
                window.history.back();
              } else {
                updateNavigationState({ previewOpen: false });
              }
            }}
            onStartTrain={() => {
              if (window.location.hash === '#preview') {
                window.history.back();
              } else {
                updateNavigationState({ previewOpen: false });
              }
              handleStartOrRestoreTrain();
            }}
            todayWorkout={todayWorkout}
            getExerciseCNName={getExerciseCNName}
            gymEquipmentConfig={gymEquipmentConfig}
            exercisesMap={exercisesMap}
            unit={getActiveUserProgram()?.exercise_config?._unit || 'kg'}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
