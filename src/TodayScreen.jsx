import React from 'react';
import { Dumbbell, Sparkles, Play, RotateCcw } from 'lucide-react';

/**
 * 今日概览页面组件 - 展示今日训练计划概况并作为实时打卡的入口
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
 * @param {Object} props.sessionState 实时训练会话状态
 * @param {Function} props.onStartTrain 触发开始或恢复训练的回调函数
 * @param {Function} props.getIncrementStep 获取动作进阶步长的辅助函数
 * @param {Function} props.getExerciseCNName 获取中文翻译动作名称的辅助函数
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
  getExerciseCNName
}) {
  const isSessionActive = sessionState && sessionState.isActive;

  // 根据计划数反推组数
  const getT1TotalSets = (reps) => {
    if (reps === 3) return 5;
    if (reps === 2) return 6;
    if (reps === 1) return 10;
    return 5;
  };

  return (
    <div className="today-screen animate-fadeIn">
      {/* 动作概览列表 */}
      <div className="today-plan-list">
        
        {/* T1 动作卡片 */}
        <div className="today-item-card t1-border">
          <div className="item-card-head">
            <span className="badge t1">Tier T1</span>
            <span className="increment-tip">⚡️成功 +{getIncrementStep(t1Exercise, 'T1')}kg</span>
          </div>
          <div className="item-card-body">
            <h3 className="exercise-title">{getExerciseCNName(t1Exercise)}</h3>
            <p className="scheme-desc">今日目标：{getT1TotalSets(t1PlannedReps)} 组 × {t1PlannedReps} 次 (最后一组AMRAP)</p>
          </div>
          <div className="item-card-weight">
            <span className="weight-val">{t1Weight.toFixed(1)}</span>
            <span className="weight-unit">kg</span>
          </div>
        </div>

        {/* T2 动作卡片 */}
        <div className="today-item-card t2-border">
          <div className="item-card-head">
            <span className="badge t2">Tier T2</span>
            <span className="increment-tip">⚡️升级 +{getIncrementStep(t2Exercise, 'T2')}kg</span>
          </div>
          <div className="item-card-body">
            <h3 className="exercise-title">{getExerciseCNName(t2Exercise)}</h3>
            <p className="scheme-desc">今日目标：3 组 × {t2PlannedReps} 次 (最后一组AMRAP)</p>
          </div>
          <div className="item-card-weight">
            <span className="weight-val">{t2Weight.toFixed(1)}</span>
            <span className="weight-unit">kg</span>
          </div>
        </div>

        {/* T3 动作卡片 */}
        <div className="today-item-card t3-border">
          <div className="item-card-head">
            <span className="badge t3">Tier T3</span>
            <span className="increment-tip">⚡️成功 +{getIncrementStep(t3Exercise, 'T3')}kg</span>
          </div>
          <div className="item-card-body">
            <h3 className="exercise-title">{getExerciseCNName(t3Exercise)}</h3>
            <p className="scheme-desc">今日目标：3 组 × {t3PlannedReps} 次 (最后一组AMRAP)</p>
          </div>
          <div className="item-card-weight">
            <span className="weight-val">{t3Weight.toFixed(1)}</span>
            <span className="weight-unit">kg</span>
          </div>
        </div>

      </div>

      {/* 动作大按钮 */}
      <div className="today-action-area" style={{ marginTop: '28px' }}>
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
              <Play size={20} fill="white" />
              <span>开始今日训练 ({currentDay})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TodayScreen;
