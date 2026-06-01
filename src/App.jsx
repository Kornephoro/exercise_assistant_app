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
import { 
  Dumbbell, 
  CheckCircle, 
  AlertTriangle, 
  Settings
} from 'lucide-react';

function App() {
  // 1. 选项卡 Tab 状态 ('today' | 'plan' | 'calendar')
  const [activeTab, setActiveTab] = useState('today');

  // 2. 全局数据加载及保存状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: '' }
  
  const [currentDay, setCurrentDay] = useState('Day1');
  
  // 自定义重量与动作进阶步长状态
  const [customWeights, setCustomWeights] = useState({});
  const [customIncrements, setCustomIncrements] = useState({});

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

  // 3. 实时打卡会话状态 (sessionState)
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isMinimized: false,
    setsData: {
      T1: [],
      T2: [],
      T3: []
    }
  });

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
      const [lastWorkoutRes, settingsRes, progressionRes, exercisesRes] = await Promise.all([
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
          .select('*')
      ]);

      if (lastWorkoutRes.error) throw lastWorkoutRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (progressionRes.error) throw progressionRes.error;
      if (exercisesRes.error) throw exercisesRes.error;

      // 解析当前训练日
      let determinedDay = 'Day1';
      const lastWorkoutData = lastWorkoutRes.data || [];
      if (lastWorkoutData.length > 0) {
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

      // 解析用户自定义进阶步长映射
      const incrementsMap = {};
      const progressionData = progressionRes.data || [];
      progressionData.forEach(row => {
        if (!incrementsMap[row.exercise]) {
          incrementsMap[row.exercise] = {};
        }
        incrementsMap[row.exercise][row.tier] = row.increment;
      });
      setCustomIncrements(incrementsMap);

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

      // 根据训练日确定三个动作
      const t1t2Exercises = DAY_WORKOUT_MAP[determinedDay];
      const activeT1 = t1t2Exercises.T1;
      const activeT2 = t1t2Exercises.T2;
      const activeT3 = DAY_T3_MAP[determinedDay];

      setT1Exercise(activeT1);
      setT2Exercise(activeT2);
      setT3Exercise(activeT3);

      // 分别查询三个动作在其对应 Tier 的所有历史记录（按 created_at 升序）
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

      // 运行 GZCLP 核心进步算法
      const t1Result = getT1Progression(activeT1, t1History, t1CustomWeight, t1Increment);
      const t2Result = getT2Progression(activeT2, t2History, t2CustomWeight, t2Increment);
      const t3Result = getT3Progression(activeT3, t3History, t3CustomWeight, t3Increment);

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
      setToast({ 
        type: 'success', 
        message: `保存成功！下次训练为 ${nextDay}` 
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

  return (
    <>
      {/* Toast 提示 */}
      {toast && (
        <div className={`message-toast ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 头部区 */}
      <header className="header">
        <div className="header-top">
          <div className="app-logo">
            <Dumbbell size={24} />
            <span>GZCLP Power</span>
          </div>
          {/* 点击设置按钮跳转到计划设定 Tab */}
          <button 
            type="button" 
            className="settings-btn"
            onClick={() => setActiveTab('plan')}
            aria-label="切换到计划设定"
          >
            <Settings size={22} />
          </button>
        </div>
        <h1>力量训练记录</h1>
        <div className="day-badge">
          今天：{currentDay}
        </div>
      </header>

      {/* 主屏幕区域 - 使用 display: none/block 保留 Tab 状态 */}
      <main className="app-container-pad">
        
        {/* TAB 1: 今日训练页面 */}
        <div style={{ display: activeTab === 'today' ? 'block' : 'none' }}>
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>正在计算今日训练建议...</p>
            </div>
          ) : error ? (
            <div className="loading-container" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={48} />
              <p style={{ textAlign: 'center', padding: '0 20px' }}>{error}</p>
              <button 
                className="btn-primary" 
                style={{ width: 'auto', marginTop: '20px', padding: '12px 24px' }}
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

      {/* 底部固定导航栏 */}
      <nav className="tab-nav">
        <button 
          type="button" 
          className={`tab-item ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          <span className="tab-icon">🏋️</span>
          <span>今日</span>
        </button>
        <button 
          type="button" 
          className={`tab-item ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          <span className="tab-icon">📋</span>
          <span>计划</span>
        </button>
        <button 
          type="button" 
          className={`tab-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <span className="tab-icon">📅</span>
          <span>日历</span>
        </button>
      </nav>

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
    </>
  );
}

export default App;
