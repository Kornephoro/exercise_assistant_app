import React from 'react';
import { Play, RotateCcw, CheckCircle, Heart, Utensils, Calendar } from 'lucide-react';

/**
 * 今日概览页面组件 - 展示今日训练卡片式流布局、即将推出功能占位、以及完成训练后的打卡摘要
 * 
 * @param {Object} props
 * @param {string} props.currentDay 当前训练日 (如 'Day1')
 * @param {string} props.t1Exercise T1动作名
 * @param {string} props.t2Exercise T2动作名
 * @param {string} props.t3Exercise T3动作名
 * @param {number} props.t1Weight T1建议重量 (kg)
 * @param {number} props.t2Weight T2建议重量 (kg)
 * @param {number} props.t3Weight T3建议重量 (kg)
 * @param {number} props.t1PlannedReps T1计划次数
 * @param {number} props.t2PlannedReps T2计划次数
 * @param {number} props.t3PlannedReps T3计划次数
 * @param {string} props.t1SchemeText T1方案文本描述
 * @param {string} props.t2SchemeText T2方案文本描述
 * @param {string} props.t3SchemeText T3方案文本描述
 * @param {Object} props.sessionState 实时训练会话全局状态
 * @param {Function} props.onStartTrain 开始或恢复训练的回调函数
 * @param {Function} props.getIncrementStep 获取动作进阶步长的辅助函数
 * @param {Function} props.getExerciseCNName 获取中文翻译动作名称的辅助函数
 * @param {boolean} props.isTodayCompleted 今日训练是否已完成
 * @param {Array} props.todayWorkoutSummary 今日打卡完成后的详细汇总明细
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
  sessionState,
  onStartTrain,
  getIncrementStep,
  getExerciseCNName,
  isTodayCompleted,
  todayWorkoutSummary
}) {
  const isSessionActive = sessionState && sessionState.isActive;

  // 根据计划数反推组数
  const getT1TotalSets = (reps) => {
    if (reps === 3) return 5;
    if (reps === 2) return 6;
    if (reps === 1) return 10;
    return 5;
  };

  // 提取动作的中文简称（例如 “深蹲 (Squat)” 提取成 “深蹲”）
  const getExerciseShortName = (exercise) => {
    const cnName = getExerciseCNName(exercise);
    return cnName.split(' ')[0].split('(')[0].trim();
  };

  // 组装格式化过的今日日期副标题
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div className="today-screen animate-fadeIn">
      {/* 头部区：包含训练日及日期副标题 */}
      <div className="today-screen-header">
        <h2 className="today-day-title">
          {isTodayCompleted 
            ? `${todayWorkoutSummary[0]?.training_day || currentDay} · 训练完成`
            : `${currentDay} · ${getExerciseShortName(t1Exercise)}日`
          }
        </h2>
        <p className="today-date-subtitle">
          <Calendar size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'text-bottom' }} />
          {getFormattedDate()}
        </p>
      </div>

      <div className="today-card-flow">
        
        {/* 情况 A：今日已完成训练打卡 */}
        {isTodayCompleted ? (
          <div className="today-item-card completed-summary-card animate-fadeIn">
            <div className="completed-header">
              <CheckCircle className="completed-check-icon" size={48} />
              <h3>今日训练已完成 ✅</h3>
              <p className="completed-message">你今天做得棒极了！以下是你的训练摘要：</p>
            </div>
            
            <div className="completed-workout-details">
              {todayWorkoutSummary.map((log, idx) => (
                <div key={log.id || idx} className={`completed-log-row ${log.tier.toLowerCase()}-border`}>
                  <div className="log-row-info">
                    <span className={`tier-badge-small ${log.tier.toLowerCase()}`}>{log.tier}</span>
                    <span className="log-exercise-title">{getExerciseCNName(log.exercise)}</span>
                  </div>
                  <div className="log-row-result">
                    <span className="log-weight">{log.weight_kg.toFixed(1)}kg</span>
                    <span className="log-reps">
                      最后一组 <strong>{log.actual_last_set_reps}</strong> 次
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 情况 B：今日未完成训练，展示今日训练安排 */
          <div className="today-item-card plan-summary-card animate-fadeIn" onClick={onStartTrain}>
            <div className="card-header-row">
              <span className="badge-outline">今日安排</span>
              <span className="start-btn-inline">开始训练</span>
            </div>
            
            <h3 className="plan-title">{getExerciseShortName(t1Exercise)} / {getExerciseShortName(t2Exercise)} 训练日</h3>
            
            <div className="plan-summary-list">
              {/* T1 动作 */}
              <div className="plan-row">
                <span className="tier-dot t1">T1</span>
                <div className="plan-row-body">
                  <span className="plan-exercise-name">{getExerciseCNName(t1Exercise)}</span>
                  <span className="plan-scheme">{getT1TotalSets(t1PlannedReps)}组 × {t1PlannedReps}次</span>
                </div>
                <span className="plan-weight">{t1Weight.toFixed(1)}kg</span>
              </div>
              
              {/* T2 动作 */}
              <div className="plan-row">
                <span className="tier-dot t2">T2</span>
                <div className="plan-row-body">
                  <span className="plan-exercise-name">{getExerciseCNName(t2Exercise)}</span>
                  <span className="plan-scheme">3组 × {t2PlannedReps}次</span>
                </div>
                <span className="plan-weight">{t2Weight.toFixed(1)}kg</span>
              </div>
              
              {/* T3 动作 */}
              <div className="plan-row">
                <span className="tier-dot t3">T3</span>
                <div className="plan-row-body">
                  <span className="plan-exercise-name">{getExerciseCNName(t3Exercise)}</span>
                  <span className="plan-scheme">3组 × {t3PlannedReps}次</span>
                </div>
                <span className="plan-weight">{t3Weight.toFixed(1)}kg</span>
              </div>
            </div>
          </div>
        )}

        {/* 占位卡片 2：身体状态 (Coming Soon) */}
        <div className="today-item-card placeholder-card">
          <div className="card-header-row">
            <span className="placeholder-icon-text">
              <Heart size={16} className="heart-icon" />
              <span>身体状态</span>
            </span>
            <span className="placeholder-badge">即将推出</span>
          </div>
          <div className="placeholder-body">
            <p className="placeholder-desc">记录每日晨重、体脂率，并追踪肌肉维度与恢复状态。</p>
          </div>
        </div>

        {/* 占位卡片 3：今日饮食摘要 (Coming Soon) */}
        <div className="today-item-card placeholder-card">
          <div className="card-header-row">
            <span className="placeholder-icon-text">
              <Utensils size={16} className="utensils-icon" />
              <span>今日饮食摘要</span>
            </span>
            <span className="placeholder-badge">即将推出</span>
          </div>
          <div className="placeholder-body">
            <p className="placeholder-desc">跟踪蛋白质、碳水及卡路里摄入，为力量进步提供坚实营养保障。</p>
          </div>
        </div>

      </div>

      {/* 底部固定操作按钮区 */}
      <div className="today-action-area">
        {isTodayCompleted ? (
          <button 
            type="button" 
            className="btn-primary start-session-btn disabled-completed-btn"
            disabled
          >
            <CheckCircle size={20} />
            <span>今日训练已完成 ✅</span>
          </button>
        ) : (
          <button 
            type="button" 
            className={`btn-primary start-session-btn ${isSessionActive ? 'pulse-btn' : ''}`}
            onClick={onStartTrain}
          >
            {isSessionActive ? (
              <>
                <RotateCcw size={20} />
                <span>恢复进行中的训练</span>
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                <span>开始今日训练 ({currentDay})</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default TodayScreen;
