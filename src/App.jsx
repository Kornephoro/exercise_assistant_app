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
import CalendarScreen from './CalendarScreen';
import SettingsModal from './SettingsModal';
import { 
  Dumbbell, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Settings
} from 'lucide-react';

function App() {
  // 1. 选项卡 Tab 状态 ('today' | 'calendar')
  const [activeTab, setActiveTab] = useState('today');

  // 2. 全局数据加载及保存状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: '' }
  
  const [currentDay, setCurrentDay] = useState('Day1');
  const [recentLogs, setRecentLogs] = useState([]);
  
  // 自定义重量与动作进阶步长状态
  const [customWeights, setCustomWeights] = useState({});
  const [customIncrements, setCustomIncrements] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  
  // 用户输入：最后一组完成次数
  const [t1InputReps, setT1InputReps] = useState('');
  const [t2InputReps, setT2InputReps] = useState('');
  const [t3InputReps, setT3InputReps] = useState('');

  // 历史展开折叠状态
  const [showRecentLogs, setShowRecentLogs] = useState(false);

  // Toast 计时器
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

      // 初始输入框默认计划值
      setT1InputReps(t1Result.planned_reps.toString());
      setT2InputReps(t2Result.planned_reps.toString());
      setT3InputReps(t3Result.planned_reps.toString());

      // 获取最近 10 条日志以呈现在底部面板
      const { data: logsData, error: logsError } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (logsError) throw logsError;
      setRecentLogs(logsData || []);

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

  // 保存今日训练记录逻辑
  const handleSaveWorkout = async () => {
    const t1RepsVal = parseInt(t1InputReps, 10);
    const t2RepsVal = parseInt(t2InputReps, 10);
    const t3RepsVal = parseInt(t3InputReps, 10);

    if (isNaN(t1RepsVal) || t1RepsVal < 0) {
      setToast({ type: 'error', message: '请输入有效的 T1 最后一组完成次数' });
      return;
    }
    if (isNaN(t2RepsVal) || t2RepsVal < 0) {
      setToast({ type: 'error', message: '请输入有效的 T2 最后一组完成次数' });
      return;
    }
    if (isNaN(t3RepsVal) || t3RepsVal < 0) {
      setToast({ type: 'error', message: '请输入有效的 T3 最后一组完成次数' });
      return;
    }

    setSaving(true);
    try {
      const t1Record = {
        training_day: currentDay,
        tier: 'T1',
        exercise: t1Exercise,
        weight_kg: t1Weight,
        planned_reps: t1PlannedReps,
        actual_last_set_reps: t1RepsVal
      };

      const t2Record = {
        training_day: currentDay,
        tier: 'T2',
        exercise: t2Exercise,
        weight_kg: t2Weight,
        planned_reps: t2PlannedReps,
        actual_last_set_reps: t2RepsVal
      };

      const t3Record = {
        training_day: currentDay,
        tier: 'T3',
        exercise: t3Exercise,
        weight_kg: t3Weight,
        planned_reps: t3PlannedReps,
        actual_last_set_reps: t3RepsVal
      };

      // 批量插入数据库 T1 / T2 / T3 三条记录
      const { error: insertError } = await supabase
        .from('workouts')
        .insert([t1Record, t2Record, t3Record]);

      if (insertError) throw insertError;

      const nextDay = getNextDay(currentDay);
      setToast({ 
        type: 'success', 
        message: `保存成功！下次训练为 ${nextDay}` 
      });

      setT1InputReps('');
      setT2InputReps('');
      setT3InputReps('');

      await loadWorkoutData();

    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: '保存记录失败：' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // 微调次数
  const adjustReps = (type, action) => {
    const isT1 = type === 'T1';
    const isT2 = type === 'T2';
    const currentVal = isT1 ? t1InputReps : isT2 ? t2InputReps : t3InputReps;
    const setVal = isT1 ? setT1InputReps : isT2 ? setT2InputReps : setT3InputReps;
    
    let num = parseInt(currentVal, 10);
    if (isNaN(num)) {
      num = isT1 ? t1PlannedReps : isT2 ? t2PlannedReps : t3PlannedReps;
    }

    if (action === 'increment') {
      setVal((num + 1).toString());
    } else if (action === 'decrement' && num > 0) {
      setVal((num - 1).toString());
    }
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
          {/* 齿轮配置按钮 */}
          <button 
            type="button" 
            className="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="设置配置信息"
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
              t1LastRecord={t1LastRecord}
              t2LastRecord={t2LastRecord}
              t3LastRecord={t3LastRecord}
              t1InputReps={t1InputReps}
              t2InputReps={t2InputReps}
              t3InputReps={t3InputReps}
              setT1InputReps={setT1InputReps}
              setT2InputReps={setT2InputReps}
              setT3InputReps={setT3InputReps}
              recentLogs={recentLogs}
              showRecentLogs={showRecentLogs}
              setShowRecentLogs={setShowRecentLogs}
              saving={saving}
              handleSaveWorkout={handleSaveWorkout}
              adjustReps={adjustReps}
              getIncrementStep={getIncrementStep}
              getExerciseCNName={getExerciseCNName}
            />
          )}
        </div>

        {/* TAB 2: 训练日历页面 */}
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
          <span>训练</span>
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

      {/* 初始配置及步长设置弹窗 */}
      {isSettingsOpen && (
        <SettingsModal 
          onClose={(shouldRefresh) => {
            setIsSettingsOpen(false);
            if (shouldRefresh) {
              setToast({ type: 'success', message: '初始重量与进阶步长保存成功！今日建议重量已同步更新。' });
              loadWorkoutData();
            }
          }}
        />
      )}
    </>
  );
}

export default App;
