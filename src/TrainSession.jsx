import React, { useState, useEffect, useRef } from 'react';
import { Minimize2, X, ChevronDown, ChevronUp, Check, Sparkles } from 'lucide-react';

/**
 * 实时训练会话记录屏幕组件 (全屏覆盖层)
 * 完全采用 Tailwind CSS + DaisyUI 组件进行重构，并遵循系统高级设计规范
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
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-main/98 dark:bg-bg-main-dark/98 backdrop-blur-lg p-4 max-w-[480px] w-full mx-auto overflow-hidden animate-fadeIn">
      
      {/* 顶部操作条 */}
      <div className="flex items-center justify-between border-b border-border-card dark:border-border-card-dark pb-3 mb-4 select-none">
        <button 
          type="button" 
          className="btn btn-ghost btn-sm text-text-secondary hover:text-text-main dark:text-text-secondary-dark dark:hover:text-text-main-dark flex items-center gap-1 cursor-pointer" 
          onClick={onMinimize}
          title="缩小为悬浮球"
        >
          <Minimize2 size={16} />
          <span className="text-xs font-medium">缩小</span>
        </button>
        
        <div className="text-sm font-bold text-text-main dark:text-text-main-dark">
          实时训练中 ({currentDay})
        </div>
        
        <button 
          type="button" 
          className="btn btn-ghost btn-sm text-alert dark:text-alert-dark flex items-center gap-1 cursor-pointer" 
          onClick={handleAbort}
          title="终止本次训练"
        >
          <X size={16} />
          <span className="text-xs font-medium">放弃</span>
        </button>
      </div>

      {/* 动作折叠组滚动区 */}
      <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-4 pb-24">

        {/* T1 动作手风琴卡片 */}
        <div 
          ref={t1CardRef} 
          className={`card bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark border-l-4 border-l-tier-t1 dark:border-l-tier-t1-dark transition-all duration-300 shadow-sm`}
        >
          {/* 头部导航区域 */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer select-none" 
            onClick={() => toggleAccordion(0)}
          >
            <div className="flex items-center gap-2">
              <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">T1</span>
              <span className="text-lg font-bold text-text-main dark:text-text-main-dark truncate max-w-[160px]">{getExerciseCNName(t1Exercise)}</span>
              <span className="text-sm font-mono font-bold bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/45 dark:border-border-card-dark/45 px-2.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">{t1Weight.toFixed(1)}kg</span>
            </div>
            <div className="text-text-secondary dark:text-text-secondary-dark">
              {expandedIndex === 0 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          {/* 手风琴主体 */}
          {expandedIndex === 0 && (
            <div className="p-4 pt-0 animate-fadeIn flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {t1Sets.map((set, idx) => {
                  const isLastSet = idx === t1Sets.length - 1;
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                        set.completed 
                          ? 'bg-primary/5 border-primary/20 opacity-70' 
                          : 'bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card/40 dark:border-border-card-dark/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={set.completed}
                        onChange={() => handleToggleSet('T1', idx)}
                        className="checkbox checkbox-primary checkbox-md cursor-pointer select-none"
                      />
                      
                      <span className={`text-sm font-bold text-text-main dark:text-text-main-dark select-none ${set.completed ? 'line-through opacity-50' : ''}`}>
                        第 {set.set_number} 组
                      </span>
                      
                      <span className={`text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none ${set.completed ? 'opacity-50' : ''}`}>
                        目标: {set.planned_reps}次
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className={`input input-bordered input-md h-9 w-[70px] text-center font-mono text-base font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            isLastSet ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-bg-card' : ''
                          }`}
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T1', idx, e.target.value)}
                        />
                        <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* T1 所有组均勾选，但还没进入 T2，显示流转按钮 */}
              {isTierFinished('T1') && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-block mt-1 font-semibold text-xs select-none shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
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
          className={`card bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark border-l-4 border-l-tier-t2 dark:border-l-tier-t2-dark transition-all duration-300 shadow-sm`}
        >
          <div 
            className="flex items-center justify-between p-4 cursor-pointer select-none" 
            onClick={() => toggleAccordion(1)}
          >
            <div className="flex items-center gap-2">
              <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">T2</span>
              <span className="text-lg font-bold text-text-main dark:text-text-main-dark truncate max-w-[160px]">{getExerciseCNName(t2Exercise)}</span>
              <span className="text-sm font-mono font-bold bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/45 dark:border-border-card-dark/45 px-2.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">{t2Weight.toFixed(1)}kg</span>
            </div>
            <div className="text-text-secondary dark:text-text-secondary-dark">
              {expandedIndex === 1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          {expandedIndex === 1 && (
            <div className="p-4 pt-0 animate-fadeIn flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {t2Sets.map((set, idx) => {
                  const isLastSet = idx === t2Sets.length - 1;
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                        set.completed 
                          ? 'bg-primary/5 border-primary/20 opacity-70' 
                          : 'bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card/40 dark:border-border-card-dark/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={set.completed}
                        onChange={() => handleToggleSet('T2', idx)}
                        className="checkbox checkbox-primary checkbox-md cursor-pointer select-none"
                      />
                      
                      <span className={`text-sm font-bold text-text-main dark:text-text-main-dark select-none ${set.completed ? 'line-through opacity-50' : ''}`}>
                        第 {set.set_number} 组
                      </span>
                      
                      <span className={`text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none ${set.completed ? 'opacity-50' : ''}`}>
                        目标: {set.planned_reps}次
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className={`input input-bordered input-md h-9 w-[70px] text-center font-mono text-base font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            isLastSet ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-bg-card' : ''
                          }`}
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T2', idx, e.target.value)}
                        />
                        <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isTierFinished('T2') && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-block mt-1 font-semibold text-xs select-none shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
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
          className={`card bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark border-l-4 border-l-tier-t3 dark:border-l-tier-t3-dark transition-all duration-300 shadow-sm`}
        >
          <div 
            className="flex items-center justify-between p-4 cursor-pointer select-none" 
            onClick={() => toggleAccordion(2)}
          >
            <div className="flex items-center gap-2">
              <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border-tier-t3/20 dark:border-tier-t3-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">T3</span>
              <span className="text-lg font-bold text-text-main dark:text-text-main-dark truncate max-w-[160px]">{getExerciseCNName(t3Exercise)}</span>
              <span className="text-sm font-mono font-bold bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/45 dark:border-border-card-dark/45 px-2.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">{t3Weight.toFixed(1)}kg</span>
            </div>
            <div className="text-text-secondary dark:text-text-secondary-dark">
              {expandedIndex === 2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          {expandedIndex === 2 && (
            <div className="p-4 pt-0 animate-fadeIn flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {t3Sets.map((set, idx) => {
                  const isLastSet = idx === t3Sets.length - 1;
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                        set.completed 
                          ? 'bg-primary/5 border-primary/20 opacity-70' 
                          : 'bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card/40 dark:border-border-card-dark/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={set.completed}
                        onChange={() => handleToggleSet('T3', idx)}
                        className="checkbox checkbox-primary checkbox-md cursor-pointer select-none"
                      />
                      
                      <span className={`text-sm font-bold text-text-main dark:text-text-main-dark select-none ${set.completed ? 'line-through opacity-50' : ''}`}>
                        第 {set.set_number} 组
                      </span>
                      
                      <span className={`text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none ${set.completed ? 'opacity-50' : ''}`}>
                        目标: {set.planned_reps}次
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className={`input input-bordered input-md h-9 w-[70px] text-center font-mono text-base font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            isLastSet ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-bg-card' : ''
                          }`}
                          value={set.actual_reps}
                          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
                          onChange={(e) => handleRepsChange('T3', idx, e.target.value)}
                        />
                        <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
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
          <div className="mt-4 px-1 pb-8 animate-fadeIn">
            <button 
              type="button" 
              className="btn btn-success btn-lg btn-block text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 select-none cursor-pointer" 
              onClick={onSave}
            >
              <Sparkles size={18} />
              <span>完成今日训练打卡</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default TrainSession;
