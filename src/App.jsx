import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getNextWorkout, getNextDay, isTodayTrainingDay, getNextTrainingDate, getDaysUntilStart } from './programEngine';
import TodayScreen from './TodayScreen';
import PlanScreen from './PlanScreen';
import CalendarScreen from './CalendarScreen';
import TrainSession from './TrainSession';
import FloatingBall from './FloatingBall';
import OnboardingScreen from './OnboardingScreen';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import {
  Dumbbell,
  CheckCircle,
  AlertTriangle,
  Sun,
  Moon,
  SkipForward,
  Flag
} from 'lucide-react';

const getWeekdayEnglish = (date) => {
  const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdaysEng[date.getDay()];
};

const getWeekdayCN = (date) => {
  const weekdaysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdaysCN[date.getDay()];
};

function App() {
  const [activeTab, setActiveTab] = useState('today');

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trainingDays, setTrainingDays] = useState(null);
  const [userNickname, setUserNickname] = useState(() => localStorage.getItem('user_nickname') || '');

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    if (!completed) setShowOnboarding(true);
  }, []);

  // 新架构：programs + user_programs
  const [programs, setPrograms] = useState([]);
  const [userPrograms, setUserPrograms] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(null);
  const [exercisesMap, setExercisesMap] = useState({});

  // 引擎输出：今日训练内容
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);
  const [todayWorkoutSummary, setTodayWorkoutSummary] = useState([]);

  // 日程计算结果
  const [isRestDayValue, setIsRestDayValue] = useState(false);
  const [nextTrainingDateValue, setNextTrainingDateValue] = useState('');
  const [daysUntilStartValue, setDaysUntilStartValue] = useState(0);

  // 训练会话状态
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isMinimized: false,
    setsData: {} // key = index in todayWorkout.exercises, supports multiple exercises per tier
  });

  // 训练预览弹窗
  const [previewOpen, setPreviewOpen] = useState(false);

  // 操作锁定：训练中或预览弹窗打开时，禁止在 PlanScreen 结束/暂停计划
  const isOperationLocked = sessionState.isActive || previewOpen;

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 核心数据加载
  const loadWorkoutData = async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [programsRes, userProgramsRes, exercisesRes, todayWorkoutsRes, profileRes] = await Promise.all([
        supabase.from('programs').select('*').eq('is_active', true).order('name'),
        supabase.from('user_programs').select('*'),
        supabase.from('exercises').select('*'),
        supabase.from('workouts').select('*').gte('created_at', todayStart.toISOString()).order('created_at'),
        supabase.from('user_profiles').select('*').limit(1)
      ]);

      if (programsRes.error) throw programsRes.error;
      if (userProgramsRes.error) throw userProgramsRes.error;
      if (exercisesRes.error) throw exercisesRes.error;
      if (todayWorkoutsRes.error) throw todayWorkoutsRes.error;
      if (profileRes.error) throw profileRes.error;

      // 解析 exercises map
      const exMap = {};
      (exercisesRes.data || []).forEach(row => {
        if (row.name) exMap[row.name] = row;
      });
      setExercisesMap(exMap);

      // 解析 programs
      const allPrograms = programsRes.data || [];
      setPrograms(allPrograms);

      // 解析 user_programs
      const allUserPrograms = userProgramsRes.data || [];
      setUserPrograms(allUserPrograms);

      // 解析用户画像
      const profileData = profileRes.data || [];
      let trainingDaysArray = null;
      if (profileData.length > 0 && profileData[0].training_days) {
        try { trainingDaysArray = JSON.parse(profileData[0].training_days); } catch (e) { /* ignore */ }
      }
      setTrainingDays(trainingDaysArray);
      setUserNickname(localStorage.getItem('user_nickname') || '');

      // 解析今日打卡状态
      const todayWorkouts = todayWorkoutsRes.data || [];
      setIsTodayCompleted(todayWorkouts.length > 0);
      setTodayWorkoutSummary(todayWorkouts);

      // 确定当前活跃计划
      const activeUps = allUserPrograms.filter(up => up.is_active);
      let currentActiveId = activeProgramId;
      if (activeUps.length > 0 && !activeUps.find(u => u.id === currentActiveId)) {
        currentActiveId = activeUps[0].id;
      }
      if (activeUps.length === 0) currentActiveId = null;
      setActiveProgramId(currentActiveId);

      // 用引擎计算今日训练
      if (currentActiveId) {
        const activeUP = activeUps.find(u => u.id === currentActiveId);
        const activeProgram = allPrograms.find(p => p.id === activeUP.program_id);
        if (activeProgram) {
          // 获取该计划所有相关动作的历史
          const { data: historyData } = await supabase
            .from('workouts')
            .select('*')
            .eq('program_id', activeProgram.id)
            .order('created_at', { ascending: true });

          // 按 exercise+tier 分组历史
          const histByExTier = {};
          (historyData || []).forEach(row => {
            if (!histByExTier[row.exercise]) histByExTier[row.exercise] = {};
            if (!histByExTier[row.exercise][row.tier]) histByExTier[row.exercise][row.tier] = [];
            histByExTier[row.exercise][row.tier].push(row);
          });

          const result = getNextWorkout(activeProgram, activeUP, histByExTier);
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
        setDaysUntilStartValue(0);
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
    loadWorkoutData();
  }, []);

  // 切换活跃计划
  const switchActiveProgram = (programId) => {
    setActiveProgramId(programId);
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
        actual_reps: '',
        completed: false,
        weight_kg: ex.weight,
        ...extra
      }));
      setsData[idx] = sets; // key = exercise index, supports multiple T3 per day
    });

    setSessionState({
      isActive: true,
      isMinimized: false,
      setsData
    });
  };

  const handleStartOrRestoreTrain = () => {
    if (sessionState.isActive) {
      setSessionState(prev => ({ ...prev, isMinimized: false }));
    } else {
      startTrainSession();
    }
  };

  const handleCancelSession = () => {
    setSessionState({
      isActive: false,
      isMinimized: false,
      setsData: {}
    });
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
    const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date);
    
    const newState = {
      ...activeUP.program_state,
      current_day: nextDay,
      last_training_date: new Date().toISOString(),
      skipped_dates: [...(activeUP.program_state?.skipped_dates || []), {
        date: new Date().toISOString(),
        day_label: todayWorkout.dayLabel,
        reason: reason || '未记录'
      }]
    };
    
    await supabase.from('user_programs').update({ program_state: newState, updated_at: new Date().toISOString() }).eq('id', activeUP.id);
    
    const nextDateStr = getNextTrainingDate(schedule, newState.last_training_date, newState.start_date);
    let toastMsg = `已跳过今日训练，下次训练日：${nextDay}`;
    if (nextDateStr) {
      toastMsg = `已跳过今日训练，下次训练日：${nextDateStr}`;
    }
    setToast({ type: 'info', message: toastMsg });
    await loadWorkoutData();
  };

  // 加练
  const handleExtraTraining = async () => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram || !todayWorkout) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    const schedule = activeUP.schedule || {};
    const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date);
    
    const newState = {
      ...activeUP.program_state,
      current_day: nextDay,
      last_training_date: new Date().toISOString()
    };
    
    await supabase.from('user_programs').update({ program_state: newState, updated_at: new Date().toISOString() }).eq('id', activeUP.id);
    
    const nextDateStr = getNextTrainingDate(schedule, newState.last_training_date, newState.start_date);
    let toastMsg = `加练完成！下次计划训练日：${nextDay}`;
    if (nextDateStr) {
      toastMsg = `加练完成！下次计划训练日：${nextDateStr}`;
    }
    setToast({ type: 'success', message: toastMsg });
    await loadWorkoutData();
  };

  // 保存训练记录
  const handleSaveSession = async (setDetails = {}) => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    const setsData = sessionState.setsData;
    const getFinalReps = (setObj) => {
      if (setObj.actual_reps === '' || setObj.actual_reps === undefined) return setObj.planned_reps;
      return parseInt(setObj.actual_reps, 10);
    };

    const getRecordingMethod = (exerciseKey) => exercisesMap[exerciseKey]?.recording_method || 'standard';

    const validateLastSet = (lastSet, method) => {
      if (['standard', 'reps_only', 'bodyweight_added', 'bodyweight_assisted'].includes(method)) {
        const reps = getFinalReps(lastSet);
        return !isNaN(reps) && reps >= 0;
      }
      if (method === 'duration_only') return lastSet.duration_seconds > 0;
      if (['distance_only', 'loaded_carry'].includes(method)) return lastSet.distance_meters > 0;
      return true;
    };

    const setsToInsert = [];
    const workoutRecords = [];

    (todayWorkout.exercises || []).forEach((tierEx, exIdx) => {
      const tier = tierEx.tier || 'T1';
      const sets = setsData[exIdx] || [];
      if (sets.length === 0) return;

      const method = getRecordingMethod(tierEx.exercise);
      const lastSet = sets[sets.length - 1];

      if (!validateLastSet(lastSet, method)) {
        setToast({ type: 'error', message: `打卡保存失败：${tier} 最后一组必须填写有效数据` });
        return;
      }

      // workout summary record
      const record = {
        training_day: todayWorkout.dayLabel,
        tier,
        exercise: tierEx.exercise,
        weight_kg: tierEx.weight,
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
      sets.forEach((s, setIdx) => {
        const setKey = `${tier}_${exIdx}_${setIdx}`;
        const detail = setDetails[setKey] || {};
        const base = {
          exercise: tierEx.exercise,
          tier,
          set_number: s.set_number,
          completed: s.completed,
          notes: detail.notes || null,
          rpe: detail.rpe ?? null,
          tempo_eccentric: detail.tempo_eccentric ?? null,
          tempo_pause_bottom: detail.tempo_pause_bottom ?? null,
          tempo_concentric: detail.tempo_concentric ?? null,
          tempo_pause_top: detail.tempo_pause_top ?? null,
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
      });
    });

    setSaving(true);
    try {
      const [insertWorkoutsRes, insertSetsRes] = await Promise.all([
        supabase.from('workouts').insert(workoutRecords),
        supabase.from('workout_sets').insert(setsToInsert)
      ]);

      if (insertWorkoutsRes.error) throw insertWorkoutsRes.error;
      if (insertSetsRes.error) throw insertSetsRes.error;

      // 更新 user_programs 的 program_state
      const schedule = activeUP.schedule || {};
      const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel, schedule, activeUP.program_state?.last_training_date);
      const newState = {
        ...activeUP.program_state,
        current_day: nextDay,
        last_training_date: new Date().toISOString()
      };
      await supabase.from('user_programs').update({ program_state: newState, updated_at: new Date().toISOString() }).eq('id', activeUP.id);

      const nextDateStr = getNextTrainingDate(schedule, newState.last_training_date, newState.start_date);
      let toastMsg = `保存成功！下次训练日为 ${nextDay}`;
      if (nextDateStr) {
        toastMsg = `保存成功！下次训练日为 ${nextDateStr}`;
      }
      setToast({ type: 'success', message: toastMsg });

      setSessionState({
        isActive: false,
        isMinimized: false,
        setsData: {}
      });

      await loadWorkoutData();
    } catch (err) {
      console.error('保存训练记录失败：', err);
      setToast({ type: 'error', message: '保存记录失败：' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const getSessionProgress = (setsData) => {
    if (!setsData) return '';
    const keys = Object.keys(setsData).sort((a, b) => Number(a) - Number(b));
    for (const key of keys) {
      const sets = setsData[key] || [];
      const completedCount = sets.filter(s => s.completed).length;
      if (completedCount < sets.length) return `${completedCount}/${sets.length}`;
    }
    const total = keys.reduce((sum, k) => sum + (setsData[k]?.length || 0), 0);
    return `${total}/${total}`;
  };

  const getExerciseCNName = (exercise) => {
    return exercisesMap[exercise]?.name_cn || exercise;
  };

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
        <div className="toast toast-top toast-center z-[9999] min-w-[320px] max-w-[440px] px-4" style={{ top: '4.5rem' }}>
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

      <div className="navbar sticky top-0 z-50 bg-bg-card/90 dark:bg-bg-card-dark/90 border-b border-border-card dark:border-border-card-dark backdrop-blur px-4">
        <div className="flex-1 flex items-center gap-2">
          <Dumbbell size={20} className="text-primary filter drop-shadow-[0_0_8px_rgba(255,107,53,0.4)]" />
          <span className="text-base font-extrabold tracking-wide bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            训练助手
          </span>
          {getActiveProgram() && (
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20 ml-1">
              {getActiveProgram().name}
            </span>
          )}
          {userNickname && (
            <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark px-2 py-0.5 bg-bg-hover dark:bg-bg-hover-dark rounded-full ml-1">
              {userNickname}
            </span>
          )}
        </div>
        <div className="flex-none">
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

      <main className="flex-1 pt-6 pb-24 px-5 w-full flex flex-col gap-6">

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
            />
          )}
        </div>

        {/* TAB 2: 计划库 */}
        <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
          <PlanScreen
            programs={programs}
            userPrograms={userPrograms}
            exercisesMap={exercisesMap}
            optimisticUpdateUserProgram={optimisticUpdateUserProgram}
            isOperationLocked={isOperationLocked}
            onProgramStarted={() => {
              setToast({ type: 'success', message: '计划已启用！' });
              setActiveTab('today');
              loadWorkoutData();
            }}
            onProgramPaused={(userProgramId) => {
              optimisticUpdateUserProgram(userProgramId, { is_active: false, paused_at: new Date().toISOString() });
              setToast({ type: 'info', message: '计划已暂停。' });
              loadWorkoutData();
            }}
            onProgramResumed={(userProgramId) => {
              optimisticUpdateUserProgram(userProgramId, { is_active: true, paused_at: null });
              setToast({ type: 'success', message: '计划已恢复。' });
              setActiveTab('today');
              loadWorkoutData();
            }}
            onProgramEnded={(userProgramId) => {
              optimisticUpdateUserProgram(userProgramId, { is_active: false, ended_at: new Date().toISOString() });
              setToast({ type: 'info', message: '计划已结束，训练历史已保留。' });
              setActiveTab('plan');
              loadWorkoutData();
            }}
            onProgramError={(message) => {
              setToast({ type: 'error', message });
            }}
          />
        </div>

        {/* TAB 3: 日历 */}
        <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
          <CalendarScreen getExerciseCNName={getExerciseCNName} />
        </div>
      </main>

      {/* 底部导航 */}
      <div className="dock fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-bg-card/90 dark:bg-bg-card-dark/90 border-t border-border-card dark:border-border-card-dark backdrop-blur h-16">
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'today' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => setActiveTab('today')}
        >
          <span className="text-xl">🏋️</span>
          <span className="dock-label text-xs font-bold">今日</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'plan' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => setActiveTab('plan')}
        >
          <span className="text-xl">📋</span>
          <span className="dock-label text-xs font-bold">计划库</span>
        </button>
        <button type="button"
          className={`transition-all duration-200 ${activeTab === 'calendar' ? 'dock-active text-primary font-bold bg-transparent' : 'text-text-secondary dark:text-text-secondary-dark'}`}
          onClick={() => setActiveTab('calendar')}
        >
          <span className="text-xl">📅</span>
          <span className="dock-label text-xs font-bold">日历</span>
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
            onMinimize={() => setSessionState(prev => ({ ...prev, isMinimized: true }))}
            onSave={handleSaveSession}
            onCancel={handleCancelSession}
          />
        </div>
      )}

      {/* 悬浮球 */}
      {sessionState.isActive && sessionState.isMinimized && (
        <FloatingBall
          progress={getSessionProgress(sessionState.setsData)}
          onRestore={() => setSessionState(prev => ({ ...prev, isMinimized: false }))}
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
        onClose={() => setPreviewOpen(false)}
        onStartTrain={() => {
          setPreviewOpen(false);
          handleStartOrRestoreTrain();
        }}
        todayWorkout={todayWorkout}
        getExerciseCNName={getExerciseCNName}
      />
    </div>
  );
}

export default App;
