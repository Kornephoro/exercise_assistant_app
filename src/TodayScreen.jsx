import React from 'react';
import { Play, RotateCcw, CheckCircle, Heart, Utensils, Calendar } from 'lucide-react';

/**
 * 今日概览页面组件 - 展示今日训练卡片式流布局、即将推出功能占位、以及完成训练后的打卡摘要
 * 完全采用 Tailwind CSS + DaisyUI 组件进行重构
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
 * @param {boolean} props.isRestDay 今天是否为预设的休息日
 * @param {string} props.nextTrainingDate 下一次训练日的日期描述
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
  todayWorkoutSummary,
  isRestDay = false,
  nextTrainingDate = ''
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

  // 获取页面标题
  const getHeaderTitle = () => {
    if (isTodayCompleted) {
      return `${todayWorkoutSummary[0]?.training_day || currentDay} · 训练完成`;
    }
    if (isRestDay) {
      return '今日休息 · 恢复与滋养';
    }
    return `${currentDay} · ${getExerciseShortName(t1Exercise)}日`;
  };

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">
      {/* 头部区：包含训练日及日期副标题 */}
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">
          {getHeaderTitle()}
        </h2>
        <p className="text-base text-text-secondary dark:text-text-secondary-dark flex items-center gap-2 mt-2 select-none">
          <Calendar size={16} className="opacity-70 text-primary" />
          <span>{getFormattedDate()}</span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* 情况 A：今日已完成训练打卡 */}
        {isTodayCompleted ? (
          <div className="card !border-green-500/20 dark:!border-green-500/30">
            <div className="flex flex-col items-center text-center gap-2.5 mb-5 select-none">
              <CheckCircle className="text-green-500" size={48} />
              <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">今日训练已完成 ✅</h3>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">你今天做得棒极了！以下是你的训练摘要：</p>
            </div>
            
            <div className="flex flex-col gap-3.5">
              {todayWorkoutSummary.map((log, idx) => (
                <div 
                  key={log.id || idx} 
                  className={`flex justify-between items-center p-3 rounded-xl border bg-bg-main/20 dark:bg-bg-main-dark/20 ${
                    log.tier === 'T1' ? 'border-tier-t1/10 dark:border-tier-t1-dark/10' : log.tier === 'T2' ? 'border-tier-t2/10 dark:border-tier-t2-dark/10' : 'border-tier-t3/10 dark:border-tier-t3-dark/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`badge font-bold text-xs px-2 py-0.5 rounded ${
                      log.tier === 'T1' 
                        ? 'bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20' 
                        : log.tier === 'T2' 
                        ? 'bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20' 
                        : 'bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border-tier-t3/20 dark:border-tier-t3-dark/20'
                    }`}>
                      {log.tier}
                    </span>
                    <span className="text-base font-bold text-text-main dark:text-text-main-dark">
                      {getExerciseCNName(log.exercise)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text-main dark:text-text-main-dark bg-bg-hover dark:bg-bg-hover-dark px-2 py-0.5 rounded">
                      {log.weight_kg.toFixed(1)}kg
                    </span>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                      末组 <span className="text-text-main dark:text-text-main-dark text-base font-bold">{log.actual_last_set_reps}</span> 次
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isRestDay ? (
          /* 情况 C：今日为休息日，显示休息提示与下次日程 */
          <div className="card !border-green-500/10 dark:!border-green-500/20">
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-success badge-outline font-bold text-sm">今日休息</span>
              <span className="text-xs font-extrabold tracking-wider text-text-secondary dark:text-text-secondary-dark uppercase opacity-70">
                Rest & Recover
              </span>
            </div>
            
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark mb-2">让肌肉充分修复 😴</h3>
            
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                合理的修整是超量恢复（Supercompensation）的基石。给肌肉充足的时间重整肌纤维、修复微细损伤，你将在下一次训练中爆发出更强大的爆发力与力量！
              </p>
              
              <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-1 select-none">
                <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark flex items-center gap-1.5">
                  🗓️ 下次训练日程安排
                </span>
                <strong className="text-lg font-extrabold text-primary mt-0.5">
                  {nextTrainingDate || '未设定训练日程'}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          /* 情况 B：今日未完成训练，展示今日训练安排 */
          <div 
            className="card hover:border-primary/30 transition-all duration-200 cursor-pointer" 
            onClick={onStartTrain}
          >
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
              <span className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline">
                开始训练 &rarr;
              </span>
            </div>
            
            <h3 className="text-xl font-extrabold text-text-main dark:text-text-main-dark mb-4">
              {getExerciseShortName(t1Exercise)} / {getExerciseShortName(t2Exercise)} 训练日
            </h3>
            
            <div className="flex flex-col gap-5">
              {/* T1 动作 */}
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-bg-hover dark:hover:bg-bg-hover-dark transition-colors duration-150">
                <div className="flex items-center gap-3">
                  <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">
                    T1
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-text-main dark:text-text-main-dark">
                      {getExerciseCNName(t1Exercise)}
                    </span>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
                      {getT1TotalSets(t1PlannedReps)}组 &times; {t1PlannedReps}次
                    </span>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono">
                  {t1Weight.toFixed(1)}kg
                </span>
              </div>
              
              {/* T2 动作 */}
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-bg-hover dark:hover:bg-bg-hover-dark transition-colors duration-150">
                <div className="flex items-center gap-3">
                  <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">
                    T2
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-text-main dark:text-text-main-dark">
                      {getExerciseCNName(t2Exercise)}
                    </span>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
                      3组 &times; {t2PlannedReps}次
                    </span>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono">
                  {t2Weight.toFixed(1)}kg
                </span>
              </div>
              
              {/* T3 动作 */}
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-bg-hover dark:hover:bg-bg-hover-dark transition-colors duration-150">
                <div className="flex items-center gap-3">
                  <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border-tier-t3/20 dark:border-tier-t3-dark/20 font-bold text-xs w-7 h-5 flex items-center justify-center rounded">
                    T3
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-text-main dark:text-text-main-dark">
                      {getExerciseCNName(t3Exercise)}
                    </span>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
                      3组 &times; {t3PlannedReps}次
                    </span>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono">
                  {t3Weight.toFixed(1)}kg
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 占位卡片 2：身体状态 (Coming Soon) */}
        <div className="card flex flex-col gap-3 opacity-70 hover:opacity-100 transition-opacity">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base font-bold text-text-secondary dark:text-text-secondary-dark">
              <Heart size={16} className="text-red-500 opacity-80 animate-pulse" />
              <span>身体状态</span>
            </span>
            <span className="badge badge-ghost badge-sm text-xs opacity-75 font-semibold">即将推出</span>
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            记录每日晨重、体脂率，并追踪肌肉维度与恢复状态。
          </p>
        </div>

        {/* 占位卡片 3：今日饮食摘要 (Coming Soon) */}
        <div className="card flex flex-col gap-3 opacity-70 hover:opacity-100 transition-opacity">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base font-bold text-text-secondary dark:text-text-secondary-dark">
              <Utensils size={16} className="text-orange-500 opacity-80" />
              <span>今日饮食摘要</span>
            </span>
            <span className="badge badge-ghost badge-sm text-xs opacity-75 font-semibold">即将推出</span>
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            跟踪蛋白质、碳水及卡路里摄入，为力量进步提供坚实营养保障。
          </p>
        </div>

      </div>

      {/* 底部固定操作按钮区 - 今日已打卡完成时直接彻底隐藏该区域以净化排版 */}
      {!isTodayCompleted && (
        <div className="mt-4 flex flex-col gap-2">
          {isRestDay && !isSessionActive ? (
            <button 
              type="button" 
              className="btn btn-neutral btn-block btn-lg flex items-center justify-center gap-2 border-border-card dark:border-border-card-dark cursor-not-allowed select-none"
              disabled
            >
              <span>🛋️ 今日休息中，合理恢复</span>
            </button>
          ) : (
            <button 
              type="button" 
              className={`btn btn-primary btn-block btn-lg shadow-md flex items-center justify-center gap-2 cursor-pointer select-none ${
                isSessionActive ? 'animate-bounce' : ''
              }`}
              onClick={onStartTrain}
            >
              {isSessionActive ? (
                <>
                  <RotateCcw size={18} />
                  <span>恢复进行中的训练</span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>开始今日训练 ({currentDay})</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TodayScreen;
