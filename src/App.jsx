import { useState, useEffect, useRef } from 'react';
import { fetchActivePrograms, fetchAllUserPrograms, fetchExercises, saveUserProgram } from './services/programService';
import { fetchUserProfile } from './services/profileService';
import { fetchBodyMetrics } from './services/bodyService';
import { fetchDietLog, fetchActiveUserNutritionConfig } from './services/dietService';
import {
  fetchProgramWorkoutsHistory,
  fetchTodayWorkouts,
  saveWorkout,
  saveWorkoutSets,
  fetchLatestOneRmForExercises,
  saveOneRmRecords
} from './services/workoutService';
import { getNextWorkout, getNextDay, isTodayTrainingDay, getNextTrainingDate, getDaysUntilStart } from './programEngine';
import { calcE1RM } from './oneRmUtils';
import { DEFAULT_GYM_EQUIPMENT_CONFIG } from './unitUtils';
import { getCNName } from './exerciseNames';
import TodayScreen from './TodayScreen';
import PlanScreen from './PlanScreen';
import DataScreen from './DataScreen';
import MyPage from './MyPage';
import DietScreen from './DietScreen';
import TrainSession from './TrainSession';
import FloatingBall from './FloatingBall';
import OnboardingScreen from './OnboardingScreen';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import {
  CheckCircle,
  AlertTriangle,
  SkipForward
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('today');

  const [themeMode, setThemeMode] = useState(() => {
    const savedThemeMode = localStorage.getItem('theme_mode');
    return savedThemeMode || 'system';
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

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
      setsData: {}
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

  useEffect(() => {
    localStorage.setItem('active_session_state', JSON.stringify(sessionState));
  }, [sessionState]);

  useEffect(() => {
    localStorage.setItem('active_session_details', JSON.stringify(setDetails));
  }, [setDetails]);

  // 训练预览弹窗
  const [previewOpen, setPreviewOpen] = useState(false);

  // 提升的计划库子界面状态
  const [configProgram, setConfigProgram] = useState(null);
  const [selectedActiveProgramId, setSelectedActiveProgramId] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);

  // 初始化标记
  const hasInitializedRef = useRef(false);

  // 操作锁定：训练中或预览弹窗打开时，禁止在 PlanScreen 结束/暂停计划
  const isOperationLocked = sessionState.isActive || previewOpen;

  // URL Hash 解析器，根据 URL 状态初始化页面
  const parseHashAndSetState = (hash, allPrograms) => {
    const cleanHash = hash.replace('#', '');
    const currentPrograms = allPrograms || programs;
    
    if (!cleanHash) {
      setActiveTab('today');
      window.history.replaceState({
        tab: 'today',
        configProgramId: null,
        selectedActiveProgramId: null,
        selectedProgramId: null,
        sessionActive: false,
        isMinimized: false,
        previewOpen: false
      }, '', '#today');
      return;
    }

    const parts = cleanHash.split('/');
    const mainTab = parts[0];
    const validTabs = ['today', 'plan', 'diet', 'data', 'me'];

    if (validTabs.includes(mainTab)) {
      setActiveTab(mainTab);
      
      let configProg = null;
      let selActiveId = null;
      let selProg = null;

      if (mainTab === 'plan' && parts[1]) {
        const subView = parts[1];
        const id = parts[2];
        if (subView === 'config' && id) {
          configProg = currentPrograms.find(p => p.id === id) || null;
          setConfigProgram(configProg);
        } else if (subView === 'active' && id) {
          selActiveId = id;
          setSelectedActiveProgramId(id);
        } else if (subView === 'detail' && id) {
          selProg = currentPrograms.find(p => p.id === id) || null;
          setSelectedProgram(selProg);
        }
      }

      window.history.replaceState({
        tab: mainTab,
        configProgramId: configProg ? configProg.id : null,
        selectedActiveProgramId: selActiveId,
        selectedProgramId: selProg ? selProg.id : null,
        sessionActive: sessionState.isActive,
        isMinimized: sessionState.isMinimized,
        previewOpen: false
      }, '', hash);
    } else if (cleanHash === 'session') {
      const savedSession = localStorage.getItem('active_session_state');
      let isSessionActive = false;
      let isSessionMinimized = false;
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          isSessionActive = !!parsed.isActive;
          isSessionMinimized = !!parsed.isMinimized;
        } catch {}
      }

      if (isSessionActive && !isSessionMinimized) {
        setActiveTab('today');
        window.history.replaceState({
          tab: 'today',
          configProgramId: null,
          selectedActiveProgramId: null,
          selectedProgramId: null,
          sessionActive: true,
          isMinimized: false,
          previewOpen: false
        }, '', '#session');
      } else {
        setActiveTab('today');
        window.history.replaceState({
          tab: 'today',
          configProgramId: null,
          selectedActiveProgramId: null,
          selectedProgramId: null,
          sessionActive: false,
          isMinimized: false,
          previewOpen: false
        }, '', '#today');
      }
    } else if (cleanHash === 'preview') {
      setActiveTab('today');
      setPreviewOpen(true);
      window.history.replaceState({
        tab: 'today',
        configProgramId: null,
        selectedActiveProgramId: null,
        selectedProgramId: null,
        sessionActive: false,
        isMinimized: false,
        previewOpen: true
      }, '', '#preview');
    } else {
      setActiveTab('today');
      window.history.replaceState({
        tab: 'today',
        configProgramId: null,
        selectedActiveProgramId: null,
        selectedProgramId: null,
        sessionActive: false,
        isMinimized: false,
        previewOpen: false
      }, '', '#today');
    }
  };

  // 全局路由与历史记录同步更新器
  const updateNavigationState = (updates, replace = false) => {
    const nextTab = updates.hasOwnProperty('tab') ? updates.tab : activeTab;
    
    let nextConfigProgram = configProgram;
    if (updates.hasOwnProperty('configProgram')) {
      nextConfigProgram = updates.configProgram;
    }
    
    let nextSelectedActiveProgramId = selectedActiveProgramId;
    if (updates.hasOwnProperty('selectedActiveProgramId')) {
      nextSelectedActiveProgramId = updates.selectedActiveProgramId;
    }
    
    let nextSelectedProgram = selectedProgram;
    if (updates.hasOwnProperty('selectedProgram')) {
      nextSelectedProgram = updates.selectedProgram;
    }
    
    let nextPreviewOpen = previewOpen;
    if (updates.hasOwnProperty('previewOpen')) {
      nextPreviewOpen = updates.previewOpen;
    }
    
    let nextSessionActive = sessionState.isActive;
    let nextSessionMinimized = sessionState.isMinimized;
    if (updates.hasOwnProperty('sessionActive')) {
      nextSessionActive = updates.sessionActive;
    }
    if (updates.hasOwnProperty('isMinimized')) {
      nextSessionMinimized = updates.isMinimized;
    }

    // 更新 React 状态
    if (updates.hasOwnProperty('tab')) {
      setActiveTab(updates.tab);
      if (updates.tab !== 'plan') {
        setConfigProgram(null);
        setSelectedActiveProgramId(null);
        setSelectedProgram(null);
        nextConfigProgram = null;
        nextSelectedActiveProgramId = null;
        nextSelectedProgram = null;
      }
    }
    if (updates.hasOwnProperty('configProgram')) {
      setConfigProgram(updates.configProgram);
    }
    if (updates.hasOwnProperty('selectedActiveProgramId')) {
      setSelectedActiveProgramId(updates.selectedActiveProgramId);
    }
    if (updates.hasOwnProperty('selectedProgram')) {
      setSelectedProgram(updates.selectedProgram);
    }
    if (updates.hasOwnProperty('previewOpen')) {
      setPreviewOpen(updates.previewOpen);
    }
    if (updates.hasOwnProperty('sessionActive') || updates.hasOwnProperty('isMinimized')) {
      setSessionState(prev => ({
        ...prev,
        isActive: nextSessionActive,
        isMinimized: nextSessionMinimized
      }));
    }

    // 计算 URL Hash
    let hash = `#${nextTab}`;
    if (nextSessionActive && !nextSessionMinimized) {
      hash = '#session';
    } else if (nextPreviewOpen) {
      hash = '#preview';
    } else if (nextTab === 'plan') {
      if (nextConfigProgram) {
        hash = `#plan/config/${nextConfigProgram.id}`;
      } else if (nextSelectedActiveProgramId) {
        hash = `#plan/active/${nextSelectedActiveProgramId}`;
      } else if (nextSelectedProgram) {
        hash = `#plan/detail/${nextSelectedProgram.id}`;
      }
    }

    // 构建历史状态对象
    const historyState = {
      tab: nextTab,
      configProgramId: nextConfigProgram ? nextConfigProgram.id : null,
      selectedActiveProgramId: nextSelectedActiveProgramId,
      selectedProgramId: nextSelectedProgram ? nextSelectedProgram.id : null,
      sessionActive: nextSessionActive,
      isMinimized: nextSessionMinimized,
      previewOpen: nextPreviewOpen
    };

    if (replace) {
      window.history.replaceState(historyState, '', hash);
    } else if (window.location.hash !== hash) {
      window.history.pushState(historyState, '', hash);
    }
  };

  // 监听浏览器前进、后退操作 (Popstate)
  useEffect(() => {
    if (loading) return;

    const handlePopState = (event) => {
      const state = event.state;
      if (!state) {
        parseHashAndSetState(window.location.hash);
        return;
      }

      // 如果处于最大化的训练界面，且后退试图退出训练界面 -> 则进行【最小化】处理而不丢弃数据
      if (sessionState.isActive && !sessionState.isMinimized && !state.sessionActive) {
        setSessionState(prev => ({
          ...prev,
          isMinimized: true
        }));
        
        window.history.replaceState({
          ...state,
          sessionActive: true,
          isMinimized: true
        }, '', window.location.hash);
        
        setActiveTab(state.tab || 'today');
        
        const resolvedConfigProg = state.configProgramId ? programs.find(p => p.id === state.configProgramId) : null;
        const resolvedSelProg = state.selectedProgramId ? programs.find(p => p.id === state.selectedProgramId) : null;
        setConfigProgram(resolvedConfigProg);
        setSelectedActiveProgramId(state.selectedActiveProgramId);
        setSelectedProgram(resolvedSelProg);
        setPreviewOpen(!!state.previewOpen);
        return;
      }

      // 正常恢复其他状态
      setActiveTab(state.tab || 'today');
      
      const resolvedConfigProg = state.configProgramId ? programs.find(p => p.id === state.configProgramId) : null;
      const resolvedSelProg = state.selectedProgramId ? programs.find(p => p.id === state.selectedProgramId) : null;
      
      setConfigProgram(resolvedConfigProg);
      setSelectedActiveProgramId(state.selectedActiveProgramId);
      setSelectedProgram(resolvedSelProg);
      setPreviewOpen(!!state.previewOpen);

      setSessionState(prev => ({
        ...prev,
        isActive: !!state.sessionActive,
        isMinimized: !!state.isMinimized
      }));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loading, programs, sessionState.isActive, sessionState.isMinimized, activeTab, configProgram, selectedActiveProgramId, selectedProgram, previewOpen]);

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
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
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

          const result = getNextWorkout(activeProgram, activeUP, histByExTier, parsedConfig, exMap);
          setTodayWorkout(result);

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
      const method = exercisesMap[ex.exercise]?.recording_method || 'standard';
      const extra = getSetExtraFields(method);
      const sets = Array.from({ length: ex.sets }, (_, setIdx) => ({
        set_number: setIdx + 1,
        planned_reps: ex.reps,
        actual_reps: ex.amrap_last ? '' : ex.reps,
        completed: false,
        weight_kg: ex.weight,
        ...extra
      }));
      setsData[idx] = sets; // key = exercise index, supports multiple T3 per day
    });

    const d = new Date();
    const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSessionState({
      isActive: true,
      isMinimized: false,
      setsData,
      sessionDate
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
      sessionDate: null
    });
    setSetDetails({});
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
    let hasValidationError = false;

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
        training_day: todayWorkout.dayLabel,
        tier,
        exercise: tierEx.exercise,
        weight_kg: (lastSet && lastSet.weight_kg !== undefined && lastSet.weight_kg !== '') ? Number(lastSet.weight_kg) : tierEx.weight,
        program_id: activeProgram.id,
      };
      if (['standard', 'reps_only', 'bodyweight_added', 'bodyweight_assisted'].includes(method)) {
        record.planned_reps = tierEx.reps;
        if (tier === 'T2') {
          // T2: 存储所有组的实际总次数，需 ≥ threshold
          record.actual_last_set_reps = sets.reduce((sum, s) => sum + getFinalReps(s), 0);
        } else {
          // T1 & T3: 存储所有组的最小次数，每组都必须 ≥ planned_reps (T1) 或 threshold (T3)
          record.actual_last_set_reps = Math.min(...sets.map(s => getFinalReps(s)));
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
        const base = {
          exercise: tierEx.exercise,
          tier,
          set_number: s.set_number,
          completed: s.completed,
          notes: detail.notes || null,
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
      // 先插入 workouts，以便获取返回的 id 并关联到 workout_sets 和 one_rm_records
      const createdWorkouts = await saveWorkout(workoutRecords);

      const updatedSetsToInsert = setsToInsert.map(s => {
        const parent = (createdWorkouts || []).find(w => w.exercise === s.exercise && w.tier === s.tier);
        return {
          ...s,
          workout_id: parent?.id || null
        };
      });

      await saveWorkoutSets(updatedSetsToInsert);

      // ============== 任务 6: 自动推算 + 写入 one_rm_records ==============
      // 规则: 4 个主项 (squat/bench/deadlift/press) T1 高强度组 (reps ≤ 5) 自动推算 1RM
      // 过滤: 如果新 e1rm < 当前 latest × 0.9, 视为脏数据跳过
      const MAIN_LIFTS = ['squat', 'bench', 'deadlift', 'press'];
      const todayISO = sessionState.sessionDate || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      // 收集符合条件的主项 e1rm 候选
      const candidates = [];
      (todayWorkout.exercises || []).forEach((tierEx, exIdx) => {
        const liftKey = tierEx.exercise;
        if (!MAIN_LIFTS.includes(liftKey)) return;
        const tier = tierEx.tier || 'T1';
        const sets = setsData[exIdx] || [];
        const lastSet = sets[sets.length - 1];
        if (!lastSet) return;
        const w = Number(lastSet.weight_kg) || 0;
        const r = Number(lastSet.actual_reps) || 0;
        if (w <= 0 || r <= 0) return;
        // 强度门槛：T1 或者 reps ≤ 5
        const isHighIntensity = tier === 'T1' || r <= 5;
        if (!isHighIntensity) return;
        const result = calcE1RM(w, r);
        if (!result.valid || result.e1rm <= 0) return;
        candidates.push({
          exercise: liftKey,
          date: todayISO,
          weight_kg: w,
          reps: r,
          e1rm_kg: result.e1rm,
          formula: result.formula,
          source: 'auto_from_workout',
        });
      });

      if (candidates.length > 0) {
        try {
          // 拉取每个主项当前最新 1RM 用于过滤
          const latestData = await fetchLatestOneRmForExercises(candidates.map(c => c.exercise));

          // 按最新 date 取出每一个 exercise 的记录
          const latestByLift = {};
          (latestData || []).forEach(r => {
            // 因为已经在后端 order('date', { ascending: false })，所以第一条遇到的就是最新的记录
            if (!latestByLift[r.exercise]) {
              latestByLift[r.exercise] = r;
            }
          });

          // 计算两个 YYYY-MM-DD 字符串之间的天数差
          const getDaysBetween = (d1Str, d2Str) => {
            if (!d1Str || !d2Str) return 0;
            const d1 = new Date(d1Str);
            const d2 = new Date(d2Str);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(0, 0, 0, 0);
            return Math.abs(Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)));
          };

          // 过滤: 新 e1rm ≥ current × 90% 才写入
          // 重新设计：如果与最近的一条记录相差 > 15 天，认为可能处于停练/力量衰退，直接通过不拦截；在 15 天以内，则应用 0.9 过滤以防输入失误。
          const filtered = candidates.filter(c => {
            const cur = latestByLift[c.exercise];
            if (!cur) return true; // 无历史，直接写入
            
            const daysDiff = getDaysBetween(c.date, cur.date);
            if (daysDiff > 15) {
              return true; // 超过 15 天，退化保护激活，免于 0.9 过滤限制
            }
            return c.e1rm_kg >= cur.e1rm_kg * 0.9;
          });

          if (filtered.length > 0) {
            const workoutMap = {};
            (createdWorkouts || []).forEach(w => {
              if (!workoutMap[w.exercise]) workoutMap[w.exercise] = w.id;
            });

            const rowsToInsert = filtered.map(c => ({
              ...c,
              source_workout_id: workoutMap[c.exercise] || null,
            }));

            await saveOneRmRecords(rowsToInsert);
          }
        } catch (e) {
          // 1RM 写入失败不阻塞主流程
          console.warn('自动推算 1RM 流程出错 (非阻塞):', e.message);
        }
      }

      // 更新 user_programs 的 program_state
      const schedule = activeUP.schedule || {};
      const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date, activeUP.program_state?.start_date);
      const newState = {
        ...activeUP.program_state,
        current_day: nextDay,
        last_training_date: new Date().toISOString()
      };
      await saveUserProgram(activeUP.id, null, { program_state: newState, updated_at: new Date().toISOString() });

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
        sessionDate: null
      });
      setSetDetails({});
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

  const getSessionProgress = (setsData) => {
    if (!setsData) return '';
    let completed = 0;
    let total = 0;
    Object.keys(setsData).forEach(key => {
      const sets = setsData[key] || [];
      total += sets.length;
      completed += sets.filter(s => s.completed).length;
    });
    return `${completed}/${total}`;
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

      <main className="flex-1 pt-8 pb-24 px-5 w-full flex flex-col gap-6">

        {/* TAB 1: 今日训练 */}
        <div style={{ display: activeTab === 'today' ? 'block' : 'none' }}>
          {loading ? (
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
          )}
        </div>

        {/* TAB 2: 计划库 */}
        <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
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
        </div>

        {/* TAB 3: 饮食 */}
        <div style={{ display: activeTab === 'diet' ? 'block' : 'none' }}>
          <DietScreen
            userProfile={userProfile}
            userNutritionConfig={userNutritionConfig}
            todayBodyMetrics={todayBodyMetrics}
            isRestDay={isRestDayValue}
            onRefreshDiet={loadWorkoutData}
          />
        </div>

        {/* TAB 4: 数据 */}
        <div style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
          <DataScreen getExerciseCNName={getExerciseCNName} />
        </div>

        {/* TAB 5: 我的 */}
        <div style={{ display: activeTab === 'me' ? 'block' : 'none' }}>
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
          />
        </div>
      </main>

      {/* 底部导航 */}
      <div className="dock fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-bg-card/90 dark:bg-bg-card-dark/90 border-t border-border-card dark:border-border-card-dark backdrop-blur h-16">
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'today' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'today' })}
        >
          <span className="text-xl">🏋️</span>
          <span className="dock-label text-xs font-bold">今日</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'plan' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'plan' })}
        >
          <span className="text-xl">📋</span>
          <span className="dock-label text-xs font-bold">训练</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'diet' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'diet' })}
        >
          <span className="text-xl">🍎</span>
          <span className="dock-label text-xs font-bold">饮食</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'data' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'data' })}
        >
          <span className="text-xl">📊</span>
          <span className="dock-label text-xs font-bold">数据</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'me' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => updateNavigationState({ tab: 'me' })}
        >
          <span className="text-xl">👤</span>
          <span className="dock-label text-xs font-bold">我的</span>
        </button>
      </div>

      {/* 训练会话覆盖层 */}
      {sessionState.isActive && (
        <div style={{ display: sessionState.isMinimized ? 'none' : 'block' }}>
          <TrainSession
            currentDay={todayWorkout?.dayLabel || ''}
            sessionState={sessionState}
            setSessionState={setSessionState}
            todayWorkout={todayWorkout}
            exercisesMap={exercisesMap}
            getExerciseCNName={getExerciseCNName}
            setDetails={setDetails}
            setSetDetails={setSetDetails}
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
          />
        </div>
      )}

      {/* 悬浮球 */}
      {sessionState.isActive && sessionState.isMinimized && (
        <FloatingBall
          progress={getSessionProgress(sessionState.setsData)}
          onRestore={() => updateNavigationState({ sessionActive: true, isMinimized: false })}
          onCancel={handleCancelSession}
        />
      )}

      {/* Onboarding */}
      {showOnboarding && (
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
      )}

      {/* 今日训练预览弹窗 */}
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
    </div>
  );
}

export default App;
