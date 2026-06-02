import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getNextWorkout, getNextDay } from './programEngine';
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

const getWeekdayEnglish = (date) => {
  const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdaysEng[date.getDay()];
};

const getWeekdayCN = (date) => {
  const weekdaysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdaysCN[date.getDay()];
};

const calculateNextTrainingDate = (trainingDaysArr, baseDate = new Date()) => {
  if (!trainingDaysArr || trainingDaysArr.length === 0) return null;
  const weekdaysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIndices = trainingDaysArr.map(day => weekdaysEng.indexOf(day)).filter(idx => idx !== -1);
  if (targetIndices.length === 0) return null;
  const baseDayIdx = baseDate.getDay();
  let nextDayIdx = targetIndices.find(idx => idx > baseDayIdx);
  let daysDiff = 0;
  if (nextDayIdx !== undefined) {
    daysDiff = nextDayIdx - baseDayIdx;
  } else {
    const minIdx = Math.min(...targetIndices);
    daysDiff = 7 - baseDayIdx + minIdx;
  }
  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(baseDate.getDate() + daysDiff);
  return nextDate;
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

  // 训练会话状态
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isMinimized: false,
    setsData: { T1: [], T2: [], T3: [] }
  });

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

      const [programsRes, userProgramsRes, exercisesRes, todayWorkoutsRes, profileRes, settingsRes, progressionRes] = await Promise.all([
        supabase.from('programs').select('*').eq('is_active', true).order('name'),
        supabase.from('user_programs').select('*'),
        supabase.from('exercises').select('*'),
        supabase.from('workouts').select('*').gte('created_at', todayStart.toISOString()).order('created_at'),
        supabase.from('user_profiles').select('*').limit(1),
        supabase.from('user_settings').select('*'),
        supabase.from('exercise_progression_settings').select('*')
      ]);

      if (programsRes.error) throw programsRes.error;
      if (userProgramsRes.error) throw userProgramsRes.error;
      if (exercisesRes.error) throw exercisesRes.error;
      if (todayWorkoutsRes.error) throw todayWorkoutsRes.error;
      if (profileRes.error) throw profileRes.error;
      // settingsRes and progressionRes errors are non-fatal (tables may not exist yet)

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
          // 将旧表数据合并到 exercise_config（GZCLP 兼容）
          const mergedUP = { ...activeUP };
          const oldWeights = {};
          const oldIncrements = {};
          const oldTargets = {};

          if (!settingsRes.error) {
            (settingsRes.data || []).forEach(row => {
              oldWeights[row.exercise] = row.initial_weight;
            });
          }
          if (!progressionRes.error) {
            (progressionRes.data || []).forEach(row => {
              oldIncrements[`${row.exercise}_${row.tier}`] = row.increment;
              if (row.tier === 'T3' && row.target_reps != null) {
                oldTargets[row.exercise] = row.target_reps;
              }
            });
          }

          // 如果旧表有数据且 exercise_config 为空，用旧表数据填充
          if (Object.keys(oldWeights).length > 0 && !mergedUP.exercise_config) {
            mergedUP.exercise_config = {};
          }
          if (mergedUP.exercise_config || Object.keys(oldWeights).length > 0) {
            const ec = { ...(mergedUP.exercise_config || {}) };
            Object.keys(oldWeights).forEach(ex => {
              if (!ec[ex]) ec[ex] = {};
              if (ec[ex].initial_weight == null) ec[ex].initial_weight = oldWeights[ex];
            });
            Object.entries(oldIncrements).forEach(([key, val]) => {
              const [ex, tier] = key.split('_');
              if (!ec[ex]) ec[ex] = {};
              const incrKey = `increment_${tier.toLowerCase()}`;
              if (ec[ex][incrKey] == null) ec[ex][incrKey] = val;
            });
            Object.entries(oldTargets).forEach(([ex, val]) => {
              if (!ec[ex]) ec[ex] = {};
              if (ec[ex].target_reps == null) ec[ex].target_reps = val;
            });
            mergedUP.exercise_config = ec;
          }

          // 获取该计划所有相关动作的历史
          const workoutQuery = { program_id: activeProgram.id };
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

          const result = getNextWorkout(activeProgram, mergedUP, histByExTier);
          setTodayWorkout(result);
        }
      } else {
        setTodayWorkout(null);
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

    const setsData = { T1: [], T2: [], T3: [] };
    todayWorkout.exercises.forEach(ex => {
      const tier = ex.tier || 'T1';
      const method = exercisesMap[ex.exercise]?.recording_method || 'standard';
      const extra = getSetExtraFields(method);
      const sets = Array.from({ length: ex.sets }, (_, idx) => ({
        set_number: idx + 1,
        planned_reps: ex.reps,
        actual_reps: '',
        completed: false,
        weight_kg: ex.weight,
        ...extra
      }));
      setsData[tier] = sets;
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
      setsData: { T1: [], T2: [], T3: [] }
    });
    setToast({ type: 'success', message: '已放弃本次训练数据。' });
  };

  // 保存训练记录
  const handleSaveSession = async () => {
    const activeUP = userPrograms.find(u => u.id === activeProgramId);
    const activeProgram = programs.find(p => p.id === activeUP?.program_id);
    if (!activeUP || !activeProgram) {
      setToast({ type: 'error', message: '未找到活跃计划' });
      return;
    }

    const { T1: t1Sets, T2: t2Sets, T3: t3Sets } = sessionState.setsData;
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

    for (const tier of ['T1', 'T2', 'T3']) {
      const sets = setsData[tier] || [];
      if (sets.length === 0) continue;

      const tierEx = todayWorkout.exercises.find(e => e.tier === tier);
      if (!tierEx) continue;

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
        record.actual_last_set_reps = getFinalReps(lastSet);
      } else if (method === 'duration_only') {
        record.actual_last_set_reps = lastSet.duration_seconds || 0;
      } else if (['distance_only', 'loaded_carry'].includes(method)) {
        record.actual_last_set_reps = lastSet.distance_meters || 0;
      }
      workoutRecords.push(record);

      // workout_sets detail records
      sets.forEach(s => {
        const base = {
          exercise: tierEx.exercise,
          tier,
          set_number: s.set_number,
          completed: s.completed,
          notes: null,
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
    }

    setSaving(true);
    try {
      const [insertWorkoutsRes, insertSetsRes] = await Promise.all([
        supabase.from('workouts').insert(workoutRecords),
        supabase.from('workout_sets').insert(setsToInsert)
      ]);

      if (insertWorkoutsRes.error) throw insertWorkoutsRes.error;
      if (insertSetsRes.error) throw insertSetsRes.error;

      // 更新 user_programs 的 program_state
      const nextDay = getNextDay(activeProgram, todayWorkout.dayLabel);
      const newState = { ...activeUP.program_state, current_day: nextDay };
      await supabase.from('user_programs').update({ program_state: newState, updated_at: new Date().toISOString() }).eq('id', activeUP.id);

      const nextDate = calculateNextTrainingDate(trainingDays, new Date());
      let toastMsg = `保存成功！下次训练日为 ${nextDay}`;
      if (nextDate) {
        toastMsg = `保存成功！下次训练日为 ${nextDate.getMonth() + 1}月${nextDate.getDate()}日 (${getWeekdayCN(nextDate)})`;
      }
      setToast({ type: 'success', message: toastMsg });

      setSessionState({
        isActive: false,
        isMinimized: false,
        setsData: { T1: [], T2: [], T3: [] }
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
    const tiers = ['T1', 'T2', 'T3'];
    for (const tier of tiers) {
      const sets = setsData[tier] || [];
      const completedCount = sets.filter(s => s.completed).length;
      if (completedCount < sets.length) return `${tier} ${completedCount}/${sets.length}`;
    }
    const t3Sets = setsData.T3 || [];
    return `T3 ${t3Sets.length}/${t3Sets.length}`;
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

  const getNextTrainingDateFormatted = () => {
    if (!trainingDays || trainingDays.length === 0) return '';
    const todayEnglish = getWeekdayEnglish(new Date());
    const isTodayScheduled = trainingDays.includes(todayEnglish);
    let baseDate = new Date();
    if (isTodayScheduled && !isTodayCompleted) {
      return baseDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    } else {
      const nextDate = calculateNextTrainingDate(trainingDays, baseDate);
      if (!nextDate) return '';
      return nextDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-[480px] w-full mx-auto bg-bg-main dark:bg-bg-main-dark text-text-main dark:text-text-main-dark border-x border-border-card dark:border-border-card-dark shadow-2xl relative transition-colors duration-200">
      {toast && (
        <div className="toast toast-top toast-center z-[9999] min-w-[320px] max-w-[440px] px-4">
          <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg rounded-xl flex items-center gap-3`}>
            {toast.type === 'success'
              ? <CheckCircle size={18} className="text-white shrink-0" />
              : <AlertTriangle size={18} className="text-white shrink-0" />}
            <span className="text-sm font-semibold text-white break-words text-left">{toast.message}</span>
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
              onSwitchProgram={switchActiveProgram}
              onGoToLibrary={() => setActiveTab('plan')}
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

        {/* TAB 2: 计划库 */}
        <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
          <PlanScreen
            programs={programs}
            userPrograms={userPrograms}
            exercisesMap={exercisesMap}
            onProgramActivated={() => {
              setToast({ type: 'success', message: '计划已启用！' });
              setActiveTab('today');
              loadWorkoutData();
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
    </div>
  );
}

export default App;
