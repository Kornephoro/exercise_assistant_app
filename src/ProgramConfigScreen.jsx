import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, ArrowLeft, Save, ShieldAlert, CheckCircle, Scale, Zap, Dumbbell } from 'lucide-react';

// ==================== GZCLP 完整配置 ====================

function GzclpConfig({ program, onBack, onActivated }) {
  const defaultWeights = program.config?.default_weights || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 初始重量
  const [squatWeight, setSquatWeight] = useState('');
  const [benchWeight, setBenchWeight] = useState('');
  const [deadliftWeight, setDeadliftWeight] = useState('');
  const [pressWeight, setPressWeight] = useState('');

  // T1 & T2 步长
  const [squatT1Step, setSquatT1Step] = useState('2.5');
  const [squatT2Step, setSquatT2Step] = useState('2.5');
  const [benchT1Step, setBenchT1Step] = useState('2.5');
  const [benchT2Step, setBenchT2Step] = useState('2.5');
  const [deadliftT1Step, setDeadliftT1Step] = useState('2.5');
  const [deadliftT2Step, setDeadliftT2Step] = useState('2.5');
  const [pressT1Step, setPressT1Step] = useState('2.5');
  const [pressT2Step, setPressT2Step] = useState('2.5');

  // T3 步长
  const [pullupT3Step, setPullupT3Step] = useState('2.5');
  const [abdominalT3Step, setAbdominalT3Step] = useState('2.5');
  const [bicepCurlT3Step, setBicepCurlT3Step] = useState('2.5');
  const [facePullT3Step, setFacePullT3Step] = useState('2.5');

  // T3 达标门槛
  const [pullupT3Target, setPullupT3Target] = useState('25');
  const [abdominalT3Target, setAbdominalT3Target] = useState('25');
  const [bicepCurlT3Target, setBicepCurlT3Target] = useState('25');
  const [facePullT3Target, setFacePullT3Target] = useState('25');

  // 已有行 ID
  const [existingIds, setExistingIds] = useState({});
  const [existingProgressionIds, setExistingProgressionIds] = useState({});

  // 训练日程
  const [trainingDays, setTrainingDays] = useState(() => {
    const saved = localStorage.getItem('training_days');
    if (saved) { try { return JSON.parse(saved); } catch (e) { /* ignore */ } }
    return ['Monday', 'Wednesday', 'Friday', 'Saturday'];
  });

  const weekdays = [
    { key: 'Monday', label: '一' }, { key: 'Tuesday', label: '二' },
    { key: 'Wednesday', label: '三' }, { key: 'Thursday', label: '四' },
    { key: 'Friday', label: '五' }, { key: 'Saturday', label: '六' },
    { key: 'Sunday', label: '日' },
  ];

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [weightsRes, progressionRes] = await Promise.all([
        supabase.from('user_settings').select('*'),
        supabase.from('exercise_progression_settings').select('*')
      ]);

      if (weightsRes.error) throw weightsRes.error;
      if (progressionRes.error) throw progressionRes.error;

      const ids = {};
      const weights = {};
      (weightsRes.data || []).forEach(row => {
        ids[row.exercise] = row.id;
        weights[row.exercise] = row.initial_weight;
      });
      setExistingIds(ids);

      setSquatWeight(weights.squat !== undefined ? weights.squat.toString() : (defaultWeights.squat ?? 40).toString());
      setBenchWeight(weights.bench !== undefined ? weights.bench.toString() : (defaultWeights.bench ?? 30).toString());
      setDeadliftWeight(weights.deadlift !== undefined ? weights.deadlift.toString() : (defaultWeights.deadlift ?? 50).toString());
      setPressWeight(weights.press !== undefined ? weights.press.toString() : (defaultWeights.press ?? 20).toString());

      const progIds = {};
      const steps = {};
      const targets = {};
      (progressionRes.data || []).forEach(row => {
        const key = `${row.exercise}_${row.tier}`;
        progIds[key] = row.id;
        steps[key] = row.increment;
        if (row.tier === 'T3') targets[row.exercise] = row.target_reps;
      });
      setExistingProgressionIds(progIds);

      setSquatT1Step(steps.squat_T1 !== undefined ? steps.squat_T1.toString() : '2.5');
      setSquatT2Step(steps.squat_T2 !== undefined ? steps.squat_T2.toString() : '2.5');
      setBenchT1Step(steps.bench_T1 !== undefined ? steps.bench_T1.toString() : '2.5');
      setBenchT2Step(steps.bench_T2 !== undefined ? steps.bench_T2.toString() : '2.5');
      setDeadliftT1Step(steps.deadlift_T1 !== undefined ? steps.deadlift_T1.toString() : '2.5');
      setDeadliftT2Step(steps.deadlift_T2 !== undefined ? steps.deadlift_T2.toString() : '2.5');
      setPressT1Step(steps.press_T1 !== undefined ? steps.press_T1.toString() : '2.5');
      setPressT2Step(steps.press_T2 !== undefined ? steps.press_T2.toString() : '2.5');

      setPullupT3Step(steps.pullup_T3 !== undefined ? steps.pullup_T3.toString() : '2.5');
      setAbdominalT3Step(steps.abdominal_T3 !== undefined ? steps.abdominal_T3.toString() : '2.5');
      setBicepCurlT3Step(steps.bicep_curl_T3 !== undefined ? steps.bicep_curl_T3.toString() : '2.5');
      setFacePullT3Step(steps.face_pull_T3 !== undefined ? steps.face_pull_T3.toString() : '2.5');

      setPullupT3Target(targets.pullup != null ? targets.pullup.toString() : '25');
      setAbdominalT3Target(targets.abdominal != null ? targets.abdominal.toString() : '25');
      setBicepCurlT3Target(targets.bicep_curl != null ? targets.bicep_curl.toString() : '25');
      setFacePullT3Target(targets.face_pull != null ? targets.face_pull.toString() : '25');
    } catch (err) {
      setError('加载初始配置失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const squatW = parseFloat(squatWeight);
    const benchW = parseFloat(benchWeight);
    const deadliftW = parseFloat(deadliftWeight);
    const pressW = parseFloat(pressWeight);

    if (isNaN(squatW) || squatW <= 0 || isNaN(benchW) || benchW <= 0 ||
        isNaN(deadliftW) || deadliftW <= 0 || isNaN(pressW) || pressW <= 0) {
      setError('初始重量必须为大于 0 的有效数字');
      setSuccessMsg(null);
      return;
    }

    const sqT1 = parseFloat(squatT1Step), sqT2 = parseFloat(squatT2Step);
    const beT1 = parseFloat(benchT1Step), beT2 = parseFloat(benchT2Step);
    const deT1 = parseFloat(deadliftT1Step), deT2 = parseFloat(deadliftT2Step);
    const prT1 = parseFloat(pressT1Step), prT2 = parseFloat(pressT2Step);
    const plT3 = parseFloat(pullupT3Step), abT3 = parseFloat(abdominalT3Step);
    const bcT3 = parseFloat(bicepCurlT3Step), fpT3 = parseFloat(facePullT3Step);

    if ([sqT1, sqT2, beT1, beT2, deT1, deT2, prT1, prT2, plT3, abT3, bcT3, fpT3].some(v => isNaN(v) || v < 0.5)) {
      setError('进阶加重步长不能低于最小阀值 0.5kg');
      setSuccessMsg(null);
      return;
    }

    const plT3T = parseInt(pullupT3Target, 10), abT3T = parseInt(abdominalT3Target, 10);
    const bcT3T = parseInt(bicepCurlT3Target, 10), fpT3T = parseInt(facePullT3Target, 10);

    if ([plT3T, abT3T, bcT3T, fpT3T].some(v => isNaN(v) || v < 5)) {
      setError('T3 动作进阶达标门槛总次数不能低于 5 次');
      setSuccessMsg(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const upsertWeights = [
        { exercise: 'squat', initial_weight: squatW },
        { exercise: 'bench', initial_weight: benchW },
        { exercise: 'deadlift', initial_weight: deadliftW },
        { exercise: 'press', initial_weight: pressW }
      ].map(item => {
        if (existingIds[item.exercise]) item.id = existingIds[item.exercise];
        return item;
      });

      const upsertProgressions = [
        { exercise: 'squat', tier: 'T1', increment: sqT1 },
        { exercise: 'bench', tier: 'T1', increment: beT1 },
        { exercise: 'deadlift', tier: 'T1', increment: deT1 },
        { exercise: 'press', tier: 'T1', increment: prT1 },
        { exercise: 'squat', tier: 'T2', increment: sqT2 },
        { exercise: 'bench', tier: 'T2', increment: beT2 },
        { exercise: 'deadlift', tier: 'T2', increment: deT2 },
        { exercise: 'press', tier: 'T2', increment: prT2 },
        { exercise: 'pullup', tier: 'T3', increment: plT3, target_reps: plT3T },
        { exercise: 'abdominal', tier: 'T3', increment: abT3, target_reps: abT3T },
        { exercise: 'bicep_curl', tier: 'T3', increment: bcT3, target_reps: bcT3T },
        { exercise: 'face_pull', tier: 'T3', increment: fpT3, target_reps: fpT3T }
      ].map(item => {
        const key = `${item.exercise}_${item.tier}`;
        if (existingProgressionIds[key]) item.id = existingProgressionIds[key];
        return item;
      });

      const [wRes, pRes] = await Promise.all([
        supabase.from('user_settings').upsert(upsertWeights, { onConflict: 'exercise' }),
        supabase.from('exercise_progression_settings').upsert(upsertProgressions, { onConflict: 'exercise,tier' })
      ]);

      if (wRes.error) throw wRes.error;
      if (pRes.error) throw pRes.error;

      // 同时创建 user_programs 记录（如果不存在）
      const { data: existingUP } = await supabase.from('user_programs')
        .select('id').eq('program_id', program.id).eq('is_active', true).limit(1);

      if (!existingUP || existingUP.length === 0) {
        const dayMap = program.config?.day_map || {};
        const dayKeys = Object.keys(dayMap);
        await supabase.from('user_programs').insert([{
          program_id: program.id,
          is_active: true,
          program_state: { current_day: dayKeys[0] || 'Day1', scheme_index: {} },
          exercise_config: {},
          schedule: { training_days: trainingDays }
        }]);
      }

      localStorage.setItem('training_days', JSON.stringify(trainingDays));
      setSuccessMsg('配置保存成功！今日建议重量已同步刷新。');
      if (onActivated) onActivated();
    } catch (err) {
      setError('保存配置失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm font-semibold">读取云端配置中...</p>
      </div>
    );
  }

  const inputClass = "w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-circle btn-sm cursor-pointer" onClick={onBack}>←</button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 GZCLP</h3>
      </div>

      <div className="alert-box text-sm leading-relaxed border-l-4 mb-4">
        1. <b>默认重量</b>：仅在无训练历史的首次打卡时作为基准。<br />
        2. <b>增重步长</b>：打卡成功时下一次加重的幅度。<br />
        3. <b>T3 达标门槛</b>：三组实际次数累加满足该目标时方可晋级加重。
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <ShieldAlert size={14} className="flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert-box !border-success dark:!border-success bg-green-500/10 dark:bg-green-500/5 !text-success dark:!text-success flex items-center gap-2 text-sm border-l-4">
          <CheckCircle size={14} className="flex-shrink-0" /><span>{successMsg}</span>
        </div>
      )}

      {/* 训练日程 */}
      <div className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-2 pb-2 border-b border-border-card dark:border-border-card-dark select-none">训练日程</h3>
        <div className="flex gap-2 justify-between">
          {weekdays.map(d => (
            <button key={d.key} type="button"
              className={`btn btn-sm h-10 w-10 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                trainingDays.includes(d.key) ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
              }`}
              onClick={() => setTrainingDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
            >{d.label}</button>
          ))}
        </div>
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">每周 {trainingDays.length} 天训练</p>
      </div>

      {/* 1. 重量设置 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Scale size={16} className="text-primary" /><span>1. 首训默认重量</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[['squat', '深蹲 (Squat)', squatWeight, setSquatWeight],
            ['bench', '卧推 (Bench)', benchWeight, setBenchWeight],
            ['deadlift', '硬拉 (Deadlift)', deadliftWeight, setDeadliftWeight],
            ['press', '推举 (Press)', pressWeight, setPressWeight]
          ].map(([key, label, val, setter]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">{label}</label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                <input type="number" step="0.5" className={inputClass} value={val} onChange={(e) => setter(e.target.value)} />
                <span className="text-sm font-medium text-text-secondary/50 select-none">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. T1 & T2 步长 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Zap size={16} className="text-primary" /><span>2. 核心动作加重步长 (T1 & T2)</span>
        </h3>
        <div className="flex flex-col gap-3">
          {[['深蹲 (Squat)', squatT1Step, setSquatT1Step, squatT2Step, setSquatT2Step],
            ['卧推 (Bench)', benchT1Step, setBenchT1Step, benchT2Step, setBenchT2Step],
            ['硬拉 (Deadlift)', deadliftT1Step, setDeadliftT1Step, deadliftT2Step, setDeadliftT2Step],
            ['推举 (Press)', pressT1Step, setPressT1Step, pressT2Step, setPressT2Step]
          ].map(([label, t1Val, t1Set, t2Val, t2Set]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">{label}</span>
              <div className="flex gap-3 justify-between sm:justify-end w-full sm:w-auto">
                <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                  <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T1</span>
                  <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                    <input type="number" step="0.5" min="0.5" className={inputClass} value={t1Val} onChange={(e) => t1Set(e.target.value)} />
                    <span className="text-sm font-medium text-text-secondary/50 select-none">kg</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                  <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T2</span>
                  <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                    <input type="number" step="0.5" min="0.5" className={inputClass} value={t2Val} onChange={(e) => t2Set(e.target.value)} />
                    <span className="text-sm font-medium text-text-secondary/50 select-none">kg</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. T3 步长 + 门槛 */}
      <div className="card">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Dumbbell size={16} className="text-primary" /><span>3. 辅助动作步长及达标门槛 (T3)</span>
        </h3>
        <div className="flex flex-col gap-3">
          {[['引体向上 (Pull-up)', pullupT3Step, setPullupT3Step, pullupT3Target, setPullupT3Target],
            ['悬垂举腿/腹 (Abdominal)', abdominalT3Step, setAbdominalT3Step, abdominalT3Target, setAbdominalT3Target],
            ['二头肌弯举 (Bicep)', bicepCurlT3Step, setBicepCurlT3Step, bicepCurlT3Target, setBicepCurlT3Target],
            ['面拉 (Face Pull)', facePullT3Step, setFacePullT3Step, facePullT3Target, setFacePullT3Target]
          ].map(([label, stepVal, stepSet, targetVal, targetSet]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
              <div className="flex items-center gap-2">
                <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T3</span>
                <span className="text-base font-bold text-text-main dark:text-text-main-dark">{label}</span>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">步长</span>
                  <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                    <input type="number" step="0.5" min="0.5" className={inputClass} value={stepVal} onChange={(e) => stepSet(e.target.value)} />
                    <span className="text-sm font-medium text-text-secondary/50 select-none">kg</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">达标</span>
                  <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                    <input type="number" step="1" min="5" className={inputClass} value={targetVal} onChange={(e) => targetSet(e.target.value)} />
                    <span className="text-sm font-medium text-text-secondary/50 select-none">次</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button"
        className="btn btn-primary btn-block btn-lg mt-2 mb-8 flex items-center justify-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 select-none font-bold"
        onClick={handleSave} disabled={saving}
      >
        {saving
          ? <><Loader2 className="animate-spin" size={18} /><span>正在保存设定...</span></>
          : <><Save size={18} /><span>保存设定配置</span></>}
      </button>
    </div>
  );
}

// ==================== 通用配置（其他计划） ====================

function GenericConfig({ program, exercisesMap, onBack, onActivated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const config = program.config || {};
  const defaultWeights = config.default_weights || {};
  const defaultIncrements = config.default_increment || {};

  const allExercises = new Set();
  if (config.day_map) {
    Object.values(config.day_map).forEach(day => {
      if (Array.isArray(day)) day.forEach(e => allExercises.add(e.exercise));
      else {
        if (day.T1) allExercises.add(day.T1);
        if (day.T2) allExercises.add(day.T2);
        if (day.T3) (day.T3 || []).forEach(e => allExercises.add(e));
      }
    });
  }

  const [exerciseConfig, setExerciseConfig] = useState(() => {
    const init = {};
    allExercises.forEach(ex => {
      const defaultIncr = typeof defaultIncrements === 'object'
        ? (defaultIncrements[Object.keys(defaultIncrements)[0]] ?? 2.5)
        : (defaultIncrements ?? 2.5);
      init[ex] = { initial_weight: defaultWeights[ex] ?? 20, increment: defaultIncr };
    });
    return init;
  });

  const [trainingDays, setTrainingDays] = useState(() => {
    const saved = localStorage.getItem('training_days');
    if (saved) { try { return JSON.parse(saved); } catch (e) { /* ignore */ } }
    return ['Monday', 'Wednesday', 'Friday', 'Saturday'];
  });

  const weekdays = [
    { key: 'Monday', label: '一' }, { key: 'Tuesday', label: '二' },
    { key: 'Wednesday', label: '三' }, { key: 'Thursday', label: '四' },
    { key: 'Friday', label: '五' }, { key: 'Saturday', label: '六' },
    { key: 'Sunday', label: '日' },
  ];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dayKeys = config.day_map ? Object.keys(config.day_map) : ['A'];
      const initialState = { current_day: dayKeys[0] };

      const { error: insertErr } = await supabase.from('user_programs').insert([{
        program_id: program.id,
        is_active: true,
        program_state: initialState,
        exercise_config: exerciseConfig,
        schedule: { training_days: trainingDays }
      }]);
      if (insertErr) throw insertErr;

      localStorage.setItem('training_days', JSON.stringify(trainingDays));
      if (onActivated) onActivated();
    } catch (err) {
      setError('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-circle btn-sm cursor-pointer" onClick={onBack}>←</button>
        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">配置 {program.name}</h3>
      </div>

      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <span>{error}</span>
        </div>
      )}

      <div className="card flex flex-col gap-3">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">训练日程</h4>
        <div className="flex gap-2 justify-between">
          {weekdays.map(d => (
            <button key={d.key} type="button"
              className={`btn btn-sm h-10 w-10 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                trainingDays.includes(d.key) ? 'btn-primary text-white shadow-md' : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary'
              }`}
              onClick={() => setTrainingDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
            >{d.label}</button>
          ))}
        </div>
      </div>

      <div className="card flex flex-col gap-4">
        <h4 className="text-sm font-bold text-text-main dark:text-text-main-dark select-none">首训默认重量 (kg)</h4>
        <div className="grid grid-cols-2 gap-3">
          {Array.from(allExercises).map(ex => (
            <div key={ex} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">{exercisesMap[ex]?.name_cn || ex}</label>
              <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-2 h-9 transition-colors">
                <input type="number" step="0.5"
                  className="w-full bg-transparent font-mono font-semibold text-sm text-text-main dark:text-text-main-dark focus:outline-none text-right pr-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={exerciseConfig[ex]?.initial_weight ?? ''}
                  onChange={(e) => setExerciseConfig(prev => ({ ...prev, [ex]: { ...prev[ex], initial_weight: e.target.value === '' ? '' : parseFloat(e.target.value) } }))}
                />
                <span className="text-xs font-medium text-text-secondary/50 select-none">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button"
        className="btn btn-primary btn-block btn-lg mt-2 mb-8 flex items-center justify-center gap-2 shadow-lg font-bold"
        onClick={handleSave} disabled={saving}
      >
        {saving
          ? <><Loader2 className="animate-spin" size={18} /><span>保存中...</span></>
          : <><Save size={18} /><span>保存并开始训练</span></>}
      </button>
    </div>
  );
}

// ==================== 主入口 ====================

function ProgramConfigScreen({ program, exercisesMap, onBack, onActivated }) {
  const engineType = program.config?.engine_type;

  if (engineType === 'gzclp') {
    return <GzclpConfig program={program} onBack={onBack} onActivated={onActivated} />;
  }

  return <GenericConfig program={program} exercisesMap={exercisesMap} onBack={onBack} onActivated={onActivated} />;
}

export default ProgramConfigScreen;
