import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle, Heart, Utensils, Calendar, ChevronDown, ArrowRight, SkipForward, Flag } from 'lucide-react';

const TIER_COLORS = {
  T1: { bg: 'bg-tier-t1/10', text: 'text-tier-t1', darkText: 'dark:text-tier-t1-dark', border: 'border-tier-t1/20', darkBorder: 'dark:border-tier-t1-dark/20' },
  T2: { bg: 'bg-tier-t2/10', text: 'text-tier-t2', darkText: 'dark:text-tier-t2-dark', border: 'border-tier-t2/20', darkBorder: 'dark:border-tier-t2-dark/20' },
  T3: { bg: 'bg-tier-t3/10', text: 'text-tier-t3', darkText: 'dark:text-tier-t3-dark', border: 'border-tier-t3/20', darkBorder: 'dark:border-tier-t3-dark/20' },
};

function TodayScreen({
  activeProgram,
  activeUserProgram,
  activeUserPrograms,
  programs,
  todayWorkout,
  exercisesMap,
  sessionState,
  onStartTrain,
  onOpenPreview,
  onSwitchProgram,
  onGoToLibrary,
  getExerciseCNName,
  isTodayCompleted,
  todayWorkoutSummary,
  isRestDay = false,
  nextTrainingDate = '',
  onSkipTraining,
  onExtraTraining,
  daysUntilStart = 0
}) {
  const [showProgramSwitcher, setShowProgramSwitcher] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const isSessionActive = sessionState && sessionState.isActive;

  const skipReasons = [
    { value: 'fatigue', label: '身体疲劳' },
    { value: 'injury', label: '轻微受伤' },
    { value: 'travel', label: '出差/旅行' },
    { value: 'illness', label: '生病' },
    { value: 'busy', label: '事务繁忙' },
    { value: 'other', label: '其他原因' },
  ];

  const getExerciseShortName = (exercise) => {
    const cnName = getExerciseCNName(exercise);
    return cnName.split(' ')[0].split('(')[0].trim();
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  const getHeaderTitle = () => {
    if (!activeProgram) return '训练助手';
    if (isSessionActive) {
      const dayLabel = todayWorkout?.dayLabel || '';
      return `${dayLabel} 训练中`;
    }
    if (isTodayCompleted) {
      return `${todayWorkoutSummary[0]?.training_day || ''} 训练完成`;
    }
    if (isRestDay) return '今日休息';
    const dayLabel = todayWorkout?.dayLabel || '';
    return `${dayLabel} 训练日`;
  };

  // 无活跃计划 → 引导去计划库
  if (!activeProgram) {
    return (
      <div className="flex flex-col gap-8 animate-fadeIn">
        <div className="mb-2">
          <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">训练助手</h2>
          <p className="text-base text-text-secondary dark:text-text-secondary-dark flex items-center gap-2 mt-2 select-none">
            <Calendar size={16} className="opacity-70 text-primary" />
            <span>{getFormattedDate()}</span>
          </p>
        </div>

        <div className="card hover:border-primary/30 transition-all duration-200 cursor-pointer" onClick={onGoToLibrary}>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <span className="text-4xl">📋</span>
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">选择一个训练计划</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-xs">
              从计划库中选择一个适合你的训练计划，配置好参数就可以开始训练了。
            </p>
            <button type="button" className="btn btn-primary btn-sm gap-2 font-bold shadow-md">
              浏览计划库 <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="card flex flex-col gap-3 opacity-70">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base font-bold text-text-secondary dark:text-text-secondary-dark">
              <Heart size={16} className="text-red-500 opacity-80" /><span>身体状态</span>
            </span>
            <span className="badge badge-ghost badge-sm text-xs opacity-75 font-semibold">即将推出</span>
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">记录每日晨重、体脂率，并追踪肌肉维度与恢复状态。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* 头部：仅日期 */}
      <p className="text-base text-text-secondary dark:text-text-secondary-dark flex items-center gap-2 select-none">
        <Calendar size={16} className="opacity-70 text-primary" />
        <span>{getFormattedDate()}</span>
      </p>

      {/* 计划切换器（多个活跃计划时） */}
      {activeUserPrograms.length > 1 && (
        <div className="relative">
          <button type="button"
            className="btn btn-ghost btn-sm gap-2 text-xs font-bold cursor-pointer"
            onClick={() => setShowProgramSwitcher(prev => !prev)}
          >
            {activeProgram.name} <ChevronDown size={14} />
          </button>
          {showProgramSwitcher && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-xl shadow-lg p-2 min-w-[160px]">
              {activeUserPrograms.map(up => {
                const prog = programs.find(p => p.id === up.program_id);
                if (!prog) return null;
                const isActive = up.id === activeUserProgram?.id;
                return (
                  <button key={up.id} type="button"
                    className={`btn btn-sm btn-ghost w-full justify-start font-bold text-xs cursor-pointer ${isActive ? 'text-primary' : ''}`}
                    onClick={() => { onSwitchProgram(up.id); setShowProgramSwitcher(false); }}
                  >
                    {prog.name} {isActive && '✓'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">

        {/* 已完成 */}
        {isTodayCompleted ? (
          <div className="card !border-green-500/20 dark:!border-green-500/30">
            <div className="flex flex-col items-center text-center gap-2.5 mb-5 select-none">
              <CheckCircle className="text-green-500" size={48} />
              <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">今日训练已完成</h3>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">你今天做得棒极了！以下是训练摘要：</p>
            </div>
            <div className="flex flex-col gap-3.5">
              {todayWorkoutSummary.map((log, idx) => {
                const tc = TIER_COLORS[log.tier] || TIER_COLORS.T1;
                return (
                  <div key={log.id || idx} className={`flex justify-between items-center p-3 rounded-xl border bg-bg-main/20 dark:bg-bg-main-dark/20 ${tc.border} ${tc.darkBorder}`}>
                    <div className="flex items-center gap-2">
                      <span className={`badge font-bold text-xs px-2 py-0.5 rounded ${tc.bg} ${tc.text} ${tc.darkText} ${tc.border} ${tc.darkBorder}`}>
                        {log.tier}
                      </span>
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">{getExerciseCNName(log.exercise)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-text-main dark:text-text-main-dark bg-bg-hover dark:bg-bg-hover-dark px-2 py-0.5 rounded">
                        {log.weight_kg?.toFixed(1)}kg
                      </span>
                      <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        末组 <span className="text-text-main dark:text-text-main-dark text-base font-bold">{log.actual_last_set_reps}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : daysUntilStart > 0 ? (
          /* 尚未开始 */
          <div className="card !border-primary/20 dark:!border-primary/30">
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
              <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">未开始</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">计划尚未开始</span>
              {activeProgram && (
                <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                  {activeProgram.name}
                </span>
              )}
            </div>
            <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />
            <div className="flex flex-col items-center text-center gap-3 select-none py-4">
              <Calendar className="text-primary" size={48} />
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                距离开始还有 <span className="text-primary font-bold text-lg">{daysUntilStart}</span> 天
              </p>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                耐心等待，养精蓄锐，届时全力以赴！
              </p>
            </div>
          </div>
        ) : isRestDay ? (
          /* 休息日 */
          <div className="card !border-green-500/10 dark:!border-green-500/20">
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
              <span className="text-xs font-extrabold tracking-wider text-text-secondary dark:text-text-secondary-dark uppercase opacity-70">Rest & Recover</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">休息日</span>
              <span className="badge badge-ghost font-bold text-xs">☕ 休息日</span>
              {activeProgram && (
                <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                  {activeProgram.name}
                </span>
              )}
            </div>
            <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark mb-2">让肌肉充分修复</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
              合理的修整是超量恢复的基石。给肌肉充足的时间重整肌纤维，你将在下一次训练中更加强大！
            </p>
            <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-1 select-none">
              <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">下次训练日程</span>
              <strong className="text-lg font-extrabold text-primary mt-0.5">{nextTrainingDate || '未设定'}</strong>
            </div>
          </div>
        ) : todayWorkout && todayWorkout.exercises ? (
          /* 今日训练 */
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="card hover:border-primary/30 transition-all duration-200 cursor-pointer text-left w-full"
              onClick={onOpenPreview}
            >
              <div className="flex justify-between items-center mb-3 select-none">
                <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
                <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">点击查看详情 →</span>
              </div>

              {/* Day 标签 + 状态徽章 + 计划名 一行 */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">
                  {todayWorkout ? `${todayWorkout.dayLabel} 训练日` : '休息日'}
                </span>
                {isSessionActive && (
                  <span className="badge badge-warning badge-outline font-bold text-xs gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                    进行中
                  </span>
                )}
                {!isSessionActive && isTodayCompleted && (
                  <span className="badge badge-success badge-outline font-bold text-xs">🎉 已完成</span>
                )}
                {!isSessionActive && !isTodayCompleted && (
                  <span className="badge badge-primary badge-outline font-bold text-xs">⚡ 训练日</span>
                )}
                {activeProgram && (
                  <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                    {activeProgram.name}
                  </span>
                )}
              </div>

              <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />

              {(() => {
                const exercises = todayWorkout.exercises || [];
                const exCount = exercises.length;
                const totalWeight = exercises.reduce((sum, ex) => sum + ((ex.weight || 0) * (ex.sets || 0)), 0);
                // 估算时长：每组约 90s 组间休息 + 30s 动作
                const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
                const estMinutes = Math.max(15, Math.round(totalSets * 2));
                return (
                  <div className="flex flex-col gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                    <div className="flex items-center gap-2">
                      <span>💪</span>
                      <span><span className="font-bold text-text-main dark:text-text-main-dark">{exCount}</span> 个动作</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🏋️</span>
                      <span>总训练量 <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{totalWeight.toFixed(1)}kg</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>预计耗时 <span className="font-bold text-text-main dark:text-text-main-dark">{estMinutes}</span> 分钟</span>
                    </div>
                  </div>
                );
              })()}
            </button>

            {/* 卡片下方：开始训练 + 跳过 */}
            {!isSessionActive && (
              <div className="flex flex-col gap-2">
                <button type="button"
                  className="btn btn-primary btn-block btn-lg shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                  onClick={onStartTrain}
                >
                  <Play size={18} fill="currentColor" />
                  <span>开始今日训练 ({todayWorkout?.dayLabel || ''})</span>
                </button>
                <button type="button"
                  className="btn btn-ghost btn-block text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold cursor-pointer"
                  onClick={() => setShowSkipModal(true)}
                >
                  <SkipForward size={16} />
                  <span>跳过今日训练（自动顺延）</span>
                </button>
              </div>
            )}

            {isSessionActive && (
              <button type="button"
                className="btn btn-primary btn-block btn-lg shadow-md flex items-center justify-center gap-2 cursor-pointer select-none animate-bounce"
                onClick={onStartTrain}
              >
                <RotateCcw size={18} />
                <span>恢复进行中的训练</span>
              </button>
            )}
          </div>
        ) : (
          /* 计划存在但无今日训练数据 */
          <div className="card opacity-70">
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center py-4">
              暂无训练安排
            </p>
          </div>
        )}

        {/* Coming Soon */}
        <div className="card flex flex-col gap-3 opacity-70">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base font-bold text-text-secondary dark:text-text-secondary-dark">
              <Heart size={16} className="text-red-500 opacity-80 animate-pulse" /><span>身体状态</span>
            </span>
            <span className="badge badge-ghost badge-sm text-xs opacity-75 font-semibold">即将推出</span>
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">记录每日晨重、体脂率，并追踪肌肉维度与恢复状态。</p>
        </div>

        <div className="card flex flex-col gap-3 opacity-70">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base font-bold text-text-secondary dark:text-text-secondary-dark">
              <Utensils size={16} className="text-orange-500 opacity-80" /><span>今日饮食摘要</span>
            </span>
            <span className="badge badge-ghost badge-sm text-xs opacity-75 font-semibold">即将推出</span>
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">跟踪蛋白质、碳水及卡路里摄入，为力量进步提供坚实营养保障。</p>
        </div>
      </div>

      {/* 底部按钮 - 休息日加练入口（仅休息日仍保留在底部） */}
      {!isTodayCompleted && isRestDay && !isSessionActive && (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn btn-neutral btn-block btn-lg flex items-center justify-center gap-2 border-border-card dark:border-border-card-dark select-none">
            今日休息中，合理恢复
          </button>
          <button type="button"
            className="btn btn-ghost btn-block text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold cursor-pointer"
            onClick={() => setShowExtraModal(true)}
          >
            <Flag size={16} />
            <span>今天想加练？</span>
          </button>
        </div>
      )}

      {/* 跳过训练确认弹窗 */}
      {showSkipModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">跳过今日训练</h3>
            <p className="py-2 text-sm text-text-secondary">跳过今天后，训练计划将自动顺延。请记录跳过原因，这将帮助 AI 为你提供更好的建议。</p>
            <div className="flex flex-col gap-2 py-2">
              <span className="text-xs font-semibold text-text-secondary">跳过原因</span>
              <div className="flex flex-wrap gap-2">
                {skipReasons.map(reason => (
                  <button key={reason.value} type="button"
                    className={`btn btn-sm ${skipReason === reason.value ? 'btn-primary' : 'btn-ghost border border-border-card'}`}
                    onClick={() => setSkipReason(reason.value)}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowSkipModal(false); setSkipReason(''); }}>取消</button>
              <button className="btn btn-primary" onClick={() => { onSkipTraining(skipReason); setShowSkipModal(false); setSkipReason(''); }}>确认跳过</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setShowSkipModal(false); setSkipReason(''); }}>close</button>
          </form>
        </dialog>
      )}

      {/* 加练确认弹窗 */}
      {showExtraModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">今天想加练？</h3>
            <p className="py-4 text-sm text-text-secondary">今天是休息日，加练会影响恢复。确定要开始吗？加练后计划将顺延至下一个训练日。</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowExtraModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={() => { onExtraTraining(); setShowExtraModal(false); }}>确认加练</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowExtraModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

export default TodayScreen;
