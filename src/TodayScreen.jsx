import React from 'react';
import { 
  Plus, 
  Minus, 
  Loader2, 
  Sparkles,
  History
} from 'lucide-react';

/**
 * 今日训练屏幕组件 - 呈现并记录 GZCLP 当日训练动作与组次数
 * 
 * @param {Object} props
 * @param {string} props.currentDay 当前训练日 (如 'Day1')
 * @param {string} props.t1Exercise T1动作名代号
 * @param {string} props.t2Exercise T2动作名代号
 * @param {string} props.t3Exercise T3动作名代号
 * @param {number} props.t1Weight T1建议重量 (kg)
 * @param {number} props.t2Weight T2建议重量 (kg)
 * @param {number} props.t3Weight T3建议重量 (kg)
 * @param {number} props.t1PlannedReps T1预定次数
 * @param {number} props.t2PlannedReps T2预定次数
 * @param {number} props.t3PlannedReps T3预定次数
 * @param {string} props.t1SchemeText T1方案文本
 * @param {string} props.t2SchemeText T2方案文本
 * @param {string} props.t3SchemeText T3方案文本
 * @param {Object|null} props.t1LastRecord T1历史对比记录
 * @param {Object|null} props.t2LastRecord T2历史对比记录
 * @param {Object|null} props.t3LastRecord T3历史对比记录
 * @param {string} props.t1InputReps T1最后一组实际输入次数
 * @param {string} props.t2InputReps T2最后一组实际输入次数
 * @param {string} props.t3InputReps T3最后一组实际输入次数
 * @param {Function} props.setT1InputReps 更新 T1 输入的回调
 * @param {Function} props.setT2InputReps 更新 T2 输入的回调
 * @param {Function} props.setT3InputReps 更新 T3 输入的回调
 * @param {Array} props.recentLogs 最近10条日志数组
 * @param {boolean} props.showRecentLogs 是否展示历史日志面板
 * @param {Function} props.setShowRecentLogs 切换展示历史日志面板的回调
 * @param {boolean} props.saving 是否处于保存记录中的状态
 * @param {Function} props.handleSaveWorkout 保存训练记录的触发回调
 * @param {Function} props.adjustReps 次数加减辅助微调函数
 * @param {Function} props.getIncrementStep 获取某动作进阶步长的辅助函数
 * @param {Function} props.getExerciseCNName 获取动作中文翻译名称的辅助函数
 */
function TodayScreen({
  currentDay,
  t1Exercise,
  t2Exercise,
  t3Exercise,
  t1Weight,
  t2Weight,
  t3Weight,
  t1PlannedReps,
  t2PlannedReps,
  t3PlannedReps,
  t1SchemeText,
  t2SchemeText,
  t3SchemeText,
  t1LastRecord,
  t2LastRecord,
  t3LastRecord,
  t1InputReps,
  t2InputReps,
  t3InputReps,
  setT1InputReps,
  setT2InputReps,
  setT3InputReps,
  recentLogs,
  showRecentLogs,
  setShowRecentLogs,
  saving,
  handleSaveWorkout,
  adjustReps,
  getIncrementStep,
  getExerciseCNName
}) {
  return (
    <>
      {/* T1 动作卡片 */}
      <section className="exercise-card t1-style" style={{ animationDelay: '0.1s' }}>
        <div className="card-header">
          <span className="exercise-title">{getExerciseCNName(t1Exercise)}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-t1)', fontWeight: 700 }}>
              ⚡️成功 +{getIncrementStep(t1Exercise, 'T1')}kg
            </span>
            <span className="tier-badge t1">Tier T1</span>
          </div>
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
          <span className="exercise-title">{getExerciseCNName(t2Exercise)}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-t2)', fontWeight: 700 }}>
              ⚡️升级 +{getIncrementStep(t2Exercise, 'T2')}kg
            </span>
            <span className="tier-badge t2">Tier T2</span>
          </div>
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

      {/* T3 动作卡片 */}
      <section className="exercise-card t3-style" style={{ animationDelay: '0.3s' }}>
        <div className="card-header">
          <span className="exercise-title">{getExerciseCNName(t3Exercise)}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-t3)', fontWeight: 700 }}>
              ⚡️成功 +{getIncrementStep(t3Exercise, 'T3')}kg
            </span>
            <span className="tier-badge t3">Tier T3</span>
          </div>
        </div>

        <div className="scheme-box">
          <span className="scheme-desc">{t3SchemeText}</span>
          <div className="weight-display">
            <span className="weight-number">{t3Weight.toFixed(1)}</span>
            <span className="weight-unit">kg</span>
          </div>
        </div>

        <div className="input-section">
          <span className="input-label">最后一组完成次数</span>
          <div className="reps-input-wrapper">
            <button 
              type="button" 
              className="reps-btn" 
              onClick={() => adjustReps('T3', 'decrement')}
            >
              <Minus size={16} />
            </button>
            <input 
              type="number" 
              className="reps-input"
              value={t3InputReps}
              onChange={(e) => setT3InputReps(e.target.value)}
              placeholder={t3PlannedReps.toString()}
            />
            <button 
              type="button" 
              className="reps-btn" 
              onClick={() => adjustReps('T3', 'increment')}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {t3LastRecord && (
          <div className="card-history-preview">
            <span className="history-text">上次记录 ({t3LastRecord.training_day})</span>
            <span className="history-val">
              {t3LastRecord.weight_kg.toFixed(1)}kg × 最后一组 {t3LastRecord.actual_last_set_reps}次
            </span>
          </div>
        )}
      </section>

      {/* 保存今日训练按钮 */}
      <div className="action-section" style={{ marginBottom: '20px' }}>
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

      {/* 历史日志面板 */}
      <button 
        type="button" 
        className="history-toggle"
        onClick={() => setShowRecentLogs(!showRecentLogs)}
      >
        <History size={16} />
        <span>{showRecentLogs ? '收起历史训练日志' : '展开最近历史记录'}</span>
      </button>

      {showRecentLogs && (
        <div className="recent-logs" style={{ marginBottom: '40px' }}>
          <h3>最近 10 条单项记录</h3>
          {recentLogs.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>暂无训练记录</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="log-item">
                <div>
                  <span className="log-name">{getExerciseCNName(log.exercise).split(' ')[0]}</span>
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
  );
}

export default TodayScreen;
