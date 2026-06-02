import React from 'react';
import { X, Play, ChevronDown, ChevronRight } from 'lucide-react';

const TIER_COLORS = {
  T1: { bg: 'bg-tier-t1/10', text: 'text-tier-t1', darkText: 'dark:text-tier-t1-dark', border: 'border-tier-t1/20', darkBorder: 'dark:border-tier-t1-dark/20' },
  T2: { bg: 'bg-tier-t2/10', text: 'text-tier-t2', darkText: 'dark:text-tier-t2-dark', border: 'border-tier-t2/20', darkBorder: 'dark:border-tier-t2-dark/20' },
  T3: { bg: 'bg-tier-t3/10', text: 'text-tier-t3', darkText: 'dark:text-tier-t3-dark', border: 'border-tier-t3/20', darkBorder: 'dark:border-tier-t3-dark/20' },
};

function WorkoutPreviewModal({
  isOpen,
  onClose,
  onStartTrain,
  todayWorkout,
  getExerciseCNName,
}) {
  const [expanded, setExpanded] = React.useState({});

  if (!isOpen) return null;
  const exercises = todayWorkout?.exercises || [];
  if (exercises.length === 0) return null;

  const toggle = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={onClose}>
      <div
        className="bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-card dark:border-border-card-dark shrink-0">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary badge-outline font-bold text-xs">预览</span>
            <span className="text-base font-extrabold text-text-main dark:text-text-main-dark">
              {todayWorkout?.dayLabel || '今日'} 训练计划
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle text-text-secondary dark:text-text-secondary-dark"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {exercises.map((ex, idx) => {
            const tier = ex.tier || 'T1';
            const tc = TIER_COLORS[tier] || TIER_COLORS.T1;
            const isOpen = expanded[idx];
            const tempo = ex.tempo || '3110';
            const sets = ex.sets || 0;
            const reps = ex.reps || 0;
            const weight = ex.weight?.toFixed?.(1) ?? ex.weight;

            return (
              <div
                key={idx}
                className={`rounded-xl border bg-bg-main/30 dark:bg-bg-main-dark/30 ${tc.border} ${tc.darkBorder} overflow-hidden`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 text-left"
                  onClick={() => toggle(idx)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`badge ${tc.bg} ${tc.text} ${tc.darkText} ${tc.border} ${tc.darkBorder} font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded shrink-0`}>
                      {tier}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-text-main dark:text-text-main-dark truncate">
                        {getExerciseCNName(ex.exercise)}
                      </span>
                      <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        {sets} 组 × {reps} 次 · 节奏 {tempo}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-extrabold text-text-main dark:text-text-main-dark font-mono">
                      {weight}kg
                    </span>
                    {isOpen ? <ChevronDown size={16} className="text-text-secondary dark:text-text-secondary-dark" /> : <ChevronRight size={16} className="text-text-secondary dark:text-text-secondary-dark" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-border-card/50 dark:border-border-card-dark/50 flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">组数</span>
                        <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{sets}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">次数</span>
                        <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{reps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">重量</span>
                        <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{weight} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">目标 RPE</span>
                        <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{ex.planned_rpe ?? '—'}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 p-2 rounded-lg bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">动作节奏 (Tempo)</span>
                        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">离心 · 底部 · 向心 · 顶部</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center">
                        {tempo.split('').map((ch, i) => (
                          <div key={i} className="rounded-md bg-bg-main dark:bg-bg-main-dark border border-border-card dark:border-border-card-dark py-1.5">
                            <div className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono leading-none">{ch}</div>
                            <div className="text-[10px] text-text-secondary dark:text-text-secondary-dark mt-0.5">
                              {['离心', '底部', '向心', '顶部'][i]}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-border-card dark:border-border-card-dark flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-outline flex-1 font-semibold"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1 font-bold gap-2 shadow-md"
            onClick={onStartTrain}
          >
            <Play size={18} fill="currentColor" />
            开始今日训练
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkoutPreviewModal;
