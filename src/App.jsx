import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  EXERCISE_NAMES_CN, 
  DAY_WORKOUT_MAP, 
  getNextDay, 
  getT1Progression, 
  getT2Progression 
} from './progression';
import { 
  Dumbbell, 
  Calendar, 
  Plus, 
  Minus, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  History, 
  Sparkles 
} from 'lucide-react';

function App() {
  // 1. 全局状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: '' }
  
  const [currentDay, setCurrentDay] = useState('Day1');
  const [recentLogs, setRecentLogs] = useState([]);
  
  // 今日动作数据
  const [t1Exercise, setT1Exercise] = useState('squat');
  const [t2Exercise, setT2Exercise] = useState('bench');
  
  const [t1Weight, setT1Weight] = useState(40.0);
  const [t2Weight, setT2Weight] = useState(30.0);
  
  const [t1PlannedReps, setT1PlannedReps] = useState(3);
  const [t2PlannedReps, setT2PlannedReps] = useState(10);
  
  const [t1SchemeText, setT1SchemeText] = useState('');
  const [t2SchemeText, setT2SchemeText] = useState('');
  
  // 最后一组实际历史
  const [t1LastRecord, setT1LastRecord] = useState(null);
  const [t2LastRecord, setT2LastRecord] = useState(null);
  
  // 用户输入：最后一组完成次数
  const [t1InputReps, setT1InputReps] = useState('');
  const [t2InputReps, setT2InputReps] = useState('');

  // 历史展开折叠状态
  const [showRecentLogs, setShowRecentLogs] = useState(false);

  // 2. 加载 Toast 计时器
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 3. 核心数据获取与计算逻辑
  const loadWorkoutData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step A: 查询 workouts 表中最后一条记录，以确定当前训练日
      const { data: lastWorkoutData, error: lastWorkoutError } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastWorkoutError) throw lastWorkoutError;

      let determinedDay = 'Day1';
      if (lastWorkoutData && lastWorkoutData.length > 0) {
        determinedDay = getNextDay(lastWorkoutData[0].training_day);
      }
      
      setCurrentDay(determinedDay);

      // 根据训练日确定两个动作
      const exercises = DAY_WORKOUT_MAP[determinedDay];
      const activeT1 = exercises.T1;
      const activeT2 = exercises.T2;

      setT1Exercise(activeT1);
      setT2Exercise(activeT2);

      // Step B: 分别查询两个动作在其对应 Tier 的所有历史（按 created_at 升序）
      const [t1HistoryRes, t2HistoryRes] = await Promise.all([
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
          .order('created_at', { ascending: true })
      ]);

      if (t1HistoryRes.error) throw t1HistoryRes.error;
      if (t2HistoryRes.error) throw t2HistoryRes.error;

      const t1History = t1HistoryRes.data || [];
      const t2History = t2HistoryRes.data || [];

      // 保存最后一次历史记录用于 UI 展示
      setT1LastRecord(t1History.length > 0 ? t1History[t1History.length - 1] : null);
      setT2LastRecord(t2History.length > 0 ? t2History[t2History.length - 1] : null);

      // Step C: 用 GZCLP 算法计算今日建议
      const t1Result = getT1Progression(activeT1, t1History);
      const t2Result = getT2Progression(activeT2, t2History);

      // 更新状态
      setT1Weight(t1Result.weight_kg);
      setT1PlannedReps(t1Result.planned_reps);
      setT1SchemeText(t1Result.scheme_text);

      setT2Weight(t2Result.weight_kg);
      setT2PlannedReps(t2Result.planned_reps);
      setT2SchemeText(t2Result.scheme_text);

      // 初始化输入框的默认计划次数
      setT1InputReps(t1Result.planned_reps.toString());
      setT2InputReps(t2Result.planned_reps.toString());

      // Step D: 获取最近 5 条历史日志用于显示
      const { data: logsData, error: logsError } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (logsError) throw logsError;
      setRecentLogs(logsData || []);

    } catch (err) {
      console.error(err);
      setError('无法从 Supabase 获取数据，请检查网络或配置：' + err.message);
      setToast({ type: 'error', message: '数据加载失败！' });
    } finally {
      setLoading(false);
    }
  };

  // 4. 初次挂载及刷新时加载
  useEffect(() => {
    loadWorkoutData();
  }, []);

  // 5. 保存训练记录逻辑
  const handleSaveWorkout = async () => {
    // 校验输入
    const t1RepsVal = parseInt(t1InputReps, 10);
    const t2RepsVal = parseInt(t2InputReps, 10);

    if (isNaN(t1RepsVal) || t1RepsVal < 0) {
      setToast({ type: 'error', message: '请输入有效的 T1 最后一组完成次数' });
      return;
    }
    if (isNaN(t2RepsVal) || t2RepsVal < 0) {
      setToast({ type: 'error', message: '请输入有效的 T2 最后一组完成次数' });
      return;
    }

    setSaving(true);
    try {
      // 构造要插入的数据
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

      // 插入 workouts 表
      const { error: insertError } = await supabase
        .from('workouts')
        .insert([t1Record, t2Record]);

      if (insertError) throw insertError;

      // 提示成功，计算下次训练日
      const nextDay = getNextDay(currentDay);
      setToast({ 
        type: 'success', 
        message: `保存成功！下次训练为 ${nextDay}` 
      });

      // 清空当前输入
      setT1InputReps('');
      setT2InputReps('');

      // 重新加载数据，自动切换到下一个训练日并重新计算建议
      await loadWorkoutData();

    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: '保存记录失败：' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // 6. 次数加减辅助函数
  const adjustReps = (type, action) => {
    const isT1 = type === 'T1';
    const currentVal = isT1 ? t1InputReps : t2InputReps;
    const setVal = isT1 ? setT1InputReps : setT2InputReps;
    
    let num = parseInt(currentVal, 10);
    if (isNaN(num)) {
      num = isT1 ? t1PlannedReps : t2PlannedReps;
    }

    if (action === 'increment') {
      setVal((num + 1).toString());
    } else if (action === 'decrement' && num > 0) {
      setVal((num - 1).toString());
    }
  };

  // 渲染
  return (
    <>
      {/* Toast Alert */}
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

      {/* Header */}
      <header className="header">
        <div className="app-logo">
          <Dumbbell size={24} />
          <span>GZCLP Power</span>
        </div>
        <h1>力量训练记录</h1>
        <div className="day-badge">
          今天：{currentDay}
        </div>
      </header>

      {/* Loading state */}
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
        <>
          {/* T1 动作卡片 */}
          <section className="exercise-card t1-style" style={{ animationDelay: '0.1s' }}>
            <div className="card-header">
              <span className="exercise-title">{EXERCISE_NAMES_CN[t1Exercise]}</span>
              <span className="tier-badge t1">Tier T1</span>
            </div>
            
            <div className="scheme-box">
              <span className="scheme-desc">{t1SchemeText}</span>
              <div className="weight-display">
                <span className="weight-number">{t1Weight.toFixed(1)}</span>
                <span className="weight-unit">kg</span>
              </div>
            </div>

            <div className="input-section">
              <span className="input-label">最后一组完成次数</span>
              <div className="reps-input-wrapper">
                <button 
                  type="button" 
                  className="reps-btn" 
                  onClick={() => adjustReps('T1', 'decrement')}
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  className="reps-input"
                  value={t1InputReps}
                  onChange={(e) => setT1InputReps(e.target.value)}
                  placeholder={t1PlannedReps.toString()}
                />
                <button 
                  type="button" 
                  className="reps-btn" 
                  onClick={() => adjustReps('T1', 'increment')}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {t1LastRecord && (
              <div className="card-history-preview">
                <span className="history-text">上次记录 ({t1LastRecord.training_day})</span>
                <span className="history-val">
                  {t1LastRecord.weight_kg.toFixed(1)}kg × 最后一组 {t1LastRecord.actual_last_set_reps}次
                </span>
              </div>
            )}
          </section>

          {/* T2 动作卡片 */}
          <section className="exercise-card t2-style" style={{ animationDelay: '0.2s' }}>
            <div className="card-header">
              <span className="exercise-title">{EXERCISE_NAMES_CN[t2Exercise]}</span>
              <span className="tier-badge t2">Tier T2</span>
            </div>

            <div className="scheme-box">
              <span className="scheme-desc">{t2SchemeText}</span>
              <div className="weight-display">
                <span className="weight-number">{t2Weight.toFixed(1)}</span>
                <span className="weight-unit">kg</span>
              </div>
            </div>

            <div className="input-section">
              <span className="input-label">最后一组完成次数</span>
              <div className="reps-input-wrapper">
                <button 
                  type="button" 
                  className="reps-btn" 
                  onClick={() => adjustReps('T2', 'decrement')}
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  className="reps-input"
                  value={t2InputReps}
                  onChange={(e) => setT2InputReps(e.target.value)}
                  placeholder={t2PlannedReps.toString()}
                />
                <button 
                  type="button" 
                  className="reps-btn" 
                  onClick={() => adjustReps('T2', 'increment')}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {t2LastRecord && (
              <div className="card-history-preview">
                <span className="history-text">上次记录 ({t2LastRecord.training_day})</span>
                <span className="history-val">
                  {t2LastRecord.weight_kg.toFixed(1)}kg × 最后一组 {t2LastRecord.actual_last_set_reps}次
                </span>
              </div>
            )}
          </section>

          {/* Save Action Button */}
          <div className="action-section">
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleSaveWorkout}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="spinner" style={{ width: 18, height: 18 }} />
                  <span>正在保存训练记录...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>保存今日训练</span>
                </>
              )}
            </button>
          </div>

          {/* 历史记录折叠面板 */}
          <button 
            type="button" 
            className="history-toggle"
            onClick={() => setShowRecentLogs(!showRecentLogs)}
          >
            <History size={16} />
            <span>{showRecentLogs ? '收起历史训练日志' : '展开最近历史记录'}</span>
          </button>

          {showRecentLogs && (
            <div className="recent-logs">
              <h3>最近 10 条单项记录</h3>
              {recentLogs.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>暂无训练记录</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="log-item">
                    <div>
                      <span className="log-name">{EXERCISE_NAMES_CN[log.exercise].split(' ')[0]}</span>
                      <span className={`log-tier ${log.tier.toLowerCase()}`}>{log.tier}</span>
                    </div>
                    <span className="log-detail">
                      {new Date(log.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} • {log.weight_kg.toFixed(1)}kg • {log.planned_reps * 2 + log.actual_last_set_reps}次({log.training_day})
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default App;
