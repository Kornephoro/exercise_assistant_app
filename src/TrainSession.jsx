import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minimize2, X, Check, Sparkles, Clock, SkipForward, Plus, FastForward } from 'lucide-react';

const DEFAULT_REST_SECONDS = 90;

const TEMPO_PRESETS = [
  { label: '标准', values: [3, 1, 1, 0] },
  { label: '慢速离心', values: [4, 2, 1, 0] },
  { label: '爆发向心', values: [2, 0, 1, 0] },
  { label: '等长收缩', values: [3, 3, 1, 1] },
  { label: '自定义', values: null },
];

const TEMPO_LABELS = ['离心', '底部', '向心', '顶部'];

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
  const [focusedSet, setFocusedSet] = useState(null);
  const [showSetCard, setShowSetCard] = useState(false);
  const [showRestCard, setShowRestCard] = useState(false);

  const [restTimer, setRestTimer] = useState({
    active: false,
    total: DEFAULT_REST_SECONDS,
    remaining: DEFAULT_REST_SECONDS
  });

  const [setDetails, setSetDetails] = useState({});
  const [customRestSeconds, setCustomRestSeconds] = useState(DEFAULT_REST_SECONDS);

  const audioContextRef = useRef(null);
  const restTimerRef = useRef(null);

  const getRecordingMethod = (exerciseKey) => exercisesMap?.[exerciseKey]?.recording_method || 'standard';

  const getTotalSets = () => (todayWorkout?.exercises || []).reduce((sum, ex) => sum + (sessionState.setsData[ex.tier]?.length || 0), 0);
  const getCompletedSets = () => Object.values(sessionState.setsData).flat().filter(s => s.completed).length;
  const getProgress = () => { const t = getTotalSets(); return t === 0 ? 0 : Math.round((getCompletedSets() / t) * 100); };
  const isSessionFinished = () => getProgress() === 100;

  const getSetKey = (exerciseIdx, setIdx) => {
    const ex = todayWorkout?.exercises?.[exerciseIdx];
    return ex ? `${ex.tier}_${exerciseIdx}_${setIdx}` : '';
  };

  const playBeep = useCallback((freq = 800, dur = 200) => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur / 1000);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur / 1000);
    } catch (e) { /* ignore */ }
  }, []);

  const playRestEndSound = useCallback(() => {
    playBeep(600, 150);
    setTimeout(() => playBeep(800, 150), 200);
    setTimeout(() => playBeep(1000, 200), 400);
  }, [playBeep]);

  useEffect(() => {
    if (restTimer.active && restTimer.remaining > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (prev.remaining <= 1) { 
            clearInterval(restTimerRef.current); 
            playRestEndSound(); 
            setShowRestCard(false);
            // 自动打开下一组
            if (focusedSet) {
              const { exerciseIdx, setIdx } = focusedSet;
              const ex = todayWorkout.exercises[exerciseIdx];
              const totalSets = sessionState.setsData[ex.tier].length;
              if (setIdx === totalSets - 1 && exerciseIdx < todayWorkout.exercises.length - 1) {
                openSetCard(exerciseIdx + 1, 0);
              } else if (setIdx < totalSets - 1) {
                openSetCard(exerciseIdx, setIdx + 1);
              }
            }
            return { ...prev, active: false, remaining: 0 }; 
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [restTimer.active, playRestEndSound]);

  const handleToggleSet = (tier, setIndex) => {
    const updated = { ...sessionState.setsData };
    const target = updated[tier][setIndex];
    target.completed = !target.completed;
    if (target.completed && (target.actual_reps === '' || target.actual_reps === undefined)) target.actual_reps = target.planned_reps;
    setSessionState(prev => ({ ...prev, setsData: updated }));
  };

  const handleRepsChange = (tier, setIndex, value) => {
    const updated = { ...sessionState.setsData };
    updated[tier][setIndex].actual_reps = value === '' ? '' : parseInt(value, 10);
    setSessionState(prev => ({ ...prev, setsData: updated }));
  };

  const handleWeightChange = (tier, setIndex, value) => {
    const updated = { ...sessionState.setsData };
    updated[tier][setIndex].weight_kg = value === '' ? 0 : parseFloat(value);
    setSessionState(prev => ({ ...prev, setsData: updated }));
  };

  const handleDurationChange = (tier, setIndex, value) => {
    const updated = { ...sessionState.setsData };
    updated[tier][setIndex].duration_seconds = value === '' ? 0 : parseInt(value, 10);
    setSessionState(prev => ({ ...prev, setsData: updated }));
  };

  const handleDistanceChange = (tier, setIndex, value) => {
    const updated = { ...sessionState.setsData };
    updated[tier][setIndex].distance_meters = value === '' ? 0 : parseFloat(value);
    setSessionState(prev => ({ ...prev, setsData: updated }));
  };

  const openSetCard = (exerciseIdx, setIdx) => { setFocusedSet({ exerciseIdx, setIdx }); setShowSetCard(true); };
  const closeSetCard = () => { setShowSetCard(false); setFocusedSet(null); };

  const completeSet = () => {
    if (!focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    handleToggleSet(ex.tier, setIdx);
    closeSetCard();
    const totalSets = sessionState.setsData[ex.tier].length;
    const isLastExercise = exerciseIdx === todayWorkout.exercises.length - 1;
    const isLastSet = setIdx === totalSets - 1;
    if (!(isSessionFinished() || (isLastSet && isLastExercise))) {
      setRestTimer({ active: true, total: customRestSeconds, remaining: customRestSeconds });
      setShowRestCard(true);
    }
  };

  const skipRest = () => {
    setShowRestCard(false);
    setRestTimer({ active: false, total: DEFAULT_REST_SECONDS, remaining: DEFAULT_REST_SECONDS });
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (focusedSet) {
      const { exerciseIdx, setIdx } = focusedSet;
      const ex = todayWorkout.exercises[exerciseIdx];
      const totalSets = sessionState.setsData[ex.tier].length;
      if (setIdx === totalSets - 1 && exerciseIdx < todayWorkout.exercises.length - 1) openSetCard(exerciseIdx + 1, 0);
      else if (setIdx < totalSets - 1) openSetCard(exerciseIdx, setIdx + 1);
    }
  };

  const addRestTime = (seconds) => setRestTimer(prev => ({ ...prev, remaining: prev.remaining + seconds, total: prev.total + seconds }));
  const updateSetDetail = (key, field, value) => setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const applyTempoPreset = (key, presetValues) => {
    if (presetValues) {
      setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], tempo_eccentric: presetValues[0], tempo_pause_bottom: presetValues[1], tempo_concentric: presetValues[2], tempo_pause_top: presetValues[3] } }));
    }
  };

  const getRpeColor = (v) => v <= 4 ? 'text-green-500' : v <= 7 ? 'text-yellow-500' : 'text-red-500';
  const handleAbort = () => onCancel();

  // ============ SET DETAIL CARD (floating centered) ============
  const renderSetCard = () => {
    if (!showSetCard || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[ex.tier]?.[setIdx];
    if (!set) return null;

    const method = getRecordingMethod(ex.exercise);
    const setKey = getSetKey(exerciseIdx, setIdx);
    const detail = setDetails[setKey] || {};
    const rpeValue = detail.rpe ?? 7;
    const totalSets = sessionState.setsData[ex.tier].length;

    const weightLabel = method === 'bodyweight_added' ? '附加重量' : method === 'bodyweight_assisted' ? '辅助重量' : method === 'loaded_carry' ? '负重重量' : '实际重量';
    const weightPlaceholder = method === 'loaded_carry' ? 'kg' : ex.weight?.toFixed(1);
    const weightStep = method === 'loaded_carry' ? 0.5 : 0.5;
    const needsWeightInput = ['standard', 'bodyweight_added', 'bodyweight_assisted', 'loaded_carry'].includes(method);
    const needsRepsInput = method !== 'duration_only' && method !== 'distance_only';

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={closeSetCard}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-base-content/50">第 {set.set_number} 组 / 共 {totalSets} 组</span>
            </div>

            {/* Summary Line - Large Typography */}
            <div className="p-3 rounded-xl bg-base-200/50">
              <div className="text-2xl font-bold text-base-content">
                {set.planned_reps} 次 @ {ex.weight?.toFixed(1)}kg
              </div>
              <div className="text-lg font-semibold text-base-content/60 mt-1">
                RPE {set.planned_rpe ?? 7} | 节奏 {set.tempo ?? '3110'} | 休息 {customRestSeconds}秒
              </div>
            </div>

            {/* Reps & Weight side by side */}
            {(needsRepsInput || needsWeightInput) && (
              <div className="grid grid-cols-2 gap-3">
                {needsRepsInput && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-base-content/50">实际次数</label>
                    <input 
                      type="number" 
                      className="input input-bordered text-center font-mono text-3xl font-bold w-full h-14 text-base-content" 
                      value={set.actual_reps ?? set.planned_reps ?? ''} 
                      onChange={(e) => handleRepsChange(ex.tier, setIdx, e.target.value)} 
                    />
                  </div>
                )}
                {needsWeightInput && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-base-content/50">{weightLabel}</label>
                    <input 
                      type="number" 
                      step={weightStep} 
                      className="input input-bordered text-center font-mono text-3xl font-bold w-full h-14 text-base-content" 
                      value={set.weight_kg ?? ex.weight ?? ''} 
                      onChange={(e) => handleWeightChange(ex.tier, setIdx, e.target.value)} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Duration */}
            {method === 'duration_only' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-base-content/50">时长（秒）</label>
                <input 
                  type="number" 
                  className="input input-bordered text-center font-mono text-3xl font-bold w-full h-14" 
                  value={set.duration_seconds ?? ''} 
                  placeholder="秒" 
                  onChange={(e) => handleDurationChange(ex.tier, setIdx, e.target.value)} 
                />
              </div>
            )}

            {/* Distance */}
            {method === 'distance_only' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-base-content/50">距离（米）</label>
                <input 
                  type="number" 
                  step="0.1" 
                  className="input input-bordered text-center font-mono text-3xl font-bold w-full h-14" 
                  value={set.distance_meters ?? ''} 
                  placeholder="米" 
                  onChange={(e) => handleDistanceChange(ex.tier, setIdx, e.target.value)} 
                />
              </div>
            )}

            <div className="divider my-0" />

            {/* RPE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-base-content/50">RPE</label>
                <span className={`text-3xl font-bold font-mono ${getRpeColor(rpeValue)}`}>{rpeValue.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="10" step="0.5" value={rpeValue} className="range range-primary w-full" onChange={(e) => updateSetDetail(setKey, 'rpe', parseFloat(e.target.value))} />
              <div className="flex justify-between px-1 text-xs text-base-content/30 font-mono"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
            </div>

            {/* Tempo: presets left, fields right */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-base-content/50">动作节奏</label>
              <div className="flex gap-3 items-stretch">
                {/* 左侧：3 个预设按钮垂直排列，占 50%，均匀分布 */}
                <div className="flex-1 flex flex-col gap-1.5 justify-between">
                  {TEMPO_PRESETS.slice(0, 3).map((preset, idx) => (
                    <button key={idx} type="button" className={`btn btn-ghost h-7 min-h-0 px-2 text-xs w-full whitespace-nowrap rounded-full ${preset.values === null ? 'btn-outline' : ''}`} onClick={() => applyTempoPreset(setKey, preset.values)}>{preset.label}</button>
                  ))}
                </div>
                {/* 右侧：4 个输入框横向并排，占 50% */}
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {TEMPO_LABELS.map((label, idx) => {
                    const fields = ['tempo_eccentric', 'tempo_pause_bottom', 'tempo_concentric', 'tempo_pause_top'];
                    const defaults = [3, 1, 1, 0];
                    return (
                      <div key={fields[idx]} className="flex flex-col gap-1 items-center">
                        <span className="text-xs text-base-content/40">{label}</span>
                        <input type="number" min="0" max="9" className="input input-bordered text-center font-mono font-bold w-full h-16 text-3xl rounded-md px-0" value={detail[fields[idx]] ?? defaults[idx]} onChange={(e) => updateSetDetail(setKey, fields[idx], parseInt(e.target.value) || 0)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 组间休息调整 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-base-content/50">组间休息（秒）</label>
              <input 
                type="number" 
                className="input input-bordered text-center font-mono text-3xl font-bold w-full h-14" 
                value={customRestSeconds}
                onChange={(e) => setCustomRestSeconds(parseInt(e.target.value) || 90)}
              />
            </div>

            {/* 备注/感受 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-base-content/50">备注/感受</label>
              <textarea 
                className="textarea textarea-bordered w-full h-20 text-sm" 
                placeholder="记录本组感受..."
                value={detail.notes || ''}
                onChange={(e) => updateSetDetail(setKey, 'notes', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" className="btn btn-primary flex-1 font-bold gap-2 h-14 text-lg" onClick={completeSet}><Check size={20} />完成本组</button>
              <button type="button" className="btn btn-ghost btn-outline flex-1 font-semibold gap-2 h-14 text-lg" onClick={() => { handleToggleSet(ex.tier, setIdx); closeSetCard(); }}><SkipForward size={20} />跳过</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ REST TIMER CARD ============
  const renderRestCard = () => {
    if (!showRestCard) return null;
    const progressValue = restTimer.total > 0 ? ((restTimer.total - restTimer.remaining) / restTimer.total) * 100 : 0;
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference * (1 - progressValue / 100);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex flex-col items-center gap-5 p-6">
            <span className="text-base font-semibold text-base-content/60">组间休息</span>

            <div className="relative flex items-center justify-center" style={{ width: '10rem', height: '10rem' }}>
              <svg className="absolute inset-0" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-base-300"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="text-orange-500 transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="flex flex-col items-center z-10">
                <span className="text-5xl font-bold font-mono text-base-content">{restTimer.remaining}</span>
                <span className="text-base text-base-content/40">秒</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <div className="flex gap-3 w-full">
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-12 text-base" onClick={() => addRestTime(-10)}>-10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-12 text-base" onClick={() => addRestTime(10)}>+10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-12 text-base" onClick={() => addRestTime(30)}><Plus size={18} />+30s</button>
              </div>
              <button type="button" className="btn btn-warning w-full font-bold gap-2 h-12 text-base" onClick={skipRest}><FastForward size={18} />跳过休息</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ EXERCISE LIST (fully expanded, no stack) ============
  const renderExerciseList = () => {
    const exercises = todayWorkout?.exercises || [];
    if (exercises.length === 0) return null;

    return (
      <div className="flex flex-col gap-4">
        {exercises.map((ex, exIdx) => {
          const tier = ex.tier || 'T1';
          const sets = sessionState.setsData[tier] || [];
          const completedCount = sets.filter(s => s.completed).length;
          const isFullyCompleted = completedCount === sets.length && sets.length > 0;

          const tierBadge = tier === 'T1' ? 'bg-primary/10 text-primary' : tier === 'T2' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent';
          const tierBorder = tier === 'T1' ? 'border-l-primary' : tier === 'T2' ? 'border-l-secondary' : 'border-l-accent';

          return (
            <div key={exIdx} className={`card bg-base-100 border border-base-300 border-l-4 ${tierBorder} shadow-sm transition-all duration-300 ${isFullyCompleted ? 'opacity-50' : ''}`}>
              <div className="card-body p-4 gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                    <span className="text-base font-bold text-base-content">{getExerciseCNName(ex.exercise)}</span>
                    <span className="text-sm font-mono font-bold text-base-content/40 bg-base-200 px-2 py-0.5 rounded">{ex.weight?.toFixed(1)}kg</span>
                  </div>
                  <span className="text-xs font-semibold text-base-content/40">{completedCount}/{sets.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {sets.map((set, setIdx) => {
                    const setKey = getSetKey(exIdx, setIdx);
                    const detail = setDetails[setKey] || {};
                    const isLastSet = setIdx === sets.length - 1;
                    return (
                      <button key={setIdx} type="button" className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200 text-left w-full ${set.completed ? 'border-green-500/30 bg-green-500/5' : isLastSet && !set.completed ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-200/30 hover:border-base-content/15'}`} onClick={() => openSetCard(exIdx, setIdx)}>
                        <div className="flex items-center gap-3">
                          {set.completed ? (
                            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center"><Check size={14} className="text-white" /></div>
                          ) : (
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${isLastSet ? 'border-primary' : 'border-base-300'}`}><span className="text-[10px] font-bold text-base-content/40">{set.set_number}</span></div>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-sm font-semibold ${set.completed ? 'text-base-content/30 line-through' : 'text-base-content'}`}>第 {set.set_number} 组</span>
                            <span className="text-xs text-base-content/30">目标: {set.planned_reps}次</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {detail.rpe !== undefined && <span className={`text-xs font-bold font-mono ${getRpeColor(detail.rpe)}`}>RPE {detail.rpe.toFixed(1)}</span>}
                          {['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(getRecordingMethod(ex.exercise)) && <span className="text-sm font-mono font-bold text-base-content/50">{set.weight_kg?.toFixed(1) || ex.weight?.toFixed(1)}kg</span>}
                          {set.completed && <span className="text-sm font-mono font-bold text-green-500">{set.actual_reps ?? set.planned_reps}次</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const progress = getProgress();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-200/95 backdrop-blur-lg max-w-[480px] w-full mx-auto overflow-hidden">
      {/* Navbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-b border-base-300">
        <button type="button" className="btn btn-ghost btn-sm text-base-content/60 hover:text-base-content gap-1" onClick={onMinimize}><Minimize2 size={16} /><span className="text-xs font-medium">缩小</span></button>
        <div className="text-sm font-bold text-base-content">实时训练中 ({currentDay})</div>
        <button type="button" className="btn btn-ghost btn-sm text-error hover:text-error gap-1" onClick={handleAbort}><X size={16} /><span className="text-xs font-medium">放弃</span></button>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 bg-base-100 border-b border-base-300">
        <div className="flex items-center gap-3">
          <progress className="progress progress-primary flex-1 h-2" value={progress} max="100" />
          <span className="text-xs font-bold font-mono text-base-content/50 w-10 text-right">{progress}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-28">
        {renderExerciseList()}
        {isSessionFinished() && (
          <div className="mt-2 animate-fadeIn">
            <button type="button" className="btn btn-success btn-lg btn-block text-success-content font-semibold gap-2 shadow-lg" onClick={() => onSave(setDetails)}><Sparkles size={18} />完成今日训练打卡</button>
          </div>
        )}
      </div>

      {renderSetCard()}
      {renderRestCard()}
    </div>
  );
}

export default TrainSession;
