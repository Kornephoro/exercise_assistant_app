import React, { useState, useEffect, useRef } from 'react';
import { Minimize2, X, ChevronDown, ChevronUp, Check, AlertTriangle, Sparkles } from 'lucide-react';

/**
 * 实时训练会话记录屏幕组件 (全屏覆盖层)
 * 
 * @param {Object} props
 * @param {string} props.currentDay 当前训练日 (如 'Day1')
 * @param {Object} props.sessionState 实时训练会话全局状态
 * @param {Function} props.setSessionState 全局训练状态更新器
 * @param {string} props.t1Exercise T1动作名
 * @param {string} props.t2Exercise T2动作名
 * @param {string} props.t3Exercise T3动作名
 * @param {number} props.t1Weight T1今日重量
 * @param {number} props.t2Weight T2今日重量
 * @param {number} props.t3Weight T3今日重量
 * @param {Function} props.getExerciseCNName 获取中文名翻译
 * @param {Function} props.onMinimize 缩小隐藏训练层回调
 * @param {Function} props.onSave 保存训练数据回调
 * @param {Function} props.onCancel 终止并销毁训练回调
 */
function TrainSession({
  currentDay,
  sessionState,
  setSessionState,
  t1Exercise,
  t2Exercise,
  t3Exercise,
  t1Weight,
  t2Weight,
  t3Weight,
  getExerciseCNName,
  onMinimize,
  onSave,
  onCancel
}) {
  // 控制折叠手风琴状态 (0: T1, 1: T2, 2: T3)
  const [expandedIndex, setExpandedIndex] = useState(0);
  
  // 用于平滑滚动的 DOM Ref
  const t1CardRef = useRef(null);
  const t2CardRef = useRef(null);
  const t3CardRef = useRef(null);

  // 1. 手动切换手风琴展开
  const toggleAccordion = (index) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  // 2. 检查某 Tier 是否所有组都已完成勾选
  const isTierFinished = (tier) => {
    const sets = sessionState.setsData[tier] || [];
    return sets.length > 0 && sets.every(s => s.completed);
  };

  // 3. 检查所有三个动作的所有组是否全部完成
  const isSessionFinished = () => {
    return isTierFinished('T1') && isTierFinished('T2') && isTierFinished('T3');
  };

  // 4. 用户勾选某组
  const handleToggleSet = (tier, setIndex) => {
    const updatedSetsData = { ...sessionState.setsData };
    const targetSet = updatedSetsData[tier][setIndex];
    targetSet.completed = !targetSet.completed;

    // 勾选后，若实际次数为空，设为计划预定次数作为默认值
    if (targetSet.completed && (targetSet.actual_reps === '' || targetSet.actual_reps === undefined)) {
      targetSet.actual_reps = targetSet.planned_reps;
    }

    setSessionState(prev => ({
      ...prev,
      setsData: updatedSetsData
    }));
  };

  // 5. 用户修改单组实际次数
  const handleRepsChange = (tier, setIndex, value) => {
    const updatedSetsData = { ...sessionState.setsData };
    // 强制转换为数字或保留为空白字符串
    updatedSetsData[tier][setIndex].actual_reps = value === '' ? '' : parseInt(value, 10);
    
    setSessionState(prev => ({
      ...prev,
      setsData: updatedSetsData
    }));
  };

  // 6. 流转到下一个动作并平滑滚动
  const handleGoToNext = (nextIndex) => {
    setExpandedIndex(nextIndex);
    
    // 短暂延迟等卡片展开后执行平滑滚动
    setTimeout(() => {
      const targetRef = nextIndex === 1 ? t2CardRef : t3CardRef;
      if (targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // 7. 取消/终止并丢弃数据
  const handleAbort = () => {
    if (window.confirm("确定结束本次训练？所有当前已记录的组进度将被丢弃且无法找回。")) {
      onCancel();
    }
  };

  const t1Sets = sessionState.setsData.T1 || [];
  const t2Sets = sessionState.setsData.T2 || [];
  const t3Sets = sessionState.setsData.T3 || [];

  return (
    <div className="train-session-overlay">
      
      {/* 顶部操作条 */}
      <div className="train-session-header">
        <button 
          type="button" 
          className="header-btn minimize" 
          onClick={onMinimize}
          title="缩小为悬浮球"
        >
          <Minimize2 size={20} />
          <span>缩小</span>
        </button>
        <div className="header-title">
          <span>实时训练中 ({currentDay})</span>
        </div>
        <button 
          type="button" 
          className="header-btn abort" 
          onClick={handleAbort}
          title="终止本次训练"
        >
          <X size={20} />
          <span>放弃</span>
        </button>
      </div>

      {/* 动作折叠组内容区 */}
      <div className="train-session-scroll-area">

        {/* T1 动作手风琴卡片 */}
        <div 
          ref={t1CardRef} 
          className={`accordion-card t1-border ${expandedIndex === 0 ? 'active' : ''}`}
        >
          <div className="accordion-head" onClick={() => toggleAccordion(0)}>
            <div className="head-info">
              <span className="accordion-badge t1">T1</span>
              <span className="accordion-title">{getExerciseCNName(t1Exercise)}</span>
              <span className="accordion-weight">{t1Weight.toFixed(1)}kg</span>
            </div>
            {expandedIndex === 0 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {expandedIndex === 0 && (
            <div className="accordion-body animate-fadeIn">
              <div className="sets-list">
                {t1Sets.map((set, idx) => {
                  const isLastSet = idx === t1Sets.length - 1;
                  return (
                    <div key={idx} className={`set-row ${set.completed ? 'done' : ''} ${isLastSet ? 'last-set-highlight' : ''}`}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={set.completed}
                          onChange={() => handleToggleSet('T1', idx)}
                        />
                        <span className="checkmark">
                          <Check size={14} className="check-icon" />
                        </span>
                      </label>
                      
                      <span className="set-num-label">第 {set.set_number} 组</span>
                      
                      <span className="set-target">目标: {set.planned_reps}次</span>
                      
                      <div className="set-input-wrapper">
                        <input
                          type="number"
                          className="actual-reps-input"
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T1', idx, e.target.value)}
                        />
                        <span className="input-suffix">次</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* T1 所有组均勾选，但还没进入 T2，显示流转按钮 */}
              {isTierFinished('T1') && (
                <button
                  type="button"
                  className="btn-next-action t1-bg-btn"
                  onClick={() => handleGoToNext(1)}
                >
                  完成 T1，进入下一个动作 T2
                </button>
              )}
            </div>
          )}
        </div>

        {/* T2 动作手风琴卡片 */}
        <div 
          ref={t2CardRef} 
          className={`accordion-card t2-border ${expandedIndex === 1 ? 'active' : ''}`}
        >
          <div className="accordion-head" onClick={() => toggleAccordion(1)}>
            <div className="head-info">
              <span className="accordion-badge t2">T2</span>
              <span className="accordion-title">{getExerciseCNName(t2Exercise)}</span>
              <span className="accordion-weight">{t2Weight.toFixed(1)}kg</span>
            </div>
            {expandedIndex === 1 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {expandedIndex === 1 && (
            <div className="accordion-body animate-fadeIn">
              <div className="sets-list">
                {t2Sets.map((set, idx) => {
                  const isLastSet = idx === t2Sets.length - 1;
                  return (
                    <div key={idx} className={`set-row ${set.completed ? 'done' : ''} ${isLastSet ? 'last-set-highlight' : ''}`}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={set.completed}
                          onChange={() => handleToggleSet('T2', idx)}
                        />
                        <span className="checkmark">
                          <Check size={14} className="check-icon" />
                        </span>
                      </label>
                      <span className="set-num-label">第 {set.set_number} 组</span>
                      <span className="set-target">目标: {set.planned_reps}次</span>
                      <div className="set-input-wrapper">
                        <input
                          type="number"
                          className="actual-reps-input"
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T2', idx, e.target.value)}
                        />
                        <span className="input-suffix">次</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isTierFinished('T2') && (
                <button
                  type="button"
                  className="btn-next-action t2-bg-btn"
                  onClick={() => handleGoToNext(2)}
                >
                  完成 T2，进入下一个动作 T3
                </button>
              )}
            </div>
          )}
        </div>

        {/* T3 动作手风琴卡片 */}
        <div 
          ref={t3CardRef} 
          className={`accordion-card t3-border ${expandedIndex === 2 ? 'active' : ''}`}
        >
          <div className="accordion-head" onClick={() => toggleAccordion(2)}>
            <div className="head-info">
              <span className="accordion-badge t3">T3</span>
              <span className="accordion-title">{getExerciseCNName(t3Exercise)}</span>
              <span className="accordion-weight">{t3Weight.toFixed(1)}kg</span>
            </div>
            {expandedIndex === 2 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {expandedIndex === 2 && (
            <div className="accordion-body animate-fadeIn">
              <div className="sets-list">
                {t3Sets.map((set, idx) => {
                  const isLastSet = idx === t3Sets.length - 1;
                  return (
                    <div key={idx} className={`set-row ${set.completed ? 'done' : ''} ${isLastSet ? 'last-set-highlight' : ''}`}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={set.completed}
                          onChange={() => handleToggleSet('T3', idx)}
                        />
                        <span className="checkmark">
                          <Check size={14} className="check-icon" />
                        </span>
                      </label>
                      <span className="set-num-label">第 {set.set_number} 组</span>
                      <span className="set-target">目标: {set.planned_reps}次</span>
                      <div className="set-input-wrapper">
                        <input
                          type="number"
                          className="actual-reps-input"
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T3', idx, e.target.value)}
                        />
                        <span className="input-suffix">次</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部保存大按钮 - 当全部动作的所有组均勾选后渲染 */}
        {isSessionFinished() && (
          <div className="session-finish-area animate-fadeIn" style={{ padding: '0 8px 30px 8px', marginTop: '20px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)' }}
              onClick={onSave}
            >
              <Sparkles size={20} />
              <span>完成今日训练打卡</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default TrainSession;
