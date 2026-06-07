import { useState, useMemo, useEffect } from 'react';
import { saveUserProgram, fetchExercises, fetchWorkoutTemplates, saveWorkoutTemplate, deleteWorkoutTemplate } from './services/programService';
import { Search, ChevronRight, X, Users, Calendar, Zap, Target, BookOpen, Pause, Play, StopCircle, Settings, AlertTriangle, Plus, Trash2, Edit, Save, FolderOpen, Heart, Activity, Sparkles, FolderUp, Loader2 } from 'lucide-react';
import ProgramConfigScreen from './ProgramConfigScreen';
import ExerciseLibrary from './ExerciseLibrary';
import ExercisePickerModal from './components/ExercisePickerModal';
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
          <button className="btn-sec px-5" onClick={onCancel}>取消</button>
          <button className={`btn-main px-5 ${confirmClass.includes('error') || confirmClass.includes('alert') ? 'bg-error!' : ''}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCancel}>close</button>
      </form>
    </dialog>
  );
}

const RECORDING_METHOD_MAP = {
  standard: '常规力量',
  reps_only: '仅次数',
  duration_only: '仅时长',
  distance_only: '仅距离',
  loaded_carry: '负重行走',
  bodyweight_added: '自重附加',
  bodyweight_assisted: '自重辅助',
};

const EXERCISE_TYPE_MAP = {
  strength: '力量训练',
  stretching: '拉伸训练',
  animal_flow: '动物流',
  mobility: '关节活动',
  myofascial_release: '筋膜放松',
  functional: '功能性训练',
};

function PlanScreen({
  programs,
  userPrograms,
  exercisesMap,
  gymEquipmentConfig = null,
  onProgramStarted,
  onProgramPaused,
  onProgramResumed,
  onProgramEnded,
  onProgramError,
  optimisticUpdateUserProgram,
  isOperationLocked = false,
  selectedProgram,
  setSelectedProgram,
  selectedActiveProgramId,
  setSelectedActiveProgramId,
  configProgram,
  setConfigProgram
}) {
  const [activeSubTab, setActiveSubTab] = useState('programs');
  const [searchQuery, setSearchQuery] = useState('');

  // 模板库状态
  const [templates, setTemplates] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [templateTypeFilter, setTemplateTypeFilter] = useState('');

  // 编辑模板相关状态
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorName, setEditorName] = useState('');
  const [editorType, setEditorType] = useState('warmup');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorBodyParts, setEditorBodyParts] = useState([]);
  const [editorExercises, setEditorExercises] = useState([]);

  // 编辑器内部选择动作相关状态
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [exerciseSelectorSearch, setExerciseSelectorSearch] = useState('');
  const [exerciseSelectorType, setExerciseSelectorType] = useState('');

  // 删除模板二次确认
  const [showTemplateDeleteConfirm, setShowTemplateDeleteConfirm] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState(null);

  const loadTemplatesAndExercises = async () => {
    setLoadingTemplates(true);
    try {
      const [tplData, exData] = await Promise.all([
        fetchWorkoutTemplates(),
        fetchExercises()
      ]);
      setTemplates(tplData || []);
      setAllExercises(exData || []);
    } catch (err) {
      console.error('加载模板与动作库失败:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplatesAndExercises();
  }, []);

  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setEditorName('');
    setEditorType('warmup');
    setEditorDescription('');
    setEditorBodyParts([]);
    setEditorExercises([]);
    setShowTemplateEditor(true);
  };

  const handleOpenEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setEditorName(tpl.name || '');
    setEditorType(tpl.type || 'warmup');
    setEditorDescription(tpl.description || '');
    setEditorBodyParts(tpl.target_body_parts || []);
    setEditorExercises(tpl.exercises || []);
    setShowTemplateEditor(true);
  };

  const handleToggleBodyPart = (part) => {
    setEditorBodyParts(prev => 
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  };

  const handleAddExerciseToEditor = (ex) => {
    const defaultReps = ex.recording_method === 'duration_only' ? null : 10;
    const defaultDuration = ex.recording_method === 'duration_only' ? 30 : null;

    if (editorExercises.some(item => item.exercise === ex.name)) {
      alert('该动作已添加');
      return;
    }

    setEditorExercises(prev => [
      ...prev,
      {
        exercise: ex.name,
        sets: 2,
        reps: defaultReps,
        duration_seconds: defaultDuration,
        recording_method: ex.recording_method
      }
    ]);
    setShowExerciseSelector(false);
  };

  const handleUpdateEditorExercise = (index, updates) => {
    setEditorExercises(prev => 
      prev.map((item, idx) => idx === index ? { ...item, ...updates } : item)
    );
  };

  const handleRemoveEditorExercise = (index) => {
    setEditorExercises(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveTemplate = async () => {
    if (!editorName.trim()) {
      alert('请输入模板名称');
      return;
    }
    if (editorExercises.length === 0) {
      alert('请至少添加一个动作');
      return;
    }

    const payload = {
      name: editorName.trim(),
      type: editorType,
      target_body_parts: editorBodyParts,
      description: editorDescription.trim(),
      exercises: editorExercises
    };

    if (editingTemplate?.id) {
      payload.id = editingTemplate.id;
    }

    try {
      await saveWorkoutTemplate(payload);
      setShowTemplateEditor(false);
      loadTemplatesAndExercises();
    } catch (err) {
      console.error('保存模板失败:', err);
      alert('保存模板失败: ' + err.message);
    }
  };

  const handleOpenDeleteTemplate = (id) => {
    setPendingDeleteTemplateId(id);
    setShowTemplateDeleteConfirm(true);
  };

  const handleConfirmDeleteTemplate = async () => {
    try {
      await deleteWorkoutTemplate(pendingDeleteTemplateId);
      setShowTemplateDeleteConfirm(false);
      loadTemplatesAndExercises();
    } catch (err) {
      console.error('删除模板失败:', err);
      alert('删除模板失败: ' + err.message);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (templateTypeFilter && t.type !== templateTypeFilter) return false;
      if (templateSearchQuery.trim()) {
        const q = templateSearchQuery.trim().toLowerCase();
        const name = (t.name || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [templates, templateSearchQuery, templateTypeFilter]);

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
    try {
      await saveUserProgram(userProgramId, null, { is_active: false, paused_at: new Date().toISOString() });
    } catch (err) {
      onProgramError?.('暂停计划失败：' + err.message);
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
    try {
      await saveUserProgram(userProgramId, null, { is_active: true, paused_at: null });
    } catch (err) {
      onProgramError?.('恢复计划失败：' + err.message);
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
    try {
      await saveUserProgram(userProgramId, null, { is_active: false, ended_at: new Date().toISOString() });
    } catch (err) {
      onProgramError?.('结束计划失败：' + err.message);
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
        gymEquipmentConfig={gymEquipmentConfig}
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
          <button type="button" className="btn-aux w-8 h-8 rounded-full" onClick={() => setSelectedActiveProgramId(null)}>
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
            className="btn-main w-full"
            onClick={() => { setConfigProgram(p); setSelectedActiveProgramId(null); }}
          >
            <Settings size={16} />
            <span>更改配置</span>
          </button>
          {!up.is_active && up.paused_at ? (
            <button
              type="button"
              className="btn-main w-full"
              onClick={() => handleResumeProgram(up.id)}
            >
              <Play size={16} />
              <span>恢复计划</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-sec w-full"
              onClick={() => openPauseConfirm(up.id)}
            >
              <Pause size={16} />
              <span>暂停计划</span>
            </button>
          )}
          <button
            type="button"
            className="btn-sec text-error! border-error/30! hover:bg-error/5! w-full"
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
          <button type="button" className="btn-aux w-8 h-8 rounded-full" onClick={() => setSelectedProgram(null)}>
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
              <h4 className="section-subtitle select-none">训练日安排</h4>
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
            className="btn-main w-full"
            onClick={() => handleStartProgram(p)}
          >
            {active ? '更改配置' : '开始此计划'}
          </button>
          {active && (
            <button
              type="button"
              className="btn-sec w-full"
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
      <div>
        <h2 className="page-header">训练安排</h2>
        <p className="page-header-desc">选择或切换适合您的训练计划，并管理当前的训练进程。</p>
      </div>

      <div className="tabs tabs-boxed bg-bg-card/80 dark:bg-bg-card-dark/80 backdrop-blur-md border border-border-card dark:border-border-card-dark p-1.5 mb-1 select-none">
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
            activeSubTab === 'templates'
              ? 'tab-active !bg-primary !text-white font-bold rounded-xl shadow-md'
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
          }`}
          onClick={() => setActiveSubTab('templates')}
        >
          <Settings size={14} />
          <span>模板库</span>
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

      {activeSubTab === 'programs' && (
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
              <h4 className="section-subtitle px-1 select-none">
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
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-content animate-pulse"></span>
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
            <h4 className="section-subtitle px-1 select-none">
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
      )}

      {activeSubTab === 'templates' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* 顶栏搜索与新建按钮 */}
          <div className="flex gap-2.5">
            <div className="input input-bordered flex items-center gap-2 flex-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 transition-colors">
              <Search size={16} className="text-text-secondary/50 shrink-0" />
              <input type="text"
                className="w-full bg-transparent text-sm font-semibold text-text-main dark:text-text-main-dark focus:outline-none"
                placeholder="搜索模板..."
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
              />
              {templateSearchQuery && (
                <button type="button" className="btn btn-ghost btn-xs btn-circle p-0 cursor-pointer" onClick={() => setTemplateSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="button" onClick={handleOpenNewTemplate}
              className="btn-main px-4 h-10 flex items-center gap-1 text-xs whitespace-nowrap bg-primary hover:bg-primary-hover shadow-md font-bold cursor-pointer">
              <Plus size={14} />
              <span>新建模板</span>
            </button>
          </div>

          {/* 筛选按钮 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
            <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark shrink-0">分类:</span>
            {[
              { label: '全部', value: '' },
              { label: '练前热身', value: 'warmup' },
              { label: '练后拉伸', value: 'stretching' },
              { label: '自定义', value: 'custom' }
            ].map(cat => (
              <button key={cat.value} type="button"
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  templateTypeFilter === cat.value
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary dark:text-text-secondary-dark border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                }`}
                onClick={() => setTemplateTypeFilter(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 模板列表 */}
          {loadingTemplates ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-text-secondary gap-3">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-xs font-semibold">读取模板中...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center gap-3 min-h-[200px] opacity-70">
              <FolderOpen size={36} className="text-text-secondary/40 dark:text-text-secondary-dark/40" />
              <p className="text-sm font-bold text-text-main dark:text-text-main-dark">
                {templateSearchQuery || templateTypeFilter ? '没有匹配的模板' : '暂无模板，赶快新建一个吧！'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map(tpl => {
                const typeColor = tpl.type === 'warmup' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : tpl.type === 'stretching' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-primary/10 text-primary border-primary/20';
                const typeLabel = tpl.type === 'warmup' ? '热身' : tpl.type === 'stretching' ? '拉伸' : '自定义';
                return (
                  <div key={tpl.id} className="card !p-4 flex flex-col gap-3.5 hover:border-primary/25 transition-all duration-200 animate-fadeIn">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-text-main dark:text-text-main-dark truncate">{tpl.name}</span>
                          <span className={`badge border ${typeColor} badge-xs font-extrabold text-[9px] px-1.5 py-0.5 rounded-md`}>{typeLabel}</span>
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-2 leading-relaxed">
                          {tpl.description || '暂无描述信息'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => handleOpenEditTemplate(tpl)}
                          className="w-7 h-7 rounded-lg hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-secondary hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                          title="编辑模板">
                          <Edit size={14} />
                        </button>
                        <button type="button" onClick={() => handleOpenDeleteTemplate(tpl.id)}
                          className="w-7 h-7 rounded-lg hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-secondary hover:text-error flex items-center justify-center transition-all cursor-pointer"
                          title="删除模板">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 针对部位 tags */}
                    {(tpl.target_body_parts || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tpl.target_body_parts.map(p => (
                          <span key={p} className="badge badge-outline badge-xs font-semibold text-[9px] scale-95">{p}</span>
                        ))}
                      </div>
                    )}

                    {/* 包含的动作简析 */}
                    <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 rounded-xl p-2.5 border border-border-card/40 dark:border-border-card-dark/40">
                      <span className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark select-none">包含动作 ({(tpl.exercises || []).length}个)</span>
                      <div className="flex flex-col gap-1 mt-1 text-[11px] font-mono text-text-main dark:text-text-main-dark">
                        {(tpl.exercises || []).slice(0, 3).map((item, idx) => {
                          const exInfo = exercisesMap?.[item.exercise] || allExercises.find(e => e.name === item.exercise);
                          const exName = exInfo?.name_cn || item.exercise;
                          const detailText = item.recording_method === 'duration_only' 
                            ? `${item.sets}组 × ${item.duration_seconds || item.reps || 30}秒`
                            : `${item.sets}组 × ${item.reps || 10}次`;
                          return (
                            <div key={idx} className="flex justify-between items-center py-0.5 border-b border-border-card/25 dark:border-border-card-dark/25 last:border-b-0">
                              <span className="font-semibold truncate max-w-[60%]">{exName}</span>
                              <span className="text-text-secondary/70">{detailText}</span>
                            </div>
                          );
                        })}
                        {(tpl.exercises || []).length > 3 && (
                          <div className="text-[9px] text-text-secondary text-right pt-0.5 select-none">...以及其他 {(tpl.exercises || []).length - 3} 个动作</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'library' && (
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

      {/* 模板删除确认 */}
      <ConfirmModal
        isOpen={showTemplateDeleteConfirm}
        title="删除动作模板"
        message="您确定要删除这个模板吗？删除后在配置计划时将无法再拉取此模板，该操作不可逆。"
        onConfirm={handleConfirmDeleteTemplate}
        onCancel={() => setShowTemplateDeleteConfirm(false)}
        confirmText="确认删除"
        confirmClass="btn-error"
      />

      {/* 模板编辑抽屉 */}
      {showTemplateEditor && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <div className="bottom-sheet-backdrop animate-sheet-fade-in" onClick={() => setShowTemplateEditor(false)} />
          <div className="bottom-sheet-container animate-sheet-slide-up w-full max-w-lg flex flex-col gap-4 pb-6 max-h-[90vh]">
            <div className="flex items-center justify-between pb-2 border-b border-border-card/50 dark:border-border-card-dark/50 select-none">
              <h3 className="text-base font-bold text-text-main dark:text-text-main-dark">
                {editingTemplate ? '编辑动作模板' : '创建新动作模板'}
              </h3>
              <button type="button" onClick={() => setShowTemplateEditor(false)}
                className="w-7 h-7 rounded-lg hover:bg-bg-hover text-text-secondary flex items-center justify-center text-lg font-bold cursor-pointer">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[60vh]">
              {/* Name input */}
              <div className="flex flex-col gap-1.5">
                <label className="section-subtitle select-none mb-0">模板名称</label>
                <input type="text" placeholder="例如：下肢拉伸放松"
                  className="input input-bordered w-full bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary text-sm font-semibold h-10 px-3"
                  value={editorName} onChange={(e) => setEditorName(e.target.value)} />
              </div>

              {/* Type Select */}
              <div className="flex flex-col gap-1.5 select-none">
                <label className="section-subtitle select-none mb-0">模板类型</label>
                <select className="select-standard w-full !h-10 text-sm"
                  value={editorType} onChange={(e) => setEditorType(e.target.value)}>
                  <option value="warmup">练前热身 (Warmup)</option>
                  <option value="stretching">练后拉伸 (Stretching)</option>
                  <option value="custom">自定义安排 (Custom)</option>
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="section-subtitle select-none mb-0">模板描述</label>
                <textarea placeholder="输入描述信息（如：用于深蹲日之后的静态肌肉放松）"
                  className="textarea textarea-bordered w-full bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary text-xs h-16 resize-none p-2"
                  value={editorDescription} onChange={(e) => setEditorDescription(e.target.value)} />
              </div>

              {/* Target Body Parts */}
              <div className="flex flex-col gap-1.5 select-none">
                <label className="section-subtitle select-none mb-0">针对部位</label>
                <div className="flex flex-wrap gap-1.5">
                  {['全身', '上肢', '下肢', '肩部', '胸部', '背部', '臀部', '核心', '膝部'].map(part => {
                    const isSelected = editorBodyParts.includes(part);
                    return (
                      <button key={part} type="button"
                        onClick={() => handleToggleBodyPart(part)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary border-border-card dark:border-border-card-dark hover:bg-bg-hover'
                        }`}>
                        {part}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exercises編排 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-border-card/30 dark:border-border-card-dark/30 pb-1 select-none">
                  <label className="section-subtitle select-none mb-0">动作编排</label>
                  <button type="button" onClick={() => { setShowExerciseSelector(true); setExerciseSelectorSearch(''); }}
                    className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 px-2 rounded font-bold flex items-center gap-0.5 cursor-pointer">
                    <Plus size={12} />
                    <span>添加动作</span>
                  </button>
                </div>

                {editorExercises.length === 0 ? (
                  <p className="text-center py-6 text-xs text-text-secondary/60 bg-bg-main/10 dark:bg-bg-main-dark/10 rounded-xl border border-dashed border-border-card/50 dark:border-border-card-dark/50 select-none">
                    暂无动作，点击右上角“添加动作”开始编排
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {editorExercises.map((item, idx) => {
                      const exInfo = exercisesMap?.[item.exercise] || allExercises.find(e => e.name === item.exercise);
                      const exName = exInfo?.name_cn || item.exercise;
                      const isDuration = item.recording_method === 'duration_only';
                      const typeLabel = EXERCISE_TYPE_MAP[exInfo?.exercise_type] || exInfo?.exercise_type || '其他';
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-bg-main/20 dark:bg-bg-main-dark/20 rounded-xl border border-border-card/50 dark:border-border-card-dark/50 animate-fadeIn">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-main dark:text-text-main-dark truncate">{exName}</p>
                            <span className="badge badge-outline border-border-card text-[8px] scale-90 -translate-x-1 font-bold whitespace-nowrap bg-bg-main/30">
                              {typeLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 select-none">
                            {/* Sets */}
                            <div className="flex items-center gap-1">
                              <input type="number" min="1" max="10"
                                className="h-7 w-8 rounded border border-border-card text-center text-xs font-mono font-bold bg-bg-card dark:bg-bg-card-dark focus:outline-none focus:ring-1 focus:ring-primary px-0"
                                value={item.sets || 1}
                                onChange={(e) => handleUpdateEditorExercise(idx, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                              />
                              <span className="text-[10px] text-text-secondary select-none">组</span>
                            </div>

                            {/* Reps or Duration */}
                            <div className="flex items-center gap-1">
                              {isDuration ? (
                                <>
                                  <input type="number" min="5" max="300" step="5"
                                    className="h-7 w-12 rounded border border-border-card text-center text-xs font-mono font-bold bg-bg-card dark:bg-bg-card-dark focus:outline-none focus:ring-1 focus:ring-primary px-0"
                                    value={item.duration_seconds || 30}
                                    onChange={(e) => handleUpdateEditorExercise(idx, { duration_seconds: Math.max(1, parseInt(e.target.value) || 30) })}
                                  />
                                  <span className="text-[10px] text-text-secondary select-none">秒</span>
                                </>
                              ) : (
                                <>
                                  <input type="number" min="1" max="100"
                                    className="h-7 w-10 rounded border border-border-card text-center text-xs font-mono font-bold bg-bg-card dark:bg-bg-card-dark focus:outline-none focus:ring-1 focus:ring-primary px-0"
                                    value={item.reps || 10}
                                    onChange={(e) => handleUpdateEditorExercise(idx, { reps: Math.max(1, parseInt(e.target.value) || 10) })}
                                  />
                                  <span className="text-[10px] text-text-secondary select-none">次</span>
                                </>
                              )}
                            </div>

                            <button type="button" onClick={() => handleRemoveEditorExercise(idx)}
                              className="w-7 h-7 rounded hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-secondary hover:text-error flex items-center justify-center transition-all text-xs font-bold cursor-pointer">
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2.5 mt-2 select-none">
              <button type="button" onClick={() => setShowTemplateEditor(false)}
                className="btn-sec flex-1 py-2 h-11 text-xs">
                取消
              </button>
              <button type="button" onClick={handleSaveTemplate}
                className="btn-main flex-1 py-2 h-11 text-xs bg-primary hover:bg-primary-hover shadow-md font-bold animate-pulse">
                保存模板
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Inner Exercise Selector Modal (共享组件) */}
      <ExercisePickerModal
        isOpen={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        title="选择模板动作"
        search={exerciseSelectorSearch}
        onSearchChange={setExerciseSelectorSearch}
        searchPlaceholder="搜索动作名称、流派..."
        exercises={allExercises.filter(ex => {
          if (exerciseSelectorType && ex.exercise_type !== exerciseSelectorType) return false;
          if (exerciseSelectorSearch.trim()) {
            const q = exerciseSelectorSearch.trim().toLowerCase();
            const name = (ex.name || '').toLowerCase();
            const nameCn = (ex.name_cn || '').toLowerCase();
            if (!name.includes(q) && !nameCn.includes(q)) return false;
          }
          return true;
        })}
        renderItem={(ex) => {
          const isAdded = editorExercises.some(item => item.exercise === ex.name);
          const typeLabel = EXERCISE_TYPE_MAP[ex.exercise_type] || ex.exercise_type;
          return (
            <button key={ex.id} type="button"
              disabled={isAdded}
              onClick={() => handleAddExerciseToEditor(ex)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all border border-transparent hover:bg-bg-hover dark:hover:bg-bg-hover-dark cursor-pointer disabled:opacity-50 disabled:pointer-events-none">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-text-main dark:text-text-main-dark truncate">{ex.name_cn || ex.name}</span>
                  <span className="badge badge-outline border-border-card text-[8px] scale-90 -translate-x-0.5 font-bold whitespace-nowrap bg-bg-main/30">{typeLabel}</span>
                </div>
                <span className="text-[9px] text-text-secondary/70 font-mono mt-0.5">记录: {RECORDING_METHOD_MAP[ex.recording_method] || ex.recording_method}</span>
              </div>
              {isAdded && <span className="text-[9px] text-text-secondary/50 font-bold bg-bg-main/20 px-1.5 py-0.5 rounded select-none">已添加</span>}
            </button>
          );
        }}
      >
        {/* Genre Filter */}
        <div className="flex gap-1 overflow-x-auto pb-1 select-none">
          {[
            { label: '全部', value: '' },
            { label: '拉伸', value: 'stretching' },
            { label: '动物流', value: 'animal_flow' },
            { label: '关节活动', value: 'mobility' },
            { label: '筋膜放松', value: 'myofascial_release' },
            { label: '力量', value: 'strength' }
          ].map(genre => (
            <button key={genre.value} type="button"
              onClick={() => setExerciseSelectorType(genre.value)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                exerciseSelectorType === genre.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg-main/20 dark:bg-bg-main-dark/20 text-text-secondary border-border-card dark:border-border-card-dark'
              }`}>
              {genre.label}
            </button>
          ))}
        </div>
      </ExercisePickerModal>
    </div>
  );
}

export default PlanScreen;
