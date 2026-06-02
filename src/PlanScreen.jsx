import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, Search, ChevronRight, X, Users, Calendar, Zap, Target, BookOpen, Pause, Play } from 'lucide-react';
import ProgramConfigScreen from './ProgramConfigScreen';
import ExerciseLibrary from './ExerciseLibrary';

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

function PlanScreen({ programs, userPrograms, exercisesMap, onProgramActivated }) {
  const [activeSubTab, setActiveSubTab] = useState('programs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [configProgram, setConfigProgram] = useState(null);

  const filteredPrograms = programs.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (p.name || '').toLowerCase().includes(q)
      || (p.description || '').toLowerCase().includes(q)
      || (p.category || '').toLowerCase().includes(q);
  });

  const isProgramActive = (programId) => {
    return userPrograms.some(up => up.program_id === programId && up.is_active);
  };

  const handleStartProgram = (program) => {
    setConfigProgram(program);
  };

  const handlePauseProgram = async (userProgramId) => {
    if (!confirm('确定要暂停这个计划吗？你可以随时恢复。')) return;
    const { error } = await supabase
      .from('user_programs')
      .update({ is_active: false, paused_at: new Date().toISOString() })
      .eq('id', userProgramId);
    if (error) {
      alert('暂停失败：' + error.message);
      return;
    }
    onProgramActivated();
  };

  const handleResumeProgram = async (userProgramId) => {
    const { error } = await supabase
      .from('user_programs')
      .update({ is_active: true, paused_at: null })
      .eq('id', userProgramId);
    if (error) {
      alert('恢复失败：' + error.message);
      return;
    }
    onProgramActivated();
  };

  if (configProgram) {
    return (
      <ProgramConfigScreen
        program={configProgram}
        exercisesMap={exercisesMap}
        onBack={() => setConfigProgram(null)}
        onActivated={onProgramActivated}
      />
    );
  }

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
                <span key={f} className="badge badge-outline badge-sm font-semibold text-[10px]">{f}</span>
              ))}
            </div>
          )}

          {p.config?.day_map && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark">训练日安排</h4>
              {Object.entries(p.config.day_map).map(([day, exercises]) => {
                let summary;
                if (Array.isArray(exercises)) {
                  summary = exercises.map(e => `${e.exercise} ${e.sets}×${e.reps}`).join(', ');
                } else {
                  const parts = [];
                  if (exercises.T1) parts.push(`T1: ${exercises.T1}`);
                  if (exercises.T2) parts.push(`T2: ${exercises.T2}`);
                  if (exercises.T3) parts.push(`T3: ${(exercises.T3 || []).join(', ')}`);
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
            {active ? '配置' : '开始此计划'}
          </button>
          {active && (
            <button
              type="button"
              className="btn btn-lg btn-block btn-ghost text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold"
              onClick={() => {
                const up = userPrograms.find(u => u.program_id === p.id && u.is_active);
                if (up) handlePauseProgram(up.id);
              }}
            >
              <Pause size={16} />
              <span>暂停计划</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="mb-1">
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">
          计划库
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
          <span>训练计划</span>
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

          {userPrograms.filter(up => up.is_active).length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider px-1 select-none">
                我的活跃计划
              </h4>
              {userPrograms.filter(up => up.is_active).map(up => {
                const prog = programs.find(p => p.id === up.program_id);
                if (!prog) return null;
                return (
                  <div key={up.id} className="card !p-4 border-l-4 border-l-primary">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark">{prog.name}</span>
                        <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                          当前: {up.program_state?.current_day || 'Day1'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-text-secondary dark:text-text-secondary-dark cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handlePauseProgram(up.id); }}
                          title="暂停"
                        >
                          <Pause size={14} />
                        </button>
                        <span className="badge badge-primary badge-sm font-bold">进行中</span>
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
                  onClick={() => setSelectedProgram(p)}
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
    </div>
  );
}

export default PlanScreen;
