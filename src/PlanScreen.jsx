import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_WEIGHTS } from './progression';
import { Loader2, Save, ShieldAlert, Award, Compass, CheckCircle, Scale, Zap, Dumbbell } from 'lucide-react';

/**
 * 计划设定页面组件 - 用于配置四大动作的初始重量、进阶加重步长、以及 T3 辅助动作达标门槛总次数
 * 完全采用 Tailwind CSS + DaisyUI 组件进行重构，并遵循系统高级设计规范
 * 
 * @param {Object} props
 * @param {Function} props.onSettingsSaved 保存配置成功后通知父组件重新计算建议重量的回调
 */
function PlanScreen({ onSettingsSaved }) {
  // 1. 子选项卡切换 ('settings' | 'library')
  const [activeSubTab, setActiveSubTab] = useState('settings');

  // 2. 状态管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 动作初始重量输入值
  const [squatWeight, setSquatWeight] = useState('');
  const [benchWeight, setBenchWeight] = useState('');
  const [deadliftWeight, setDeadliftWeight] = useState('');
  const [pressWeight, setPressWeight] = useState('');
  
  // 核心动作步长 (T1 & T2)
  const [squatT1Step, setSquatT1Step] = useState('2.5');
  const [squatT2Step, setSquatT2Step] = useState('2.5');
  const [benchT1Step, setBenchT1Step] = useState('2.5');
  const [benchT2Step, setBenchT2Step] = useState('2.5');
  const [deadliftT1Step, setDeadliftT1Step] = useState('2.5');
  const [deadliftT2Step, setDeadliftT2Step] = useState('2.5');
  const [pressT1Step, setPressT1Step] = useState('2.5');
  const [pressT2Step, setPressT2Step] = useState('2.5');

  // T3 辅助动作步长 (increment)
  const [pullupT3Step, setPullupT3Step] = useState('2.5');
  const [abdominalT3Step, setAbdominalT3Step] = useState('2.5');
  const [bicepCurlT3Step, setBicepCurlT3Step] = useState('2.5');
  const [facePullT3Step, setFacePullT3Step] = useState('2.5');

  // T3 辅助动作达标总次数门槛 (target_reps)
  const [pullupT3Target, setPullupT3Target] = useState('25');
  const [abdominalT3Target, setAbdominalT3Target] = useState('25');
  const [bicepCurlT3Target, setBicepCurlT3Target] = useState('25');
  const [facePullT3Target, setFacePullT3Target] = useState('25');

  // 已有行 ID 映射，供防错 UPSERT
  const [existingIds, setExistingIds] = useState({});
  const [existingProgressionIds, setExistingProgressionIds] = useState({});

  // 3. 挂载加载
  useEffect(() => {
    if (activeSubTab === 'settings') {
      fetchSettings();
    }
  }, [activeSubTab]);

  // 从 Supabase 加载所有的初始重量和步长/门槛设置
  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const [weightsRes, progressionRes] = await Promise.all([
        supabase.from('user_settings').select('*'),
        supabase.from('exercise_progression_settings').select('*')
      ]);

      if (weightsRes.error) throw weightsRes.error;
      if (progressionRes.error) throw progressionRes.error;

      // A. 解析重量
      const ids = {};
      const weights = {};
      const weightsData = weightsRes.data || [];
      weightsData.forEach(row => {
        ids[row.exercise] = row.id;
        weights[row.exercise] = row.initial_weight;
      });
      setExistingIds(ids);

      setSquatWeight(weights.squat !== undefined ? weights.squat.toString() : INITIAL_WEIGHTS.squat.toString());
      setBenchWeight(weights.bench !== undefined ? weights.bench.toString() : INITIAL_WEIGHTS.bench.toString());
      setDeadliftWeight(weights.deadlift !== undefined ? weights.deadlift.toString() : INITIAL_WEIGHTS.deadlift.toString());
      setPressWeight(weights.press !== undefined ? weights.press.toString() : INITIAL_WEIGHTS.press.toString());

      // B. 解析步长和门槛次数
      const progIds = {};
      const steps = {};
      const targets = {};
      const progressionData = progressionRes.data || [];
      progressionData.forEach(row => {
        const key = `${row.exercise}_${row.tier}`;
        progIds[key] = row.id;
        steps[key] = row.increment;
        if (row.tier === 'T3') {
          targets[row.exercise] = row.target_reps;
        }
      });
      setExistingProgressionIds(progIds);

      // T1 / T2 步长
      setSquatT1Step(steps.squat_T1 !== undefined ? steps.squat_T1.toString() : '2.5');
      setSquatT2Step(steps.squat_T2 !== undefined ? steps.squat_T2.toString() : '2.5');
      setBenchT1Step(steps.bench_T1 !== undefined ? steps.bench_T1.toString() : '2.5');
      setBenchT2Step(steps.bench_T2 !== undefined ? steps.bench_T2.toString() : '2.5');
      setDeadliftT1Step(steps.deadlift_T1 !== undefined ? steps.deadlift_T1.toString() : '2.5');
      setDeadliftT2Step(steps.deadlift_T2 !== undefined ? steps.deadlift_T2.toString() : '2.5');
      setPressT1Step(steps.press_T1 !== undefined ? steps.press_T1.toString() : '2.5');
      setPressT2Step(steps.press_T2 !== undefined ? steps.press_T2.toString() : '2.5');

      // T3 步长
      setPullupT3Step(steps.pullup_T3 !== undefined ? steps.pullup_T3.toString() : '2.5');
      setAbdominalT3Step(steps.abdominal_T3 !== undefined ? steps.abdominal_T3.toString() : '2.5');
      setBicepCurlT3Step(steps.bicep_curl_T3 !== undefined ? steps.bicep_curl_T3.toString() : '2.5');
      setFacePullT3Step(steps.face_pull_T3 !== undefined ? steps.face_pull_T3.toString() : '2.5');

      // T3 门槛次数
      setPullupT3Target(targets.pullup !== undefined && targets.pullup !== null ? targets.pullup.toString() : '25');
      setAbdominalT3Target(targets.abdominal !== undefined && targets.abdominal !== null ? targets.abdominal.toString() : '25');
      setBicepCurlT3Target(targets.bicep_curl !== undefined && targets.bicep_curl !== null ? targets.bicep_curl.toString() : '25');
      setFacePullT3Target(targets.face_pull !== undefined && targets.face_pull !== null ? targets.face_pull.toString() : '25');

    } catch (err) {
      console.error('加载动作配置失败：', err);
      setError('加载初始配置失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存设置并执行云端 UPSERT
  const handleSaveSettings = async () => {
    const squatW = parseFloat(squatWeight);
    const benchW = parseFloat(benchWeight);
    const deadliftW = parseFloat(deadliftWeight);
    const pressW = parseFloat(pressWeight);

    // 重量校验
    if (isNaN(squatW) || squatW <= 0 ||
        isNaN(benchW) || benchW <= 0 ||
        isNaN(deadliftW) || deadliftW <= 0 ||
        isNaN(pressW) || pressW <= 0) {
      setError('初始重量必须为大于 0 的有效数字');
      setSuccessMsg(null);
      return;
    }

    // 步长校验 (限制最小值 0.5)
    const sqT1 = parseFloat(squatT1Step);
    const sqT2 = parseFloat(squatT2Step);
    const beT1 = parseFloat(benchT1Step);
    const beT2 = parseFloat(benchT2Step);
    const deT1 = parseFloat(deadliftT1Step);
    const deT2 = parseFloat(deadliftT2Step);
    const prT1 = parseFloat(pressT1Step);
    const prT2 = parseFloat(pressT2Step);
    
    const plT3 = parseFloat(pullupT3Step);
    const abT3 = parseFloat(abdominalT3Step);
    const bcT3 = parseFloat(bicepCurlT3Step);
    const fpT3 = parseFloat(facePullT3Step);

    const stepsList = [sqT1, sqT2, beT1, beT2, deT1, deT2, prT1, prT2, plT3, abT3, bcT3, fpT3];
    if (stepsList.some(val => isNaN(val) || val < 0.5)) {
      setError('进阶加重步长不能低于最小阀值 0.5kg');
      setSuccessMsg(null);
      return;
    }

    // T3 门槛次数校验 (限制最小值 5 次)
    const plT3T = parseInt(pullupT3Target, 10);
    const abT3T = parseInt(abdominalT3Target, 10);
    const bcT3T = parseInt(bicepCurlT3Target, 10);
    const fpT3T = parseInt(facePullT3Target, 10);

    if (isNaN(plT3T) || plT3T < 5 ||
        isNaN(abT3T) || abT3T < 5 ||
        isNaN(bcT3T) || bcT3T < 5 ||
        isNaN(fpT3T) || fpT3T < 5) {
      setError('T3 动作进阶达标门槛总次数不能低于 5 次');
      setSuccessMsg(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // 重量 UPSERT 数组
      const upsertWeights = [
        { exercise: 'squat', initial_weight: squatW },
        { exercise: 'bench', initial_weight: benchW },
        { exercise: 'deadlift', initial_weight: deadliftW },
        { exercise: 'press', initial_weight: pressW }
      ].map(item => {
        if (existingIds[item.exercise]) {
          item.id = existingIds[item.exercise];
        }
        return item;
      });

      // 步长及门槛 UPSERT 数组
      // 注意：T1/T2 对象绝对不能包含 target_reps，只有 T3 包含，以防止覆盖默认值
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
        if (existingProgressionIds[key]) {
          item.id = existingProgressionIds[key];
        }
        return item;
      });

      // 并发 upsert 写入
      const [weightsUpsertRes, progressionUpsertRes] = await Promise.all([
        supabase
          .from('user_settings')
          .upsert(upsertWeights, { onConflict: 'exercise' }),
        supabase
          .from('exercise_progression_settings')
          .upsert(upsertProgressions, { onConflict: 'exercise,tier' })
      ]);

      if (weightsUpsertRes.error) throw weightsUpsertRes.error;
      if (progressionUpsertRes.error) throw progressionUpsertRes.error;

      setSuccessMsg('系统配置保存成功！今日建议重量已同步刷新。');
      
      // 通知 App.jsx 重载今日训练方案
      if (onSettingsSaved) {
        onSettingsSaved();
      }

    } catch (err) {
      console.error('保存动作配置失败：', err);
      setError('保存配置失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      
      {/* 顶部标题 */}
      <div className="mb-1">
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">
          计划配置
        </h2>
      </div>

      {/* 顶部小标签 tabs */}
      <div className="tabs tabs-boxed bg-bg-card/80 dark:bg-bg-card-dark/80 backdrop-blur-md border border-border-card dark:border-border-card-dark p-1.5 mb-1">
        <button
          type="button"
          className={`tab flex-1 transition-all duration-200 py-2 text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'settings' 
              ? 'tab-active !bg-primary !text-white font-bold rounded-xl shadow-md' 
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
          }`}
          onClick={() => setActiveSubTab('settings')}
        >
          <Award size={14} />
          <span>配置设置</span>
        </button>
        <button
          type="button"
          className={`tab flex-1 transition-all duration-200 py-2 text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'library' 
              ? 'tab-active !bg-primary !text-white font-bold rounded-xl shadow-md' 
              : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
          }`}
          onClick={() => setActiveSubTab('library')}
        >
          <Compass size={14} />
          <span>动作库</span>
        </button>
      </div>

      {/* 选项卡内容区域 */}
      <div className="mt-1">
        {activeSubTab === 'settings' ? (
          <div className="flex flex-col gap-6">
            {/* 提示栏 */}
            <div className="alert-box text-sm leading-relaxed border-l-4 mb-4">
              1. <b>默认重量</b>：仅在无训练历史的首次打卡时作为基准。<br />
              2. <b>增重步长</b>：打卡成功时下一次加重的幅度。<br />
              3. <b>T3 达标门槛</b>：三组实际次数累加满足该目标时方可晋级加重。
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
                <ShieldAlert size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* 成功提示 */}
            {successMsg && (
              <div className="alert-box !border-success dark:!border-success bg-green-500/10 dark:bg-green-500/5 !text-success dark:!text-success flex items-center gap-2 text-sm border-l-4">
                <CheckCircle size={14} className="flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-3">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-sm font-semibold">读取云端配置中...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* 1. 重量设置 */}
                <div className="card">
                  <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
                    <Scale size={16} className="text-primary" />
                    <span>1. 首训默认重量</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark" htmlFor="p-squat">
                        深蹲 (Squat)
                      </label>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                        <input
                          id="p-squat"
                          type="number"
                          step="0.5"
                          className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={squatWeight}
                          onChange={(e) => setSquatWeight(e.target.value)}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark" htmlFor="p-bench">
                        卧推 (Bench)
                      </label>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                        <input
                          id="p-bench"
                          type="number"
                          step="0.5"
                          className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={benchWeight}
                          onChange={(e) => setBenchWeight(e.target.value)}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark" htmlFor="p-deadlift">
                        硬拉 (Deadlift)
                      </label>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                        <input
                          id="p-deadlift"
                          type="number"
                          step="0.5"
                          className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={deadliftWeight}
                          onChange={(e) => setDeadliftWeight(e.target.value)}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark" htmlFor="p-press">
                        推举 (Press)
                      </label>
                      <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 w-full transition-colors">
                        <input
                          id="p-press"
                          type="number"
                          step="0.5"
                          className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none text-right pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={pressWeight}
                          onChange={(e) => setPressWeight(e.target.value)}
                        />
                        <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 核心加重步长 */}
                <div className="card">
                  <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
                    <Zap size={16} className="text-primary" />
                    <span>2. 核心动作加重步长 (T1 & T2)</span>
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    {/* 深蹲 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">深蹲 (Squat)</span>
                      <div className="flex gap-3 justify-between sm:justify-end w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T1</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={squatT1Step}
                              onChange={(e) => setSquatT1Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T2</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={squatT2Step}
                              onChange={(e) => setSquatT2Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 卧推 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">卧推 (Bench)</span>
                      <div className="flex gap-3 justify-between sm:justify-end w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T1</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={benchT1Step}
                              onChange={(e) => setBenchT1Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T2</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={benchT2Step}
                              onChange={(e) => setBenchT2Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 硬拉 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">硬拉 (Deadlift)</span>
                      <div className="flex gap-3 justify-between sm:justify-end w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T1</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={deadliftT1Step}
                              onChange={(e) => setDeadliftT1Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T2</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={deadliftT2Step}
                              onChange={(e) => setDeadliftT2Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 推举 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">推举 (Press)</span>
                      <div className="flex gap-3 justify-between sm:justify-end w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T1</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={pressT1Step}
                              onChange={(e) => setPressT1Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                          <span className="badge bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T2</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-full sm:w-[90px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={pressT2Step}
                              onChange={(e) => setPressT2Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 辅助动作步长与达标门槛 */}
                <div className="card">
                  <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark mb-4 pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
                    <Dumbbell size={16} className="text-primary" />
                    <span>3. 辅助动作步长及达标门槛 (T3)</span>
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    {/* 引体向上 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T3</span>
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark">引体向上 (Pull-up)</span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">步长</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={pullupT3Step}
                              onChange={(e) => setPullupT3Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">达标</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="1"
                              min="5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={pullupT3Target}
                              onChange={(e) => setPullupT3Target(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 悬垂举腿 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T3</span>
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark">悬垂举腿/腹 (Abdominal)</span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">步长</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={abdominalT3Step}
                              onChange={(e) => setAbdominalT3Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">达标</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="1"
                              min="5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={abdominalT3Target}
                              onChange={(e) => setAbdominalT3Target(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 二头肌弯举 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T3</span>
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark">二头肌弯举 (Bicep)</span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">步长</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={bicepCurlT3Step}
                              onChange={(e) => setBicepCurlT3Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">达标</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="1"
                              min="5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={bicepCurlT3Target}
                              onChange={(e) => setBicepCurlT3Target(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 面拉 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border border-tier-t3/20 dark:border-tier-t3-dark/20 font-extrabold text-xs w-7 h-5 flex items-center justify-center rounded select-none">T3</span>
                        <span className="text-base font-bold text-text-main dark:text-text-main-dark">面拉 (Face Pull)</span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">步长</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={facePullT3Step}
                              onChange={(e) => setFacePullT3Step(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium whitespace-nowrap select-none">达标</span>
                          <div className="input input-bordered input-sm flex items-center gap-0.5 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus-within:border-primary px-2 w-[85px] h-9 transition-colors">
                            <input
                              type="number"
                              step="1"
                              min="5"
                              className="w-full bg-transparent font-mono font-semibold text-base text-text-main dark:text-text-main-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right pr-0.5"
                              value={facePullT3Target}
                              onChange={(e) => setFacePullT3Target(e.target.value)}
                            />
                            <span className="text-sm font-medium text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">次</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 保存设置按钮 */}
                <button
                  type="button"
                  className="btn btn-primary btn-block btn-lg mt-2 mb-8 flex items-center justify-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 select-none font-bold"
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>正在保存设定...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>保存设定配置</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 动作库占位 */
          <div className="card flex flex-col items-center justify-center text-center gap-3 min-h-[300px] animate-fadeIn opacity-70">
            <Compass size={40} className="text-text-secondary/40 dark:text-text-secondary-dark/40" />
            <p className="text-base font-bold text-text-main dark:text-text-main-dark">动作图表与教学库</p>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">即将推出，敬请期待！</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default PlanScreen;
