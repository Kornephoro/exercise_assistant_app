import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_WEIGHTS } from './progression';
import { X, Loader2, Save, ShieldAlert } from 'lucide-react';

/**
 * 用户配置弹窗组件 (支持 T1/T2/T3重量和步长)
 * 
 * @param {Object} props
 * @param {Function} props.onClose 关闭并更新主页面的回调
 */
function SettingsModal({ onClose }) {
  // 1. 状态定义
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // 核心动作初始重量输入值
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

  // T3 辅助动作步长
  const [pullupT3Step, setPullupT3Step] = useState('2.5');
  const [abdominalT3Step, setAbdominalT3Step] = useState('2.5');
  const [bicepCurlT3Step, setBicepCurlT3Step] = useState('2.5');
  const [facePullT3Step, setFacePullT3Step] = useState('2.5');

  // ID 映射
  const [existingIds, setExistingIds] = useState({});
  const [existingProgressionIds, setExistingProgressionIds] = useState({});

  // 2. 加载配置数据
  useEffect(() => {
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

        // A. 解析初始重量
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

        // B. 解析进阶步长数据
        const progIds = {};
        const steps = {};
        const progressionData = progressionRes.data || [];
        progressionData.forEach(row => {
          const key = `${row.exercise}_${row.tier}`;
          progIds[key] = row.id;
          steps[key] = row.increment;
        });
        setExistingProgressionIds(progIds);

        // 核心动作 T1 / T2 步长
        setSquatT1Step(steps.squat_T1 !== undefined ? steps.squat_T1.toString() : '2.5');
        setSquatT2Step(steps.squat_T2 !== undefined ? steps.squat_T2.toString() : '2.5');
        setBenchT1Step(steps.bench_T1 !== undefined ? steps.bench_T1.toString() : '2.5');
        setBenchT2Step(steps.bench_T2 !== undefined ? steps.bench_T2.toString() : '2.5');
        setDeadliftT1Step(steps.deadlift_T1 !== undefined ? steps.deadlift_T1.toString() : '2.5');
        setDeadliftT2Step(steps.deadlift_T2 !== undefined ? steps.deadlift_T2.toString() : '2.5');
        setPressT1Step(steps.press_T1 !== undefined ? steps.press_T1.toString() : '2.5');
        setPressT2Step(steps.press_T2 !== undefined ? steps.press_T2.toString() : '2.5');

        // T3 辅助动作步长
        setPullupT3Step(steps.pullup_T3 !== undefined ? steps.pullup_T3.toString() : '2.5');
        setAbdominalT3Step(steps.abdominal_T3 !== undefined ? steps.abdominal_T3.toString() : '2.5');
        setBicepCurlT3Step(steps.bicep_curl_T3 !== undefined ? steps.bicep_curl_T3.toString() : '2.5');
        setFacePullT3Step(steps.face_pull_T3 !== undefined ? steps.face_pull_T3.toString() : '2.5');

      } catch (err) {
        console.error('加载动作配置失败：', err);
        setError('加载重量/步长配置失败：' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 3. 点击保存并执行 UPSERT
  const handleSaveSettings = async () => {
    const squatW = parseFloat(squatWeight);
    const benchW = parseFloat(benchWeight);
    const deadliftW = parseFloat(deadliftWeight);
    const pressW = parseFloat(pressWeight);

    // A. 校验初始重量
    if (isNaN(squatW) || squatW <= 0 ||
        isNaN(benchW) || benchW <= 0 ||
        isNaN(deadliftW) || deadliftW <= 0 ||
        isNaN(pressW) || pressW <= 0) {
      setError('初始重量必须为大于 0 的有效数字');
      return;
    }

    // B. 校验步长 (限制最小值 0.5)
    const sqT1 = parseFloat(squatT1Step);
    const sqT2 = parseFloat(squatT2Step);
    const beT1 = parseFloat(benchT1Step);
    const beT2 = parseFloat(benchT2Step);
    const deT1 = parseFloat(deadliftT1Step);
    const deT2 = parseFloat(deadliftT2Step);
    const prT1 = parseFloat(pressT1Step);
    const prT2 = parseFloat(pressT2Step);
    
    // T3 步长校验
    const plT3 = parseFloat(pullupT3Step);
    const abT3 = parseFloat(abdominalT3Step);
    const bcT3 = parseFloat(bicepCurlT3Step);
    const fpT3 = parseFloat(facePullT3Step);

    const stepsList = [sqT1, sqT2, beT1, beT2, deT1, deT2, prT1, prT2, plT3, abT3, bcT3, fpT3];
    if (stepsList.some(val => isNaN(val) || val < 0.5)) {
      setError('进阶加重步长不能低于最小阀值 0.5kg，防止负数或零');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // C. user_settings 重量写入数组
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

      // D. exercise_progression_settings 步长写入数组 (含 T1, T2 以及 T3)
      const upsertProgressions = [
        // T1
        { exercise: 'squat', tier: 'T1', increment: sqT1 },
        { exercise: 'bench', tier: 'T1', increment: beT1 },
        { exercise: 'deadlift', tier: 'T1', increment: deT1 },
        { exercise: 'press', tier: 'T1', increment: prT1 },
        
        // T2
        { exercise: 'squat', tier: 'T2', increment: sqT2 },
        { exercise: 'bench', tier: 'T2', increment: beT2 },
        { exercise: 'deadlift', tier: 'T2', increment: deT2 },
        { exercise: 'press', tier: 'T2', increment: prT2 },

        // T3
        { exercise: 'pullup', tier: 'T3', increment: plT3 },
        { exercise: 'abdominal', tier: 'T3', increment: abT3 },
        { exercise: 'bicep_curl', tier: 'T3', increment: bcT3 },
        { exercise: 'face_pull', tier: 'T3', increment: fpT3 }
      ].map(item => {
        const key = `${item.exercise}_${item.tier}`;
        if (existingProgressionIds[key]) {
          item.id = existingProgressionIds[key];
        }
        return item;
      });

      // E. 发起并发写入，步长设定 onConflict: 'exercise,tier'
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

      onClose(true);

    } catch (err) {
      console.error('保存动作配置失败：', err);
      setError('保存配置失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Modal 头部 */}
        <div className="settings-header">
          <h2>系统配置</h2>
          <button type="button" className="close-btn" onClick={() => onClose(false)} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {/* 提示说明 */}
        <p className="settings-tip">
          1. <b>初始重量</b>：仅在无历史记录的首次训练时采用。<br />
          2. <b>进阶步长</b>：当训练成功（最后一组满计划次数/T3满25次）时增重的幅度。
        </p>

        {/* 错误提示 */}
        {error && (
          <div className="settings-error">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 加载中状态 */}
        {loading ? (
          <div className="settings-loading">
            <Loader2 className="spinner" />
            <p>正在读取云端配置...</p>
          </div>
        ) : (
          <div className="settings-form">
            
            {/* 版块 1：首训默认重量 */}
            <div className="settings-section">
              <h3 className="section-title">1. 首次训练默认重量 (kg)</h3>
              <div className="weights-grid">
                <div className="form-group">
                  <label htmlFor="w-squat">深蹲 (Squat)</label>
                  <div className="form-input-wrapper">
                    <input
                      id="w-squat"
                      type="number"
                      step="0.5"
                      value={squatWeight}
                      onChange={(e) => setSquatWeight(e.target.value)}
                    />
                    <span className="unit-label">kg</span>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="w-bench">卧推 (Bench)</label>
                  <div className="form-input-wrapper">
                    <input
                      id="w-bench"
                      type="number"
                      step="0.5"
                      value={benchWeight}
                      onChange={(e) => setBenchWeight(e.target.value)}
                    />
                    <span className="unit-label">kg</span>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="w-deadlift">硬拉 (Deadlift)</label>
                  <div className="form-input-wrapper">
                    <input
                      id="w-deadlift"
                      type="number"
                      step="0.5"
                      value={deadliftWeight}
                      onChange={(e) => setDeadliftWeight(e.target.value)}
                    />
                    <span className="unit-label">kg</span>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="w-press">推举 (Press)</label>
                  <div className="form-input-wrapper">
                    <input
                      id="w-press"
                      type="number"
                      step="0.5"
                      value={pressWeight}
                      onChange={(e) => setPressWeight(e.target.value)}
                    />
                    <span className="unit-label">kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 版块 2：核心动作 T1 / T2 步长 */}
            <div className="settings-section" style={{ marginTop: '10px' }}>
              <h3 className="section-title">2. 核心动作加重步长 (T1 & T2)</h3>
              
              {/* 深蹲 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">深蹲 (Squat)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T1</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={squatT1Step}
                      onChange={(e) => setSquatT1Step(e.target.value)}
                    />
                  </div>
                  <div className="step-field">
                    <span>T2</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={squatT2Step}
                      onChange={(e) => setSquatT2Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 卧推 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">卧推 (Bench)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T1</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={benchT1Step}
                      onChange={(e) => setBenchT1Step(e.target.value)}
                    />
                  </div>
                  <div className="step-field">
                    <span>T2</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={benchT2Step}
                      onChange={(e) => setBenchT2Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 硬拉 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">硬拉 (Deadlift)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T1</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={deadliftT1Step}
                      onChange={(e) => setDeadliftT1Step(e.target.value)}
                    />
                  </div>
                  <div className="step-field">
                    <span>T2</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={deadliftT2Step}
                      onChange={(e) => setDeadliftT2Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 推举 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">推举 (Press)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T1</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={pressT1Step}
                      onChange={(e) => setPressT1Step(e.target.value)}
                    />
                  </div>
                  <div className="step-field">
                    <span>T2</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={pressT2Step}
                      onChange={(e) => setPressT2Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 版块 3：辅助动作 T3 步长 */}
            <div className="settings-section" style={{ marginTop: '10px' }}>
              <h3 className="section-title">3. 辅助动作加重步长 (T3)</h3>
              
              {/* 引体 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">引体向上 (Pull-up)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T3</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={pullupT3Step}
                      onChange={(e) => setPullupT3Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 悬垂举腿 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">悬垂举腿/腹部 (Abdominal)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T3</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={abdominalT3Step}
                      onChange={(e) => setAbdominalT3Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 弯举 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">二头肌弯举 (Bicep Curl)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T3</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={bicepCurlT3Step}
                      onChange={(e) => setBicepCurlT3Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 面拉 */}
              <div className="exercise-step-row">
                <span className="exercise-step-name">面拉 (Face Pull)</span>
                <div className="steps-inputs">
                  <div className="step-field">
                    <span>T3</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={facePullT3Step}
                      onChange={(e) => setFacePullT3Step(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 保存 */}
            <button
              type="button"
              className="btn-primary settings-save-btn"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="spinner" style={{ width: 18, height: 18 }} />
                  <span>正在保存...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>保存设置</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsModal;
