import React, { useState, useEffect, useRef } from 'react';
import { Minimize2, X, ChevronDown, ChevronUp, Check, Sparkles } from 'lucide-react';

/**
 * 实时训练会话记录屏幕组件 (全屏覆盖层)
 * 根据动作的 recording_method 动态渲染不同输入项
 *
 * @param {Object} props
 * @param {string} props.currentDay 当前训练日 (如 'Day1')
 * @param {Object} props.sessionState 实时训练会话全局状态
 * @param {Function} props.setSessionState 全局训练状态更新器
 * @param {Object} props.todayWorkout 引擎输出的今日训练数据 { exercises, dayLabel }
 * @param {Function} props.getExerciseCNName 获取中文名翻译
 * @param {Object} props.exercisesMap 动作库全量数据 map
 * @param {Function} props.onMinimize 缩小隐藏训练层回调
 * @param {Function} props.onSave 保存训练数据回调
 * @param {Function} props.onCancel 终止并销毁训练回调
 */
function TrainSession({
  currentDay,
  sessionState,
  setSessionState,
  todayWorkout,
  exercisesMap,
  getExerciseCNName,
  onMinimize,
  onSave,
  onCancel
}) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  const getRecordingMethod = (exerciseKey) => {
    return exercisesMap?.[exerciseKey]?.recording_method || 'standard';
  };

  const toggleAccordion = (index) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  const isTierFinished = (tier) => {
    const sets = sessionState.setsData[tier] || [];
    return sets.length > 0 && sets.every(s => s.completed);
  };

  const isSessionFinished = () => {
    return isTierFinished('T1') && isTierFinished('T2') && isTierFinished('T3');
  };

  const handleToggleSet = (tier, setIndex) => {
    const updatedSetsData = { ...sessionState.setsData };
    const targetSet = updatedSetsData[tier][setIndex];
    targetSet.completed = !targetSet.completed;

    if (targetSet.completed) {
      if (targetSet.actual_reps === '' || targetSet.actual_reps === undefined) {
        targetSet.actual_reps = targetSet.planned_reps;
      }
    }

    setSessionState(prev => ({
      ...prev,
      setsData: updatedSetsData
    }));
  };

  const handleRepsChange = (tier, setIndex, value) => {
    const updatedSetsData = { ...sessionState.setsData };
    updatedSetsData[tier][setIndex].actual_reps = value === '' ? '' : parseInt(value, 10);
    setSessionState(prev => ({ ...prev, setsData: updatedSetsData }));
  };

  const handleWeightChange = (tier, setIndex, value) => {
    const updatedSetsData = { ...sessionState.setsData };
    updatedSetsData[tier][setIndex].weight_kg = value === '' ? 0 : parseFloat(value);
    setSessionState(prev => ({ ...prev, setsData: updatedSetsData }));
  };

  const handleDurationChange = (tier, setIndex, value) => {
    const updatedSetsData = { ...sessionState.setsData };
    updatedSetsData[tier][setIndex].duration_seconds = value === '' ? 0 : parseInt(value, 10);
    setSessionState(prev => ({ ...prev, setsData: updatedSetsData }));
  };

  const handleDistanceChange = (tier, setIndex, value) => {
    const updatedSetsData = { ...sessionState.setsData };
    updatedSetsData[tier][setIndex].distance_meters = value === '' ? 0 : parseFloat(value);
    setSessionState(prev => ({ ...prev, setsData: updatedSetsData }));
  };

  const handleGoToNext = (nextIndex) => {
    setExpandedIndex(nextIndex);
    setTimeout(() => {
      if (cardRefs[nextIndex]?.current) {
        cardRefs[nextIndex].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const handleAbort = () => {
    if (window.confirm("确定结束本次训练？所有当前已记录的组进度将被丢弃且无法找回。")) {
      onCancel();
    }
  };

  const renderSetInputs = (tier, set, idx, setsLength, exerciseKey) => {
    const method = getRecordingMethod(exerciseKey);
    const isLastSet = idx === setsLength - 1;
    const completedClass = set.completed ? 'line-through opacity-50' : '';

    const inputBaseClass = `input input-bordered input-md h-9 text-center font-mono text-base font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
      isLastSet ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-bg-card' : ''
    }`;

    if (method === 'duration_only') {
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className={`${inputBaseClass} w-[80px]`}
            value={set.duration_seconds || ''}
            placeholder="秒"
            onChange={(e) => handleDurationChange(tier, idx, e.target.value)}
          />
          <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">秒</span>
        </div>
      );
    }

    if (method === 'distance_only') {
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className={`${inputBaseClass} w-[80px]`}
            value={set.distance_meters || ''}
            placeholder="米"
            step="0.1"
            onChange={(e) => handleDistanceChange(tier, idx, e.target.value)}
          />
          <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">米</span>
        </div>
      );
    }

    if (method === 'loaded_carry') {
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className={`${inputBaseClass} w-[70px]`}
            value={set.distance_meters || ''}
            placeholder="米"
            step="0.1"
            onChange={(e) => handleDistanceChange(tier, idx, e.target.value)}
          />
          <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">米</span>
          <input
            type="number"
            className={`${inputBaseClass} w-[65px]`}
            value={set.weight_kg || ''}
            placeholder="kg"
            step="0.5"
            onChange={(e) => handleWeightChange(tier, idx, e.target.value)}
          />
          <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
        </div>
      );
    }

    // standard, reps_only, bodyweight_added, bodyweight_assisted
    const showWeight = ['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(method);
    const weightLabel = method === 'bodyweight_added' ? '附加' : method === 'bodyweight_assisted' ? '辅助' : null;

    return (
      <div className="flex items-center gap-1.5">
        {showWeight && (
          <>
            <input
              type="number"
              className={`${inputBaseClass} w-[70px]`}
              value={set.weight_kg}
              placeholder="kg"
              step="0.5"
              onChange={(e) => handleWeightChange(tier, idx, e.target.value)}
            />
            <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">
              {weightLabel || 'kg'}
            </span>
          </>
        )}
        <input
          type="number"
          className={`${inputBaseClass} w-[70px]`}
          value={set.actual_reps}
          placeholder={isLastSet ? 'AMRAP' : set.planned_reps.toString()}
          onChange={(e) => handleRepsChange(tier, idx, e.target.value)}
        />
        <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
      </div>
    );
  };

  const renderTargetInfo = (set, exerciseKey) => {
    const method = getRecordingMethod(exerciseKey);
    if (method === 'duration_only') {
      return <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none">时长</span>;
    }
    if (method === 'distance_only') {
      return <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none">距离</span>;
    }
    if (method === 'loaded_carry') {
      return <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none">距离+重量</span>;
    }
    return (
      <span className={`text-sm text-text-secondary dark:text-text-secondary-dark font-bold select-none ${set.completed ? 'opacity-50' : ''}`}>
        目标: {set.planned_reps}次
      </span>
    );
  };

  const renderTierCard = (tier, exerciseKey, weight, tierIndex, cardRef, tierColor) => {
    const sets = sessionState.setsData[tier] || [];
    const isExpanded = expandedIndex === tierIndex;

    return (
      <div
        ref={cardRef}
        className={`card bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark border-l-4 border-l-tier-${tierColor} dark:border-l-tier-${tierColor}-dark transition-all duration-300 shadow-sm`}
      >
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => toggleAccordion(tierIndex)}
        >
          <div className="flex items-center gap-2">
            <span className={`badge bg-tier-${tierColor}/10 text-tier-${tierColor} dark:text-tier-${tierColor}-dark border-tier-${tierColor}/20 dark:border-tier-${tierColor}-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded`}>
              {tier}
            </span>
            <span className="text-lg font-bold text-text-main dark:text-text-main-dark truncate max-w-[160px]">
              {getExerciseCNName(exerciseKey)}
            </span>
            <span className="text-sm font-mono font-bold bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/45 dark:border-border-card-dark/45 px-2.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">
              {weight.toFixed(1)}kg
            </span>
          </div>
          <div className="text-text-secondary dark:text-text-secondary-dark">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 pt-0 animate-fadeIn flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {sets.map((set, idx) => (
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
                    onChange={() => handleToggleSet(tier, idx)}
                    className="checkbox checkbox-primary checkbox-md cursor-pointer select-none"
                  />

                  <span className={`text-sm font-bold text-text-main dark:text-text-main-dark select-none ${set.completed ? 'line-through opacity-50' : ''}`}>
                    第 {set.set_number} 组
                  </span>

                  {renderTargetInfo(set, exerciseKey)}

                  {renderSetInputs(tier, set, idx, sets.length, exerciseKey)}
                </div>
              ))}
            </div>

            {isTierFinished(tier) && tierIndex < (todayWorkout?.exercises?.length || 3) - 1 && (
              <button
                type="button"
                className="btn btn-primary btn-sm btn-block mt-1 font-semibold text-xs select-none shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                onClick={() => handleGoToNext(tierIndex + 1)}
              >
                完成 {tier}，进入下一个动作
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-main/98 dark:bg-bg-main-dark/98 backdrop-blur-lg p-4 max-w-[480px] w-full mx-auto overflow-hidden animate-fadeIn">

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

      <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-4 pb-24">
        {(todayWorkout?.exercises || []).map((ex, idx) => {
          const tierColor = ex.tier === 'T1' ? 't1' : ex.tier === 'T2' ? 't2' : 't3';
          return (
            <React.Fragment key={idx}>
              {renderTierCard(ex.tier || 'T1', ex.exercise, ex.weight, idx, cardRefs[idx] || cardRefs[0], tierColor)}
            </React.Fragment>
          );
        })}

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
