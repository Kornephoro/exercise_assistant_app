import { useState, useEffect, useRef, useCallback } from 'react';
import { Minimize2, X, Check, Sparkles, SkipForward, Plus, FastForward } from 'lucide-react';

const DEFAULT_REST_SECONDS = 90;

const TEMPO_PRESETS = [
  { label: '标准', values: [3, 1, 1, 0] },
  { label: '慢速离心', values: [4, 2, 1, 0] },
  { label: '爆发向心', values: [2, 0, 1, 0] },
  { label: '等长收缩', values: [3, 3, 1, 1] },
  { label: '自定义', values: null },
];

const TEMPO_LABELS = ['离心', '底部', '向心', '顶部'];

// ============ FIELD INPUT GROUP (hoisted outside) ============
const FieldInput = ({ kind, value, onChange, placeholder = '' }) => {
  const isInt = kind === 'reps' || kind === 'duration';
  const maxLen = { reps: 4, duration: 4, weight: 5, distance: 6 }[kind];
  return (
    <input
      type="text"
      inputMode={isInt ? 'numeric' : 'decimal'}
      pattern={isInt ? '[0-9]*' : undefined}
      maxLength={maxLen}
      placeholder={placeholder}
      className="input input-bordered text-center !text-center font-mono text-2xl font-bold w-full h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(isInt ? /\D/g : /[^\d.]/g, '');
        const cleaned = !isInt && raw.split('.').length > 2
          ? raw.slice(0, raw.lastIndexOf('.'))
          : raw;
        onChange(cleaned === '' ? '' : (isInt ? parseInt(cleaned, 10) : parseFloat(cleaned)));
      }}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onClick={(e) => e.target.select()}
      onTouchStart={(e) => e.target.select()}
      onPaste={(e) => {
        const raw = (e.clipboardData.getData('text') || '').replace(isInt ? /\D/g : /[^\d.]/g, '').slice(0, maxLen);
        e.preventDefault();
        onChange(raw === '' ? '' : (isInt ? parseInt(raw, 10) : parseFloat(raw)));
      }}
    />
  );
};

const FieldInputGroup = ({ fields, valueMap, onChangeMap, fieldLabel, placeholderMap = {} }) => {
  if (!fields || fields.length === 0) return null;
  return (
    <div className={fields.length === 1 ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-2.5'}>
      {fields.map((kind) => (
        <div key={kind} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-base-content/50">{fieldLabel[kind]}</label>
          <FieldInput kind={kind} value={valueMap[kind]} onChange={onChangeMap[kind]} placeholder={placeholderMap[kind] || ''} />
        </div>
      ))}
    </div>
  );
};

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
    remaining: DEFAULT_REST_SECONDS,
    endTime: null
  });

  const [setDetails, setSetDetails] = useState({});
  const [customRestSeconds, setCustomRestSeconds] = useState(DEFAULT_REST_SECONDS);

  // 移到上方避免 hoisting 问题
  const openSetCard = (exerciseIdx, setIdx) => { setFocusedSet({ exerciseIdx, setIdx }); setShowSetCard(true); };
  const closeSetCard = () => { setShowSetCard(false); setFocusedSet(null); };

  const adjustCustomRest = (delta) => {
    setCustomRestSeconds(prev => Math.max(0, prev + delta));
  };

  const audioContextRef = useRef(null);
  const restTimerRef = useRef(null);
  const swipeStartRef = useRef(null);

  // 用 Ref 维护定时器内部需要读取的易变状态，避免频繁重置定时器
  const timerStateRef = useRef({ focusedSet, exercises: todayWorkout?.exercises, setsData: sessionState.setsData });
  useEffect(() => {
    timerStateRef.current = { focusedSet, exercises: todayWorkout?.exercises, setsData: sessionState.setsData };
  }, [focusedSet, todayWorkout, sessionState.setsData]);

  // 全屏左滑手势 → 触发 onMinimize（非破坏性操作）
  const handleSwipeStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleSwipeEnd = (e) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const end = e.changedTouches?.[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    // 左滑 dx < -80px 且水平方向为主（|dx| > |dy|*1.5）
    if (dx < -80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onMinimize();
    }
  };

  const getRecordingMethod = (exerciseKey) => exercisesMap?.[exerciseKey]?.recording_method || 'standard';

  const getTotalSets = () => (todayWorkout?.exercises || []).reduce((sum, ex, idx) => sum + (sessionState.setsData[idx]?.length || 0), 0);
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
    } catch { /* ignore */ }
  }, []);

  const playRestEndSound = useCallback(() => {
    playBeep(600, 150);
    setTimeout(() => playBeep(800, 150), 200);
    setTimeout(() => playBeep(1000, 200), 400);
  }, [playBeep]);

  useEffect(() => {
    if (restTimer.active && restTimer.endTime) {
      restTimerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.round((restTimer.endTime - now) / 1000));

        setRestTimer(prev => {
          if (diff <= 0) { 
            clearInterval(restTimerRef.current); 
            playRestEndSound(); 
            setShowRestCard(false);
            
            // 自动打开下一组
            const currentFocused = timerStateRef.current.focusedSet;
            const currentExercises = timerStateRef.current.exercises;
            const currentSetsData = timerStateRef.current.setsData;
            if (currentFocused && currentExercises && currentSetsData) {
              const { exerciseIdx, setIdx } = currentFocused;
              const totalSets = currentSetsData[exerciseIdx].length;
              if (setIdx === totalSets - 1 && exerciseIdx < currentExercises.length - 1) {
                openSetCard(exerciseIdx + 1, 0);
              } else if (setIdx < totalSets - 1) {
                openSetCard(exerciseIdx, setIdx + 1);
              }
            }
            return { ...prev, active: false, remaining: 0, endTime: null }; 
          }
          return { ...prev, remaining: diff };
        });
      }, 1000);
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [restTimer.active, restTimer.endTime, playRestEndSound]);

  const handleToggleSet = (exIndex, setIndex) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          const completed = !set.completed;
          const actual_reps = (completed && (set.actual_reps === '' || set.actual_reps === undefined))
            ? set.planned_reps
            : set.actual_reps;
          return { ...set, completed, actual_reps };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleRepsChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, actual_reps: value === '' ? '' : parseInt(value, 10) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleWeightChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, weight_kg: value === '' ? 0 : parseFloat(value) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleDurationChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, duration_seconds: value === '' ? 0 : parseInt(value, 10) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const handleDistanceChange = (exIndex, setIndex, value) => {
    setSessionState(prev => {
      const nextSets = (prev.setsData[exIndex] || []).map((set, sIdx) => {
        if (sIdx === setIndex) {
          return { ...set, distance_meters: value === '' ? 0 : parseFloat(value) };
        }
        return set;
      });
      return {
        ...prev,
        setsData: { ...prev.setsData, [exIndex]: nextSets }
      };
    });
  };

  const completeSet = () => {
    if (!focusedSet) return;
    const { exerciseIdx, setIdx } = focusedSet;
    handleToggleSet(exerciseIdx, setIdx);
    closeSetCard();

    // 解决异步状态更新滞后问题：提前预测并计算完成状态
    const targetSet = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!targetSet) return;
    const willBeCompleted = !targetSet.completed; // 点击后的新状态

    let completedCount = 0;
    let totalCount = 0;
    Object.keys(sessionState.setsData).forEach(exKey => {
      const sets = sessionState.setsData[exKey] || [];
      totalCount += sets.length;
      sets.forEach((set, sIdx) => {
        const isCurrent = Number(exKey) === exerciseIdx && sIdx === setIdx;
        const isCompleted = isCurrent ? willBeCompleted : set.completed;
        if (isCompleted) completedCount++;
      });
    });

    const isSessionFinishedNew = totalCount > 0 && completedCount === totalCount;
    const totalSets = sessionState.setsData[exerciseIdx].length;
    const isLastExercise = exerciseIdx === todayWorkout.exercises.length - 1;
    const isLastSet = setIdx === totalSets - 1;

    if (!(isSessionFinishedNew || (isLastSet && isLastExercise))) {
      setRestTimer({
        active: true,
        total: customRestSeconds,
        remaining: customRestSeconds,
        endTime: Date.now() + customRestSeconds * 1000
      });
      setShowRestCard(true);
    }
  };

  const skipRest = () => {
    setShowRestCard(false);
    setRestTimer({
      active: false,
      total: DEFAULT_REST_SECONDS,
      remaining: DEFAULT_REST_SECONDS,
      endTime: null
    });
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (focusedSet) {
      const { exerciseIdx, setIdx } = focusedSet;
      const totalSets = sessionState.setsData[exerciseIdx].length;
      if (setIdx === totalSets - 1 && exerciseIdx < todayWorkout.exercises.length - 1) openSetCard(exerciseIdx + 1, 0);
      else if (setIdx < totalSets - 1) openSetCard(exerciseIdx, setIdx + 1);
    }
  };

  const addRestTime = (seconds) => {
    setRestTimer(prev => {
      const nextRemaining = prev.remaining + seconds;
      const nextTotal = prev.total + seconds;
      const nextEndTime = prev.endTime ? prev.endTime + seconds * 1000 : null;
      return {
        ...prev,
        remaining: Math.max(0, nextRemaining),
        total: Math.max(0, nextTotal),
        endTime: nextEndTime
      };
    });
  };
  const updateSetDetail = (key, field, value) => setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const applyTempoPreset = (key, presetValues) => {
    if (presetValues) {
      setSetDetails(prev => ({ ...prev, [key]: { ...prev[key], tempo_eccentric: presetValues[0], tempo_pause_bottom: presetValues[1], tempo_concentric: presetValues[2], tempo_pause_top: presetValues[3] } }));
    }
  };

  const getRpeColor = (v) => v <= 4 ? 'text-green-500' : v <= 7 ? 'text-yellow-500' : 'text-red-500';
  const handleAbort = () => onCancel();

  // ============ FIELD INPUT GROUP (hoisted outside) ============

  // ============ SET DETAIL CARD (floating centered) ============
  const renderSetCard = () => {
    if (!showSetCard || !focusedSet) return null;
    const { exerciseIdx, setIdx } = focusedSet;
    const ex = todayWorkout.exercises[exerciseIdx];
    const set = sessionState.setsData[exerciseIdx]?.[setIdx];
    if (!set) return null;

    const method = getRecordingMethod(ex.exercise);
    const setKey = getSetKey(exerciseIdx, setIdx);
    const detail = setDetails[setKey] || {};
    const rpeValue = detail.rpe ?? 7;
    const totalSets = sessionState.setsData[exerciseIdx].length;

    const METHOD_CONFIG = {
      standard:           { summary: (s, ex) => `${s.planned_reps} 次 @ ${ex.weight?.toFixed(1)}kg`,    fields: ['reps', 'weight'],        showTempo: true  },
      reps_only:          { summary: (s)     => `${s.planned_reps} 次`,                                  fields: ['reps'],                  showTempo: true  },
      duration_only:      { summary: (s)     => `${s.planned_reps} 秒`,                                  fields: ['duration'],              showTempo: false },
      distance_only:      { summary: (s)     => `${s.planned_reps} 米`,                                  fields: ['distance'],              showTempo: false },
      loaded_carry:       { summary: (s, ex) => `${s.planned_reps}m @ ${ex.weight?.toFixed(1)}kg`,      fields: ['weight', 'distance'],    showTempo: false },
      bodyweight_added:   { summary: (s, ex) => `${s.planned_reps} 次 @ +${ex.weight?.toFixed(1)}kg`,  fields: ['reps', 'weight'],        showTempo: true  },
      bodyweight_assisted:{ summary: (s, ex) => `${s.planned_reps} 次 @ -${ex.weight?.toFixed(1)}kg`,  fields: ['reps', 'weight'],        showTempo: true  },
    };
    const config = METHOD_CONFIG[method] || METHOD_CONFIG.standard;

    const FIELD_LABEL = {
      reps:     '实际次数',
      weight:   method === 'bodyweight_added' ? '附加重量' : method === 'bodyweight_assisted' ? '辅助重量' : method === 'loaded_carry' ? '负重重量' : '实际重量',
      duration: '时长（秒）',
      distance: '距离（米）',
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={closeSetCard}>
        <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-3.5 flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-base-content/50">第 {set.set_number} 组 / 共 {totalSets} 组</span>
            </div>

            {/* Summary Line - Large Typography */}
            <div className="p-2.5 rounded-xl bg-base-200/50">
              <div className="text-xl font-bold text-base-content">
                {config.summary(set, ex)}
              </div>
              <div className="text-base font-semibold text-base-content/60 mt-0.5">
                RPE {set.planned_rpe ?? 7}
                {config.showTempo && <> | 节奏 {set.tempo ?? '3110'}</>}
                <> | 休息 {customRestSeconds}秒</>
              </div>
            </div>

            {/* Dynamic Input Area - method-aware */}
            <FieldInputGroup
              fields={config.fields}
              valueMap={{
                reps:     set.actual_reps,
                weight:   set.weight_kg ?? ex.weight,
                duration: set.duration_seconds,
                distance: set.distance_meters,
              }}
              onChangeMap={{
                reps:     (v) => handleRepsChange(exerciseIdx, setIdx, v),
                weight:   (v) => handleWeightChange(exerciseIdx, setIdx, v),
                duration: (v) => handleDurationChange(exerciseIdx, setIdx, v),
                distance: (v) => handleDistanceChange(exerciseIdx, setIdx, v),
              }}
              fieldLabel={FIELD_LABEL}
              placeholderMap={{
                reps: ex.amrap_last && (set.actual_reps === '' || set.actual_reps === undefined) ? 'AMRAP' : '',
              }}
            />

            <div className="divider my-0" />

            {/* RPE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-base-content/50">RPE</label>
                <span className={`text-2xl font-bold font-mono ${getRpeColor(rpeValue)}`}>{rpeValue.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="10" step="0.5" value={rpeValue} className="range range-primary w-full" onChange={(e) => updateSetDetail(setKey, 'rpe', parseFloat(e.target.value))} />
              <div className="flex justify-between px-1 text-[10px] text-base-content/30 font-mono"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
            </div>

            {/* Tempo: presets left, fields right - method-aware visibility */}
            {config.showTempo && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/50">动作节奏</label>
              <div className="flex gap-2.5 items-stretch">
                {/* 左侧：3 个预设按钮垂直排列，占 50%，均匀分布 */}
                <div className="flex-1 flex flex-col gap-1 justify-between">
                  {TEMPO_PRESETS.slice(0, 3).map((preset, idx) => (
                    <button key={idx} type="button" className={`btn btn-ghost h-6 min-h-0 px-2 text-xs w-full whitespace-nowrap rounded-full ${preset.values === null ? 'btn-outline' : ''}`} onClick={() => applyTempoPreset(setKey, preset.values)}>{preset.label}</button>
                  ))}
                </div>
                {/* 右侧：4 个输入框横向并排，占 50% */}
                <div className="flex-1 grid grid-cols-4 gap-1.5">
                  {TEMPO_LABELS.map((label, idx) => {
                    const fields = ['tempo_eccentric', 'tempo_pause_bottom', 'tempo_concentric', 'tempo_pause_top'];
                    const defaults = [3, 1, 1, 0];
                    return (
                      <div key={fields[idx]} className="flex flex-col gap-1 items-center">
                        <span className="text-[10px] text-base-content/40">{label}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]"
                          maxLength={1}
                          className="input input-bordered text-center !text-center font-mono font-bold w-full h-12 text-xl rounded-md px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={detail[fields[idx]] ?? defaults[idx]}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(-1);
                            const v = raw === '' ? defaults[idx] : Math.min(9, Math.max(0, parseInt(raw, 10)));
                            updateSetDetail(setKey, fields[idx], v);
                          }}
                          onBeforeInput={(e) => {
                            if (e.data && !/^[0-9]$/.test(e.data)) e.preventDefault();
                          }}
                          onKeyDown={(e) => {
                            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onFocus={(e) => {
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onClick={(e) => e.target.select()}
                          onTouchStart={(e) => e.target.select()}
                          onPaste={(e) => {
                            const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(-1);
                            e.preventDefault();
                            const v = pasted === '' ? defaults[idx] : Math.min(9, Math.max(0, parseInt(pasted, 10)));
                            updateSetDetail(setKey, fields[idx], v);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* 组间休息调整 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/50">组间休息（秒）</label>
              <div className="flex items-stretch gap-1.5">
                <button type="button" onClick={() => adjustCustomRest(-30)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-base-content/70 hover:text-error hover:border-error/50 active:scale-95"
                  aria-label="减少 30 秒"
                >-30s</button>
                <button type="button" onClick={() => adjustCustomRest(-10)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-base-content/70 hover:text-error hover:border-error/50 active:scale-95"
                  aria-label="减少 10 秒"
                >-10s</button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className="input input-bordered text-center !text-center font-mono text-2xl font-bold flex-1 h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={customRestSeconds}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setCustomRestSeconds(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                      setCustomRestSeconds(0);
                    }
                  }}
                  onFocus={(e) => requestAnimationFrame(() => e.target.select())}
                  onClick={(e) => e.target.select()}
                  onTouchStart={(e) => e.target.select()}
                  onPaste={(e) => {
                    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
                    e.preventDefault();
                    setCustomRestSeconds(pasted === '' ? 0 : parseInt(pasted, 10));
                  }}
                />
                <button type="button" onClick={() => adjustCustomRest(10)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-primary hover:bg-primary hover:text-primary-content hover:border-primary active:scale-95"
                  aria-label="增加 10 秒"
                >+10s</button>
                <button type="button" onClick={() => adjustCustomRest(30)}
                  className="btn btn-outline h-12 w-12 rounded-md font-bold text-sm text-primary hover:bg-primary hover:text-primary-content hover:border-primary active:scale-95"
                  aria-label="增加 30 秒"
                >+30s</button>
              </div>
            </div>

            {/* 备注/感受 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/50">备注/感受</label>
              <textarea
                className="textarea textarea-bordered w-full h-16 text-xs"
                placeholder="记录本组感受..."
                value={detail.notes || ''}
                onChange={(e) => updateSetDetail(setKey, 'notes', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-primary flex-1 font-bold gap-2 h-12 text-base" onClick={completeSet}><Check size={18} />完成本组</button>
              <button type="button" className="btn btn-ghost btn-outline flex-1 font-semibold gap-2 h-12 text-base" onClick={() => { handleToggleSet(exerciseIdx, setIdx); closeSetCard(); }}><SkipForward size={18} />跳过</button>
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
          <div className="flex flex-col items-center gap-4 p-5">
            <span className="text-sm font-semibold text-base-content/60">组间休息</span>

            <div className="relative flex items-center justify-center" style={{ width: '8rem', height: '8rem' }}>
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
                <span className="text-4xl font-bold font-mono text-base-content">{restTimer.remaining}</span>
                <span className="text-sm text-base-content/40">秒</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <div className="flex gap-2 w-full">
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(-10)}>-10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(10)}>+10s</button>
                <button type="button" className="btn btn-ghost btn-outline flex-1 font-bold gap-1 h-11 text-sm" onClick={() => addRestTime(30)}><Plus size={16} />+30s</button>
              </div>
              <button type="button" className="btn btn-warning w-full font-bold gap-2 h-11 text-sm" onClick={skipRest}><FastForward size={16} />跳过休息</button>
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
          const sets = sessionState.setsData[exIdx] || [];
          const completedCount = sets.filter(s => s.completed).length;
          const isFullyCompleted = completedCount === sets.length && sets.length > 0;

          const tierBadge = tier === 'T1' ? 'bg-primary/10 text-primary' : tier === 'T2' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent';
          const tierBorder = tier === 'T1' ? 'border-l-primary' : tier === 'T2' ? 'border-l-secondary' : 'border-l-accent';

          return (
            <div key={exIdx} className={`card bg-base-100 border border-base-300 border-l-4 ${tierBorder} shadow-sm transition-all duration-300 ${isFullyCompleted ? 'opacity-50' : ''}`}>
              <div className="card-body p-3.5 gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tierBadge} font-bold text-xs`}>{tier}</span>
                    <span className="text-sm font-bold text-base-content">{getExerciseCNName(ex.exercise)}</span>
                    <span className="text-xs font-mono font-bold text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded">{ex.weight?.toFixed(1)}kg</span>
                  </div>
                  <span className="text-[10px] font-semibold text-base-content/40">{completedCount}/{sets.length}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {sets.map((set, setIdx) => {
                    const setKey = getSetKey(exIdx, setIdx);
                    const detail = setDetails[setKey] || {};
                    const isLastSet = setIdx === sets.length - 1;
                    return (
                      <button key={setIdx} type="button" className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all duration-200 text-left w-full ${set.completed ? 'border-green-500/30 bg-green-500/5' : isLastSet && !set.completed ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-200/30 hover:border-base-content/15'}`} onClick={() => openSetCard(exIdx, setIdx)}>
                        <div className="flex items-center gap-2.5">
                          {set.completed ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"><Check size={12} className="text-white" /></div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLastSet ? 'border-primary' : 'border-base-300'}`}><span className="text-[9px] font-bold text-base-content/40">{set.set_number}</span></div>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-xs font-semibold ${set.completed ? 'text-base-content/30 line-through' : 'text-base-content'}`}>第 {set.set_number} 组</span>
                            <span className="text-[10px] text-base-content/30">目标: {set.planned_reps}次</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {detail.rpe !== undefined && <span className={`text-[10px] font-bold font-mono ${getRpeColor(detail.rpe)}`}>RPE {detail.rpe.toFixed(1)}</span>}
                          {['standard', 'bodyweight_added', 'bodyweight_assisted'].includes(getRecordingMethod(ex.exercise)) && <span className="text-xs font-mono font-bold text-base-content/50">{set.weight_kg?.toFixed(1) || ex.weight?.toFixed(1)}kg</span>}
                          {set.completed && <span className="text-xs font-mono font-bold text-green-500">{set.actual_reps ?? set.planned_reps}次</span>}
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
    <div className="fixed inset-0 z-50 flex flex-col bg-base-200/95 backdrop-blur-lg max-w-[480px] w-full mx-auto overflow-hidden"
         onTouchStart={handleSwipeStart}
         onTouchEnd={handleSwipeEnd}
    >
      {/* Navbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-base-100 border-b border-base-300">
        <button type="button" className="btn btn-ghost h-10 px-3 text-sm font-semibold text-base-content/70 hover:text-base-content gap-1.5 active:scale-95" onClick={onMinimize} aria-label="缩小训练窗口"><Minimize2 size={18} /><span>缩小</span></button>
        <div className="text-xs font-bold text-base-content pointer-events-none">实时训练中 ({currentDay})</div>
        <button type="button" className="btn btn-ghost h-10 px-3 text-sm font-semibold text-error hover:bg-error/10 gap-1.5 active:scale-95" onClick={handleAbort} aria-label="放弃训练"><X size={18} /><span>放弃</span></button>
      </div>

      {/* Progress */}
      <div className="px-4 py-1.5 bg-base-100 border-b border-base-300">
        <div className="flex items-center gap-3">
          <progress className="progress progress-primary flex-1 h-1.5" value={progress} max="100" />
          <span className="text-[10px] font-bold font-mono text-base-content/50 w-9 text-right">{progress}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 pb-24">
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
