import { useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Search, ChevronRight, X, Users, Calendar, Zap, Target, BookOpen, Pause, Play, StopCircle, Settings, AlertTriangle } from 'lucide-react';
import ProgramConfigScreen from './ProgramConfigScreen';
import ExerciseLibrary from './ExerciseLibrary';
import { getCNName, FEATURE_LABELS } from './exerciseNames';

const DIFFICULTY_MAP = {
  beginner: { label: '初学者', color: 'badge-success' },
  intermediate: { label: '中级', color: 'badge-warning' },
  advanced: { label: '高级', color: 'badge-error' },
};

const CATEGORY_MAP = {
  strength: '力量',
  hypertrophy: '增肌',
  general: '综合',
};

const DAYS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '3天', value: '3' },
  { label: '4天', value: '4' },
  { label: '5天', value: '5' },
];

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = '确认', confirmClass = 'btn-primary' }) {
  if (!isOpen) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4 text-sm text-text-secondary dark:text-text-secondary-dark">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancel}>取消</button>
          <button className={`btn ${confirmClass}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCancel}>close</button>
      </form>
    </dialog>
  );
}

function PlanScreen({ programs, userPrograms, exercisesMap, onProgramStarted, onProgramPaused, onProgramResumed, onProgramEnded, onProgramError, optimisticUpdateUserProgram, isOperationLocked = false }) {
  const [activeSubTab, setActiveSubTab] = useState('programs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedActiveProgramId, setSelectedActiveProgramId] = useState(null);
  const [configProgram, setConfigProgram] = useState(null);

  // 筛选器
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('');

  // 确认弹窗
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingUserProgramId, setPendingUserProgramId] = useState(null);

  // 用 selectedActiveProgramId 和 useMemo 代替 useEffect 同步 state，彻底避免同步 setState 警告与陈旧引用问题
  const selectedActiveProgram = useMemo(() => {
    if (!selectedActiveProgramId) return null;
    const up = userPrograms.find(u => u.id === selectedActiveProgramId);
    if (!up) return null;
    const prog = programs.find(p => p.id === up.program_id);
    if (!prog) return null;
    return { program: prog, userProgram: up };
  }, [selectedActiveProgramId, userPrograms, programs]);

  const filteredPrograms = programs.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!(p.name || '').toLowerCase().includes(q)
        && !(p.description || '').toLowerCase().includes(q)
        && !(p.category || '').toLowerCase().includes(q)) return false;
    }
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
    if (daysFilter && p.days_per_week !== parseInt(daysFilter)) return false;
    return true;
  });

  const isProgramActive = (programId) => {
    return userPrograms.some(up => up.program_id === programId && up.is_active);
  };

  const handleStartProgram = (program) => {
    setConfigProgram(program);
  };

  const handlePauseProgram = async (userProgramId) => {
    // 第二道防线：handler 内部拦截（防弹窗打开后状态变化）
    if (isOperationLocked) {
      onProgramError?.('请先完成或放弃训练后再管理计划');
      setShowPauseConfirm(false);
      return;
    }
    setShowPauseConfirm(false);
    const { error } = await supabase
      .from('user_programs')
      .update({ is_active: false, paused_at: new Date().toISOString() })
      .eq('id', userProgramId);
    if (error) {
      onProgramError?.('暂停计划失败：' + error.message);
      return;
    }
    onProgramPaused?.(userProgramId);
  };

  const handleResumeProgram = async (userProgramId) => {
    if (isOperationLocked) {
      onProgramError?.('请先完成或放弃训练后再管理计划');
      return;
    }
    // ① 立即通过父级乐观更新属性，单源真相
    optimisticUpdateUserProgram(userProgramId, { is_active: true, paused_at: null });
    // ② 异步写库 + 父级联动（切 today tab + loadWorkoutData）
    const { error } = await supabase
      .from('user_programs')
      .update({ is_active: true, paused_at: null })
      .eq('id', userProgramId);
    if (error) {
      onProgramError?.('恢复计划失败：' + error.message);
      return;
    }
    onProgramResumed?.(userProgramId);
  };

  const handleEndProgram = async (userProgramId) => {
    if (isOperationLocked) {
      onProgramError?.('请先完成或放弃训练后再结束计划');
      setShowEndConfirm(false);
      return;
    }
    setShowEndConfirm(false);
    setSelectedActiveProgramId(null);
    const { error } = await supabase
      .from('user_programs')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', userProgramId);
    if (error) {
      onProgramError?.('结束计划失败：' + error.message);
      return;
    }
    onProgramEnded?.(userProgramId);
  };

  const openPauseConfirm = (userProgramId) => {
    // 第一道防线：按钮入口拦截
    if (isOperationLocked) {
      onProgramError?.('请先完成或放弃训练后再管理计划');
      return;
    }
    setPendingUserProgramId(userProgramId);
    setShowPauseConfirm(true);
  };

  const openEndConfirm = (userProgramId) => {
    if (isOperationLocked) {
      onProgramError?.('请先完成或放弃训练后再结束计划');
      return;
    }
    setPendingUserProgramId(userProgramId);
    setShowEndConfirm(true);
  };

  if (configProgram) {
    return (
      <ProgramConfigScreen
        program={configProgram}
        exercisesMap={exercisesMap}
        onBack={() => setConfigProgram(null)}
        onProgramStarted={onProgramStarted}
      />
    );
  }

  // 活跃计划详情页
  if (selectedActiveProgram) {
    const { program: p, userProgram: up } = selectedActiveProgram;
    const engineType = p.config?.engine_type;
    const isPlaceholder = engineType === 'starting_strength' && p.config?.note;

    return (
      <div className="flex flex-col gap-5 animate-fadeIn">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-circle btn-sm cursor-pointer" onClick={() => setSelectedActiveProgramId(null)}>
            ←
          </button>
          <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">{p.name}</h3>
          {!up.is_active && up.paused_at
            ? <span className="badge badge-warning badge-sm font-bold">已暂停</span>
            : <span className="badge badge-primary badge-sm font-bold gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                进行中
              </span>}
        </div>

        {isOperationLocked && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-bg border border-warning/40 text-warning text-sm font-semibold">
            <AlertTriangle size={16} className="shrink-0" />
            <span>训练进行中，请先完成或放弃训练后再管理计划。</span>
          </div>
        )}

        <div className="card flex flex-col gap-4">
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            {p.description}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar size={14} className="text-primary" />
              <span className="font-semibold text-text-main dark:text-text-main-dark">每周 {p.days_per_week} 天</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Target size={14} className="text-primary" />
              <span className="font-semibold text-text-main dark:text-text-main-dark">{CATEGORY_MAP[p.category] || p.category}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
            <span className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark">当前进度</span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-main dark:text-text-main-dark">
                训练日: {up.program_state?.current_day || 'Day1'}
              </span>
              {up.paused_at && (
                <span className="badge badge-warning badge-sm font-bold">已暂停</span>
              )}
            </div>
          </div>

          {p.features && p.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.features.map(f => (
                <span key={f} className="badge badge-outline badge-sm font-semibold text-[10px]">{FEATURE_LABELS[f] || f}</span>
              ))}
            </div>
          )}

          {p.config?.day_map && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark">训练日安排</h4>
              {Object.entries(p.config.day_map).map(([day, exercises]) => {
                let summary;
                if (Array.isArray(exercises)) {
                  summary = exercises.map(e => `${getCNName(e.exercise, exercisesMap)} ${e.sets}×${e.reps}`).join(', ');
                } else {
                  const parts = [];
                  if (exercises.T1) parts.push(`T1: ${getCNName(exercises.T1, exercisesMap)}`);
                  if (exercises.T2) parts.push(`T2: ${getCNName(exercises.T2, exercisesMap)}`);
                  if (exercises.T3) parts.push(`T3: ${(exercises.T3 || []).map(n => getCNName(n, exercisesMap)).join(', ')}`);
                  summary = parts.join(' | ');
                }
                return (
                  <div key={day} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-bg-main/20 dark:bg-bg-main-dark/20">
                    <span className="font-bold text-primary w-12 shrink-0">{day}</span>
                    <span className="font-mono text-text-main dark:text-text-main-dark">{summary}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isPlaceholder && (
            <div className="alert-box text-xs">
              此计划的进度算法尚未实现，目前仅作为入口展示。
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-lg btn-block btn-primary font-bold shadow-lg"
            onClick={() => { setConfigProgram(p); setSelectedActiveProgramId(null); }}
          >
            <Settings size={16} />
            <span>更改配置</span>
          </button>
          {!up.is_active && up.paused_at ? (
            <button
              type="button"
              className="btn btn-lg btn-block btn-primary font-bold shadow-lg"
              onClick={() => handleResumeProgram(up.id)}
            >
              <Play size={16} />
              <span>恢复计划</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-lg btn-block btn-ghost text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold"
              onClick={() => openPauseConfirm(up.id)}
            >
              <Pause size={16} />
              <span>暂停计划</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-lg btn-block btn-ghost text-error border border-error/30 font-semibold"
            onClick={() => openEndConfirm(up.id)}
          >
            <StopCircle size={16} />
            <span>结束计划</span>
          </button>
        </div>

        <ConfirmModal
          isOpen={showPauseConfirm}
          title="暂停计划"
          message="确定要暂停这个计划吗？你可以随时恢复。"
          onConfirm={() => handlePauseProgram(pendingUserProgramId)}
          onCancel={() => setShowPauseConfirm(false)}
          confirmText="确认暂停"
        />
        <ConfirmModal
          isOpen={showEndConfirm}
          title="结束计划"
          message="确定要结束这个计划吗？此操作不可撤销，但训练历史将保留。"
          onConfirm={() => handleEndProgram(pendingUserProgramId)}
          onCancel={() => setShowEndConfirm(false)}
          confirmText="确认结束"
          confirmClass="btn-error"
        />
      </div>
    );
  }

  // 计划详情页
  if (selectedProgram) {
    const p = selectedProgram;
    const diff = DIFFICULTY_MAP[p.difficulty];
    const active = isProgramActive(p.id);
    const engineType = p.config?.engine_type;
    const isPlaceholder = engineType === 'starting_strength' && p.config?.note;

    return (
      <div className="flex flex-col gap-5 animate-fadeIn">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-circle btn-sm cursor-pointer" onClick={() => setSelectedProgram(null)}>
            ←
          </button>
          <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">{p.name}</h3>
          {diff && <span className={`badge ${diff.color} badge-sm font-bold`}>{diff.label}</span>}
        </div>

        <div className="card flex flex-col gap-4">
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            {p.description}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar size={14} className="text-primary" />
              <span className="font-semibold text-text-main dark:text-text-main-dark">每周 {p.days_per_week} 天</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Target size={14} className="text-primary" />
              <span className="font-semibold text-text-main dark:text-text-main-dark">{CATEGORY_MAP[p.category] || p.category}</span>
            </div>
          </div>

          {p.features && p.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.features.map(f => (
                <span key={f} className="badge badge-outline badge-sm font-semibold text-[10px]">{FEATURE_LABELS[f] || f}</span>
              ))}
            </div>
          )}

          {p.config?.day_map && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark">训练日安排</h4>
              {Object.entries(p.config.day_map).map(([day, exercises]) => {
                let summary;
                if (Array.isArray(exercises)) {
                  summary = exercises.map(e => `${getCNName(e.exercise, exercisesMap)} ${e.sets}×${e.reps}`).join(', ');
                } else {
                  const parts = [];
                  if (exercises.T1) parts.push(`T1: ${getCNName(exercises.T1, exercisesMap)}`);
                  if (exercises.T2) parts.push(`T2: ${getCNName(exercises.T2, exercisesMap)}`);
                  if (exercises.T3) parts.push(`T3: ${(exercises.T3 || []).map(n => getCNName(n, exercisesMap)).join(', ')}`);
                  summary = parts.join(' | ');
                }
                return (
                  <div key={day} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-bg-main/20 dark:bg-bg-main-dark/20">
                    <span className="font-bold text-primary w-12 shrink-0">{day}</span>
                    <span className="font-mono text-text-main dark:text-text-main-dark">{summary}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isPlaceholder && (
            <div className="alert-box text-xs">
              此计划的进度算法尚未实现，目前仅作为入口展示。
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`btn btn-lg btn-block font-bold shadow-lg ${active ? 'btn-primary' : 'btn-primary'}`}
            onClick={() => handleStartProgram(p)}
          >
            {active ? '更改配置' : '开始此计划'}
          </button>
          {active && (
            <button
              type="button"
              className="btn btn-lg btn-block btn-ghost text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold"
              onClick={() => {
                const up = userPrograms.find(u => u.program_id === p.id && u.is_active);
                if (up) openPauseConfirm(up.id);
              }}
            >
              <Pause size={16} />
              <span>暂停计划</span>
            </button>
          )}
        </div>

        <ConfirmModal
          isOpen={showPauseConfirm}
          title="暂停计划"
          message="确定要暂停这个计划吗？你可以随时恢复。"
          onConfirm={() => handlePauseProgram(pendingUserProgramId)}
          onCancel={() => setShowPauseConfirm(false)}
          confirmText="确认暂停"
        />
        <ConfirmModal
          isOpen={showEndConfirm}
          title="结束计划"
          message="确定要结束这个计划吗？此操作不可撤销，但训练历史将保留。"
          onConfirm={() => handleEndProgram(pendingUserProgramId)}
          onCancel={() => setShowEndConfirm(false)}
          confirmText="确认结束"
          confirmClass="btn-error"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="mb-1">
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">
          训练安排
        </h2>
      </div>

      <div className="tabs tabs-boxed bg-bg-card/80 dark:bg-bg-card-dark/80 backdrop-blur-md border border-border-card dark:border-border-card-dark p-1.5 mb-1">
        <button type="button"
          className={`tab flex-1 transition-all duration-200 py-2 text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'programs'
              ? 'tab-active !bg-primary !text-white font-bold rounded-xl shadow-md'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
          }`}
          onClick={() => setActiveSubTab('programs')}
        >
          <Zap size={14} />
          <span>计划库</span>
        </button>
        <button type="button"
          className={`tab flex-1 transition-all duration-200 py-2 text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'library'
              ? 'tab-active !bg-primary !text-white font-bold rounded-xl shadow-md'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
          }`}
          onClick={() => setActiveSubTab('library')}
        >
          <BookOpen size={14} />
          <span>动作库</span>
        </button>
      </div>

      {activeSubTab === 'programs' ? (
        <>
          <div className="input input-bordered flex items-center gap-2 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 transition-colors">
            <Search size={16} className="text-text-secondary/50 shrink-0" />
            <input type="text"
              className="w-full bg-transparent text-sm font-semibold text-text-main dark:text-text-main-dark focus:outline-none"
              placeholder="搜索计划..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="btn btn-ghost btn-xs btn-circle p-0 cursor-pointer" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* 筛选器 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark shrink-0">分类:</span>
              {['', 'strength', 'hypertrophy', 'general'].map(cat => (
                <button key={cat} type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary dark:text-text-secondary-dark border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                  }`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat ? CATEGORY_MAP[cat] : '全部'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark shrink-0">难度:</span>
              {['', 'beginner', 'intermediate', 'advanced'].map(diff => (
                <button key={diff} type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    difficultyFilter === diff
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary dark:text-text-secondary-dark border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                  }`}
                  onClick={() => setDifficultyFilter(diff)}
                >
                  {diff ? DIFFICULTY_MAP[diff]?.label : '全部'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark shrink-0">天数:</span>
              {DAYS_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    daysFilter === opt.value
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary dark:text-text-secondary-dark border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                  }`}
                  onClick={() => setDaysFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {userPrograms.filter(up => up.is_active || up.paused_at).length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider px-1 select-none">
                正在进行计划
              </h4>
              {userPrograms.filter(up => up.is_active || up.paused_at).map(up => {
                const prog = programs.find(p => p.id === up.program_id);
                if (!prog) return null;
                const isPaused = !up.is_active && !!up.paused_at;
                return (
                  <div key={up.id} className={`card !p-4 border-l-4 cursor-pointer transition-all ${
                    isPaused
                      ? 'border-l-warning opacity-90 hover:opacity-100 hover:border-warning/60'
                      : 'border-l-primary hover:border-primary/60'
                  }`}
                    onClick={() => setSelectedActiveProgramId(up.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-text-main dark:text-text-main-dark">{prog.name}</span>
                          {isPaused
                            ? <span className="badge badge-warning badge-sm font-bold">已暂停</span>
                            : <span className="badge badge-primary badge-sm font-bold gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                进行中
                              </span>}
                        </div>
                        <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                          {isPaused ? '已暂停' : '当前'}: {up.program_state?.current_day || 'Day1'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight size={16} className="text-text-secondary/40" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider px-1 select-none">
              全部计划
            </h4>
            {filteredPrograms.map(p => {
              const diff = DIFFICULTY_MAP[p.difficulty];
              const active = isProgramActive(p.id);
              return (
                <div key={p.id}
                  className="card !p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                  onClick={() => handleStartProgram(p)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark truncate">{p.name}</span>
                        {diff && <span className={`badge ${diff.color} badge-xs font-bold`}>{diff.label}</span>}
                        {active && <span className="badge badge-primary badge-xs font-bold">已启用</span>}
                      </div>
                      <p className="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-2">{p.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark">
                          <Users size={10} className="inline mr-0.5" /> {p.days_per_week}天/周
                        </span>
                        <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark">
                          {CATEGORY_MAP[p.category] || p.category}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-text-secondary/40 shrink-0 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <ExerciseLibrary />
      )}

      <ConfirmModal
        isOpen={showPauseConfirm}
        title="暂停计划"
        message="确定要暂停这个计划吗？你可以随时恢复。"
        onConfirm={() => handlePauseProgram(pendingUserProgramId)}
        onCancel={() => setShowPauseConfirm(false)}
        confirmText="确认暂停"
      />
      <ConfirmModal
        isOpen={showEndConfirm}
        title="结束计划"
        message="确定要结束这个计划吗？此操作不可撤销，但训练历史将保留。"
        onConfirm={() => handleEndProgram(pendingUserProgramId)}
        onCancel={() => setShowEndConfirm(false)}
        confirmText="确认结束"
        confirmClass="btn-error"
      />
    </div>
  );
}

export default PlanScreen;
