import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, ArrowLeft, Save } from 'lucide-react';

function ProgramConfigScreen({ program, exercisesMap, onBack, onActivated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const config = program.config || {};
  const defaultWeights = config.default_weights || {};
  const defaultIncrements = config.default_increment || {};

  // 收集所有涉及的动作
  const allExercises = new Set();
  if (config.day_map) {
    Object.values(config.day_map).forEach(day => {
      if (Array.isArray(day)) {
        day.forEach(e => allExercises.add(e.exercise));
      } else {
        if (day.T1) allExercises.add(day.T1);
        if (day.T2) allExercises.add(day.T2);
        if (day.T3) (day.T3 || []).forEach(e => allExercises.add(e));
      }
    });
  }

  // 用户自定义配置
  const [exerciseConfig, setExerciseConfig] = useState(() => {
    const init = {};
    allExercises.forEach(ex => {
      init[ex] = {
        initial_weight: defaultWeights[ex] ?? 20,
        increment: typeof defaultIncrements === 'object' && !Array.isArray(defaultIncrements)
          ? (defaultIncrements[Object.keys(defaultIncrements)[0]] ?? 2.5)
          : 2.5
      };
    });
    return init;
  });

  // 训练日程
  const [trainingDays, setTrainingDays] = useState(() => {
    const saved = localStorage.getItem('training_days');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return ['Monday', 'Wednesday', 'Friday', 'Saturday'];
  });

  const weekdays = [
    { key: 'Monday', label: '一' }, { key: 'Tuesday', label: '二' },
    { key: 'Wednesday', label: '三' }, { key: 'Thursday', label: '四' },
    { key: 'Friday', label: '五' }, { key: 'Saturday', label: '六' },
    { key: 'Sunday', label: '日' },
  ];

  const toggleDay = (day) => {
    setTrainingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const updateWeight = (ex, value) => {
    setExerciseConfig(prev => ({
      ...prev,
      [ex]: { ...prev[ex], initial_weight: value === '' ? '' : parseFloat(value) }
    }));
  };

  const updateIncrement = (ex, value) => {
    setExerciseConfig(prev => ({
      ...prev,
      [ex]: { ...prev[ex], increment: value === '' ? '' : parseFloat(value) }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 确定初始训练日
      const dayKeys = config.day_map ? Object.keys(config.day_map) : ['A'];
      const initialState = { current_day: dayKeys[0] };
      if (config.engine_type === 'gzclp') {
        initialState.scheme_index = {};
      }
      if (config.engine_type === 'starting_strength') {
        initialState.last_workout = null;
        initialState.fail_counts = {};
      }

      const { error: insertErr } = await supabase.from('user_programs').insert([{
        program_id: program.id,
        is_active: true,
        program_state: initialState,
        exercise_config: exerciseConfig,
        schedule: { training_days: trainingDays }
      }]);

      if (insertErr) throw insertErr;

      localStorage.setItem('training_days', JSON.stringify(trainingDays));
      onActivated();
    } catch (err) {
      setError('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-circle btn-sm cursor-pointer" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 {program.name}</h3>
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <span>{error}</span>
        </div>
      )}

      {/* 训练日程 */}
      <div className="card flex flex-col gap-3">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">训练日程</h4>
        <div className="flex gap-2 justify-between">
          {weekdays.map(d => (
            <button key={d.key} type="button"
              className={`btn btn-sm h-10 w-10 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                trainingDays.includes(d.key)
                  ? 'btn-primary text-white shadow-md'
                  : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
              }`}
              onClick={() => toggleDay(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
          每周 {trainingDays.length} 天训练
        </p>
      </div>

      {/* 初始重量配置 */}
      <div className="card flex flex-col gap-4">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">首训默认重量 (kg)</h4>
        <div className="grid grid-cols-2 gap-3">
          {Array.from(allExercises).map(ex => (
            <div key={ex} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                {exercisesMap[ex]?.name_cn || ex}
              </label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-9 transition-colors">
                <input type="number" step="0.5"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={exerciseConfig[ex]?.initial_weight ?? ''}
                  onChange={(e) => updateWeight(ex, e.target.value)}
                />
                <span className="text-xs font-medium text-text-secondary/50 select-none">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 步长配置 */}
      <div className="card flex flex-col gap-4">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">进阶加重步长 (kg)</h4>
        <div className="grid grid-cols-2 gap-3">
          {Array.from(allExercises).map(ex => (
            <div key={ex} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                {exercisesMap[ex]?.name_cn || ex}
              </label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-9 transition-colors">
                <input type="number" step="0.5" min="0.5"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={exerciseConfig[ex]?.increment ?? ''}
                  onChange={(e) => updateIncrement(ex, e.target.value)}
                />
                <span className="text-xs font-medium text-text-secondary/50 select-none">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button"
        className="btn btn-primary btn-block btn-lg mt-2 mb-8 flex items-center justify-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 select-none font-bold"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? (
          <><Loader2 className="animate-spin" size={18} /><span>保存中...</span></>
        ) : (
          <><Save size={18} /><span>保存并开始训练</span></>
        )}
      </button>
    </div>
  );
}

export default ProgramConfigScreen;
