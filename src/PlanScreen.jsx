import { useState, useMemo, useEffect, useCallback } from 'react';
import { saveUserProgram, fetchExercises, fetchWorkoutTemplates, saveWorkoutTemplate, deleteWorkoutTemplate } from './services/programService';
import { Search, ChevronRight, X, Users, Calendar, Zap, Target, BookOpen, Pause, Play, StopCircle, Settings, AlertTriangle, Plus, Trash2, Edit, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import ProgramConfigScreen from './ProgramConfigScreen';
import ExerciseLibrary from './ExerciseLibrary';
import ExercisePickerModal from './components/ExercisePickerModal';
import { getCNName, FEATURE_LABELS, EXERCISE_TYPE_MAP } from './exerciseNames';
import { convertWeight, toStorageWeight } from './unitUtils';

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

// EXERCISE_TYPE_MAP 已从 exerciseNames 导入

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
  const [templateEditorError, setTemplateEditorError] = useState('');

  // 编辑器内部选择动作相关状态
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [exerciseSelectorSearch, setExerciseSelectorSearch] = useState('');
  const [exerciseSelectorType, setExerciseSelectorType] = useState('');

  // 删除模板二次确认
  const [showTemplateDeleteConfirm, setShowTemplateDeleteConfirm] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState(null);

  const loadTemplatesAndExercises = useCallback(async () => {
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
      onProgramError?.('加载模板与动作库失败：' + err.message);
    } finally {
      setLoadingTemplates(false);
    }
  }, [onProgramError]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadTemplatesAndExercises();
    });
    return () => { cancelled = true; };
  }, [loadTemplatesAndExercises]);

  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setEditorName('');
    setEditorType('warmup');
    setEditorDescription('');
    setEditorBodyParts([]);
    setEditorExercises([]);
    setTemplateEditorError('');
    setShowTemplateEditor(true);
  };

  const handleOpenEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setEditorName(tpl.name || '');
    setEditorType(tpl.type || 'warmup');
    setEditorDescription(tpl.description || '');
    setEditorBodyParts(tpl.target_body_parts || []);
    setEditorExercises(tpl.exercises || []);
    setTemplateEditorError('');
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
      setTemplateEditorError('该动作已添加');
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
    setTemplateEditorError('');
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
      setTemplateEditorError('请输入模板名称');
      return;
    }
    if (editorExercises.length === 0) {
      setTemplateEditorError('请至少添加一个动作');
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
      setTemplateEditorError('保存模板失败：' + err.message);
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
      onProgramError?.('删除模板失败：' + err.message);
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

  const filteredPrograms = useMemo(() => programs.filter(p => {
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
  }), [programs, searchQuery, categoryFilter, difficultyFilter, daysFilter]);

  const isProgramActive = useCallback((programId) => {
    return userPrograms.some(up => up.program_id === programId && up.is_active);
  }, [userPrograms]);

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

    const handleUpdateExerciseParams = async (userProgram, exKey, tier, updates) => {
      const nextUP = JSON.parse(JSON.stringify(userProgram));
      if (!nextUP.program_state) nextUP.program_state = {};
      if (!nextUP.program_state.exercises) nextUP.program_state.exercises = {};
      if (!nextUP.program_state.exercises[exKey]) nextUP.program_state.exercises[exKey] = {};
      if (!nextUP.program_state.exercises[exKey][tier]) nextUP.program_state.exercises[exKey][tier] = {};

      const exState = nextUP.program_state.exercises[exKey][tier];
      
      if (updates.weight !== undefined) {
        exState.weight = updates.weight;
      }
      if (updates.status !== undefined) {
        exState.status = updates.status;
      }
      if (updates.scheme_index !== undefined) {
        exState.scheme_index = updates.scheme_index;
      }
      if (updates.major_cycle !== undefined) {
        exState.major_cycle = updates.major_cycle;
      }

      if (!nextUP.exercise_config) nextUP.exercise_config = {};
      if (!nextUP.exercise_config[exKey]) nextUP.exercise_config[exKey] = {};
      const userEx = nextUP.exercise_config[exKey];

      if (updates.increment !== undefined) {
        if (tier === 'T1') userEx.increment_t1 = updates.increment;
        else if (tier === 'T2') userEx.increment_t2 = updates.increment;
        else userEx.increment_t3 = updates.increment;
      }
      if (updates.unit !== undefined) {
        userEx.unit = updates.unit;
      }

      try {
        optimisticUpdateUserProgram(userProgram.id, {
          program_state: nextUP.program_state,
          exercise_config: nextUP.exercise_config
        });
        await saveUserProgram(userProgram.id, null, {
          program_state: nextUP.program_state,
          exercise_config: nextUP.exercise_config
        });
      } catch (err) {
        console.error('Failed to update exercise params:', err);
        onProgramError?.('更新动作参数失败：' + err.message);
      }
    };

    // 如果是活跃的 GZCLP 计划，并且有训练记录，显示进行中看板
    if (engineType === 'gzclp' && up.program_state?.total_sessions > 0) {
      const rotation = Math.floor((up.program_state?.total_sessions || 0) / (p.days_per_week || 4)) + 1;
      
      const getActiveExercises = () => {
        const list = [];
        if (!p.config?.day_map) return list;
        Object.values(p.config.day_map).forEach(dayConfig => {
          if (dayConfig.T1) list.push({ exercise: dayConfig.T1, tier: 'T1' });
          if (dayConfig.T2) list.push({ exercise: dayConfig.T2, tier: 'T2' });
          if (dayConfig.T3) {
            const t3s = Array.isArray(dayConfig.T3) ? dayConfig.T3 : [dayConfig.T3];
            t3s.forEach(t3 => {
              list.push({ exercise: t3, tier: 'T3' });
            });
          }
        });
        const seen = new Set();
        return list.filter(item => {
          const key = `${item.exercise}-${item.tier}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const activeExs = getActiveExercises();
      const gdState = up.program_state?.global_deload || {};
      const isGDActive = gdState.status === 'active';

      return (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* Header */}
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

          {/* 看板整体进度卡片 */}
          <div className="card bg-bg-card border border-border-card dark:bg-bg-card-dark dark:border-border-card-dark rounded-2xl p-4 flex flex-col gap-3 shadow-sm select-none">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">进行中计划进度</span>
                <span className="text-sm font-bold text-text-main dark:text-text-main-dark mt-0.5">
                  第 <span className="font-mono text-base font-black text-primary">{rotation}</span> 轮训练周期 (Rotation)
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">累计已完成</span>
                <span className="text-sm font-mono font-bold text-text-main dark:text-text-main-dark mt-0.5">
                  {up.program_state?.total_sessions || 0} 次训练
                </span>
              </div>
            </div>

            {isGDActive && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-pulse">
                <AlertTriangle size={14} className="shrink-0" />
                <span>⚠️ 全局减载已激活 (当前负荷降低 {up.exercise_config?._global_deload?.intensity_pct ?? 20}%)</span>
              </div>
            )}
          </div>

          {/* 动作细节列表 */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark px-1">动作进阶参数监控与微调</h4>
            {activeExs.map(({ exercise, tier }, idx) => {
              const userEx = up.exercise_config?.[exercise] || {};
              const exUnit = userEx.unit || up.exercise_config?._unit || 'kg';
              const exState = up.program_state?.exercises?.[exercise]?.[tier] || {};
              
              const currentWeightKg = exState.weight ?? (tier === 'T1' ? (userEx.initial_weight_t1 ?? userEx.initial_weight ?? p.config.default_weights?.[exercise]) : tier === 'T2' ? (userEx.initial_weight_t2 ?? userEx.initial_weight ?? p.config.default_weights?.[exercise]) : (userEx.initial_weight ?? p.config.default_weights?.[exercise] ?? 10));
              const incrementKg = tier === 'T1' ? (userEx.increment_t1 ?? p.config.default_increment?.T1 ?? 2.5) : tier === 'T2' ? (userEx.increment_t2 ?? p.config.default_increment?.T2 ?? 2.5) : (userEx.increment_t3 ?? p.config.default_increment?.T3 ?? 2.5);

              const displayWeight = exUnit === 'lbs' ? convertWeight(currentWeightKg, 'lbs') : currentWeightKg;
              const displayIncrement = exUnit === 'lbs' ? convertWeight(incrementKg, 'lbs') : incrementKg;

              const schemeText = (() => {
                if (tier === 'T3') {
                  const isDouble = userEx.progression_type === 'double_progression';
                  if (isDouble) {
                    return `${exState.sets ?? userEx.sets ?? 3}组 × ${exState.planned_reps ?? userEx.min_reps ?? 12}次 (双进阶)`;
                  }
                  return `3组 × 15次 (AMRAP)`;
                }
                const chainKey = tier === 'T1' ? 't1_chain' : 't2_chain';
                const schemeKey = tier === 'T1' ? 't1_schemes' : 't2_schemes';
                const userChain = userEx[chainKey];
                const defaultSchemes = p.config[schemeKey] || [];
                const schemeIdx = exState.scheme_index ?? 0;
                if (userChain && userChain.length > 0) {
                  const stage = userChain[schemeIdx] || userChain[0];
                  return `${stage.sets}组 × ${stage.reps}次${stage.amrap ? ' (AMRAP)' : ''}`;
                } else {
                  const scheme = defaultSchemes[schemeIdx] || defaultSchemes[0];
                  if (scheme) {
                    return `${scheme.sets}组 × ${scheme.reps}次${scheme.amrap_last ? ' (AMRAP)' : ''}`;
                  }
                }
                return '未知阶段';
              })();

              const tierBadge = tier === 'T1' ? 'bg-primary/10 text-primary' : tier === 'T2' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent';
              const tierBorder = tier === 'T1' ? 'border-l-primary' : tier === 'T2' ? 'border-l-secondary' : 'border-l-accent';

              return (
                <div key={`${exercise}-${tier}-${idx}`} className={`card bg-bg-card border border-border-card border-l-4 ${tierBorder} dark:bg-bg-card-dark dark:border-border-card-dark rounded-2xl p-4 flex flex-col gap-3 shadow-sm select-none`}>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                      <span className="text-sm font-bold text-text-main dark:text-text-main-dark">
                        {getCNName(exercise, exercisesMap)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const newUnit = exUnit === 'lbs' ? 'kg' : 'lbs';
                          handleUpdateExerciseParams(up, exercise, tier, { unit: newUnit });
                        }}
                        className="text-xs font-mono font-bold text-primary dark:text-primary-dark bg-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/20 cursor-pointer border-0"
                      >
                        {exUnit}
                      </button>
                    </div>
                  </div>

                  {/* Status Row */}
                  <div className="flex items-center justify-between text-xs bg-bg-main/30 dark:bg-bg-main-dark/30 px-3 py-2 rounded-xl border border-border-card/50 dark:border-border-card-dark/50 font-semibold text-text-secondary dark:text-text-secondary-dark">
                    <span>当前阶段: {schemeText}</span>
                    {exState.status === 'needs_retest' ? (
                      <span className="text-amber-500 font-bold">⚠️ 待重测极限</span>
                    ) : (
                      <span>大轮次: 第 {exState.major_cycle ?? 1} 轮</span>
                    )}
                  </div>

                  {/* Param Editors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark">当前负荷 ({exUnit})</label>
                      <div className="input-standard flex items-center justify-between px-3 h-10">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={displayWeight === '' || displayWeight === undefined ? '' : displayWeight}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, '');
                            const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                            const val = cleaned === '' || cleaned === '.' ? '' : parseFloat(cleaned);
                            const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                            handleUpdateExerciseParams(up, exercise, tier, { weight: kgVal });
                          }}
                          className="w-full bg-transparent font-mono font-bold text-sm text-text-main dark:text-text-main-dark focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-text-secondary/50 font-mono select-none">{exUnit}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary dark:text-text-secondary-dark">单次进阶步长 ({exUnit})</label>
                      <div className="input-standard flex items-center justify-between px-3 h-10">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={displayIncrement === '' || displayIncrement === undefined ? '' : displayIncrement}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, '');
                            const cleaned = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                            const val = cleaned === '' || cleaned === '.' ? '' : parseFloat(cleaned);
                            const kgVal = exUnit === 'lbs' ? toStorageWeight(val, 'lbs') : val;
                            handleUpdateExerciseParams(up, exercise, tier, { increment: kgVal });
                          }}
                          className="w-full bg-transparent font-mono font-bold text-sm text-text-main dark:text-text-main-dark focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-text-secondary/50 font-mono select-none">{exUnit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Actions inside card */}
                  <div className="flex items-center gap-2 border-t border-border-card/30 dark:border-border-card-dark/30 pt-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`确认将该动作 ${getCNName(exercise, exercisesMap)} (${tier}) 重置到进阶起点（即第 0 节点，状态置为激活）？`)) {
                          handleUpdateExerciseParams(up, exercise, tier, { scheme_index: 0, status: 'active' });
                        }
                      }}
                      className="btn-sec flex-1 h-8 min-h-8 text-xs rounded-xl border-border-card/70 hover:bg-bg-hover cursor-pointer"
                    >
                      重置动作进度
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`确认手动将该动作 ${getCNName(exercise, exercisesMap)} (${tier}) 标记为“待重测极限”？下一次训练将触发重测。`)) {
                          handleUpdateExerciseParams(up, exercise, tier, { status: 'needs_retest' });
                        }
                      }}
                      className="btn-sec flex-1 h-8 min-h-8 text-xs rounded-xl text-amber-500 hover:text-amber-600 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer"
                    >
                      触发极限重测
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部计划控制按钮 */}
          <div className="flex flex-col gap-2 border-t border-border-card dark:border-border-card-dark pt-4 mt-2">
            <button
              type="button"
              className="btn-main w-full h-11 min-h-0 font-bold cursor-pointer"
              onClick={() => { setConfigProgram(p); setSelectedActiveProgramId(null); }}
            >
              <Settings size={16} />
              <span>更改动作与进阶方案配置</span>
            </button>
            
            <div className="flex gap-2">
              {!up.is_active && up.paused_at ? (
                <button
                  type="button"
                  className="btn-main flex-1 h-11 min-h-0 font-bold bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                  onClick={() => handleResumeProgram(up.id)}
                >
                  <Play size={16} />
                  <span>恢复计划</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-sec flex-1 h-11 min-h-0 font-semibold cursor-pointer"
                  onClick={() => openPauseConfirm(up.id)}
                >
                  <Pause size={16} />
                  <span>暂停计划</span>
                </button>
              )}
              <button
                type="button"
                className="btn-sec flex-1 h-11 min-h-0 text-error border-error/20 hover:bg-error/5 cursor-pointer"
                onClick={() => openEndConfirm(up.id)}
              >
                <StopCircle size={16} />
                <span>结束计划</span>
              </button>
            </div>
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
                            <div key={item.exercise || idx} className="flex justify-between items-center py-0.5 border-b border-border-card/25 dark:border-border-card-dark/25 last:border-b-0">
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
                  value={editorName} onChange={(e) => { setEditorName(e.target.value); setTemplateEditorError(''); }} />
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
                        <div key={item.exercise || idx} className="flex items-center justify-between gap-3 p-3 bg-bg-main/20 dark:bg-bg-main-dark/20 rounded-xl border border-border-card/50 dark:border-border-card-dark/50 animate-fadeIn">
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

              {templateEditorError && (
                <div className="rounded-xl border border-alert/30 dark:border-alert-dark/30 bg-bg-alert dark:bg-bg-alert-dark px-3 py-2 text-xs font-bold text-alert dark:text-alert-dark">
                  {templateEditorError}
                </div>
              )}
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
