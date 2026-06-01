import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  Dumbbell, 
  User, 
  Activity, 
  Sliders, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Calculator, 
  HelpCircle,
  Sparkles,
  Calendar,
  Settings
} from 'lucide-react';

/**
 * OnboardingScreen 引导流程组件
 * @param {Object} props
 * @param {Function} props.onComplete 引导完成后的回调函数，参数为要跳转的 Tab
 * @param {Function} props.onSkip 跳过引导的回调函数
 */
function OnboardingScreen({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 表单状态定义
  // 步骤1：基本信息
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // 步骤2：训练背景
  const [trainingYears, setTrainingYears] = useState('0-1年');
  const [trainingLevel, setTrainingLevel] = useState('初学者');
  const [primaryGoal, setPrimaryGoal] = useState('提高力量');
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState(3);
  const [sessionDurationMin, setSessionDurationMin] = useState(60);

  // 步骤3：可用器械
  const [equipmentList, setEquipmentList] = useState(['barbell', 'dumbbell']);

  // 步骤4：力量基准 (1RM)
  const [squat1RM, setSquat1RM] = useState('');
  const [bench1RM, setBench1RM] = useState('');
  const [deadlift1RM, setDeadlift1RM] = useState('');
  const [press1RM, setPress1RM] = useState('');

  // 1RM 估算器状态
  const [showEstimator, setShowEstimator] = useState(false);
  const [estimatorWeight, setEstimatorWeight] = useState('');
  const [estimatorReps, setEstimatorReps] = useState('');
  const [estimated1RM, setEstimated1RM] = useState(0);
  const [estimatorTarget, setEstimatorTarget] = useState('squat');

  // 步骤5：日程设置
  const [trainingDays, setTrainingDays] = useState(['Monday', 'Wednesday', 'Friday']);

  // 常规星期英文和中文对照
  const WEEKDAYS = [
    { key: 'Monday', label: '周一' },
    { key: 'Tuesday', label: '周二' },
    { key: 'Wednesday', label: '周三' },
    { key: 'Thursday', label: '周四' },
    { key: 'Friday', label: '周五' },
    { key: 'Saturday', label: '周六' },
    { key: 'Sunday', label: '周日' }
  ];

  // 可用器械映射
  const EQUIPMENTS = [
    { key: 'barbell', label: '杠铃 (Barbell)' },
    { key: 'dumbbell', label: '哑铃 (Dumbbell)' },
    { key: 'cable', label: '龙门架/绳索 (Cable)' },
    { key: 'machine', label: '固定器械 (Machine)' },
    { key: 'kettlebell', label: '壶铃 (Kettlebell)' },
    { key: 'bodyweight', label: '自重 (Bodyweight)' }
  ];

  // 1RM 估算器公式： Epley formula: 1RM = w * (1 + r/30)
  const handleCalculate1RM = () => {
    const w = parseFloat(estimatorWeight);
    const r = parseInt(estimatorReps, 10);
    if (w > 0 && r > 0) {
      const result = Math.round(w * (1 + r / 30) * 10) / 10;
      setEstimated1RM(result);
    } else {
      setEstimated1RM(0);
    }
  };

  const applyEstimatedValue = () => {
    if (estimated1RM > 0) {
      if (estimatorTarget === 'squat') setSquat1RM(estimated1RM);
      if (estimatorTarget === 'bench') setBench1RM(estimated1RM);
      if (estimatorTarget === 'deadlift') setDeadlift1RM(estimated1RM);
      if (estimatorTarget === 'press') setPress1RM(estimated1RM);
      setShowEstimator(false);
      // 清空估算器
      setEstimatorWeight('');
      setEstimatorReps('');
      setEstimated1RM(0);
    }
  };

  // 切换器械多选
  const handleToggleEquipment = (eqKey) => {
    setEquipmentList(prev => 
      prev.includes(eqKey) ? prev.filter(k => k !== eqKey) : [...prev, eqKey]
    );
  };

  // 切换日程勾选
  const handleToggleDay = (dayKey) => {
    setTrainingDays(prev => {
      const nextDays = prev.includes(dayKey) ? prev.filter(k => k !== dayKey) : [...prev, dayKey];
      // 自动同步训练天数
      setTrainingDaysPerWeek(nextDays.length);
      return nextDays;
    });
  };

  // “练几休几”快捷日程生成
  const handleApplyPreset = (presetType) => {
    let days = [];
    if (presetType === '1-1') {
      // 练1休1 -> 周一、周三、周五、周日
      days = ['Monday', 'Wednesday', 'Friday', 'Sunday'];
    } else if (presetType === '2-1') {
      // 练2休1 -> 周一、周二、周四、周五、周日
      days = ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Sunday'];
    } else if (presetType === '3-1') {
      // 练3休1 -> 周一、周二、周三、周五、周六、周日
      days = ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'];
    } else if (presetType === '5-2') {
      // 练5休2 -> 周一、周二、周三、周四、周五
      days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    }
    setTrainingDays(days);
    setTrainingDaysPerWeek(days.length);
  };

  // 表单步骤跳转验证
  const handleNextStep = () => {
    if (currentStep === 1) {
      // 验证必填字段（昵称非必填）
      if (!gender || !age || !height || !weight) {
        setErrorMsg('请填写完整的性别、年龄、身高和体重信息');
        return;
      }
      if (parseInt(age, 10) <= 0 || parseFloat(height) <= 0 || parseFloat(weight) <= 0) {
        setErrorMsg('请填写正确的年龄、身高或体重数值');
        return;
      }
    }
    setErrorMsg(null);
    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setCurrentStep(prev => prev - 1);
  };

  // 提交保存画像到 Supabase
  const handleSaveProfile = async () => {
    if (trainingDays.length === 0) {
      setErrorMsg('请至少选择一个训练日日程');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      // 整理画像数据
      const profileData = {
        gender,
        age: age ? parseInt(age, 10) : null,
        height_cm: height ? parseFloat(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        training_years: trainingYears,
        training_level: trainingLevel,
        primary_goal: primaryGoal,
        training_days_per_week: parseInt(trainingDaysPerWeek, 10),
        session_duration_min: sessionDurationMin ? parseInt(sessionDurationMin, 10) : null,
        training_days: JSON.stringify(trainingDays),
        equipment: JSON.stringify(equipmentList),
        squat_1rm: squat1RM ? parseFloat(squat1RM) : null,
        bench_1rm: bench1RM ? parseFloat(bench1RM) : null,
        deadlift_1rm: deadlift1RM ? parseFloat(deadlift1RM) : null,
        press_1rm: press1RM ? parseFloat(press1RM) : null,
        limitations: null,
        updated_at: new Date().toISOString()
      };

      // 1. 查询 user_profiles 表是否存在记录
      const { data: existingProfiles, error: queryError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (queryError) throw queryError;

      let saveError;
      if (existingProfiles && existingProfiles.length > 0) {
        // 更新现有记录
        const targetId = existingProfiles[0].id;
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', targetId);
        saveError = updateError;
      } else {
        // 新增新记录 (不带 id 让数据库自增)
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([profileData]);
        saveError = insertError;
      }

      if (saveError) throw saveError;

      // 2. 将昵称存储在本地 localStorage
      if (nickname.trim()) {
        localStorage.setItem('user_nickname', nickname.trim());
      } else {
        localStorage.removeItem('user_nickname');
      }

      // 3. 设置引导完成标记
      localStorage.setItem('onboarding_completed', 'true');

      // 4. 调用完成回调并跳转到 Plan 页
      onComplete('plan');

    } catch (err) {
      console.error('保存画像数据失败：', err);
      setErrorMsg('保存画像数据失败，请检查网络：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 直接跳过引导
  const handleSkipOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onSkip();
  };

  // 渲染步骤指示器
  const renderProgress = () => {
    const stepsCount = 5;
    const progressPercent = (currentStep / stepsCount) * 100;
    return (
      <div className="onboarding-progress-bar-container">
        <div className="onboarding-progress-track">
          <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className="onboarding-step-indicator">
          <span>步骤 {currentStep} / {stepsCount}</span>
          <span className="step-name">
            {currentStep === 1 && '基本信息'}
            {currentStep === 2 && '训练背景'}
            {currentStep === 3 && '可用器械'}
            {currentStep === 4 && '力量基准'}
            {currentStep === 5 && '确认与日程'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding-overlay animate-fadeIn">
      <div className="onboarding-container">
        {/* 顶部标题区 */}
        <div className="onboarding-header">
          <div className="ob-logo">
            <Dumbbell size={24} />
            <span>训练画像引导</span>
          </div>
          <button 
            type="button" 
            className="ob-skip-btn" 
            onClick={handleSkipOnboarding}
            aria-label="跳过引导"
          >
            跳过
          </button>
        </div>

        {/* 进度条 */}
        {renderProgress()}

        {/* 错误提示 */}
        {errorMsg && (
          <div className="onboarding-error-box animate-fadeIn">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 表单视窗区 */}
        <div className="onboarding-step-content-box">
          
          {/* STEP 1: 基本信息 */}
          {currentStep === 1 && (
            <div className="ob-step-form animate-slideIn">
              <h3 className="ob-step-title"><User size={20} /> 告诉我们你的基本信息</h3>
              <p className="ob-step-subtitle">这些数据会作为本地参考存档，不影响系统推荐的建议重量。</p>
              
              <div className="ob-form-group">
                <label htmlFor="ob-nickname">昵称 (选填)</label>
                <input 
                  type="text" 
                  id="ob-nickname" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="怎么称呼你？"
                  maxLength={15}
                />
              </div>

              <div className="ob-form-group">
                <label>性别</label>
                <div className="ob-gender-select">
                  <button 
                    type="button" 
                    className={`gender-btn ${gender === 'male' ? 'active' : ''}`}
                    onClick={() => setGender('male')}
                  >
                    男 (Male)
                  </button>
                  <button 
                    type="button" 
                    className={`gender-btn ${gender === 'female' ? 'active' : ''}`}
                    onClick={() => setGender('female')}
                  >
                    女 (Female)
                  </button>
                  <button 
                    type="button" 
                    className={`gender-btn ${gender === 'other' ? 'active' : ''}`}
                    onClick={() => setGender('other')}
                  >
                    其他 (Other)
                  </button>
                </div>
              </div>

              <div className="ob-form-row">
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-age">年龄 (岁)</label>
                  <input 
                    type="number" 
                    id="ob-age" 
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-height">身高 (cm)</label>
                  <input 
                    type="number" 
                    id="ob-height" 
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                    min="50"
                    max="250"
                    required
                  />
                </div>
              </div>

              <div className="ob-form-group">
                <label htmlFor="ob-weight">当前体重 (kg)</label>
                <input 
                  type="number" 
                  id="ob-weight" 
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70.0"
                  step="0.1"
                  min="20"
                  max="300"
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 2: 训练背景 */}
          {currentStep === 2 && (
            <div className="ob-step-form animate-slideIn">
              <h3 className="ob-step-title"><Activity size={20} /> 选择你的训练背景</h3>
              <p className="ob-step-subtitle">定制你的健身侧写，辅助记录您的体能进化阶段。</p>
              
              <div className="ob-form-group">
                <label>训练年限</label>
                <div className="badge-selector-grid">
                  {['0-1年', '1-3年', '3-5年', '5年以上'].map(y => (
                    <button 
                      key={y}
                      type="button" 
                      className={`selector-badge-btn ${trainingYears === y ? 'active' : ''}`}
                      onClick={() => setTrainingYears(y)}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-form-group">
                <label>目前训练水平</label>
                <div className="badge-selector-grid">
                  {['初学者', '中级者', '高级者'].map(lvl => (
                    <button 
                      key={lvl}
                      type="button" 
                      className={`selector-badge-btn ${trainingLevel === lvl ? 'active' : ''}`}
                      onClick={() => setTrainingLevel(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-form-group">
                <label>主要训练目标</label>
                <div className="badge-selector-grid">
                  {['增肌', '减脂', '提高力量', '身体健康'].map(g => (
                    <button 
                      key={g}
                      type="button" 
                      className={`selector-badge-btn ${primaryGoal === g ? 'active' : ''}`}
                      onClick={() => setPrimaryGoal(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-form-row">
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-days-week">每周训练天数 (天)</label>
                  <input 
                    type="number" 
                    id="ob-days-week" 
                    value={trainingDaysPerWeek}
                    onChange={(e) => setTrainingDaysPerWeek(parseInt(e.target.value, 10) || '')}
                    min="1"
                    max="7"
                    disabled // 锁死通过日程设置勾选框决定
                    placeholder="由日程勾选决定"
                  />
                  <span className="ob-input-tip">在步骤5日程中勾选决定</span>
                </div>
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-duration">单次时长 (分钟)</label>
                  <input 
                    type="number" 
                    id="ob-duration" 
                    value={sessionDurationMin}
                    onChange={(e) => setSessionDurationMin(e.target.value)}
                    placeholder="60"
                    min="15"
                    max="180"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 可用器械 */}
          {currentStep === 3 && (
            <div className="ob-step-form animate-slideIn">
              <h3 className="ob-step-title"><Sliders size={20} /> 选择你的可用健身器械</h3>
              <p className="ob-step-subtitle">勾选你所处训练场馆中拥有的可用器械类别（多选，纯记录）。</p>
              
              <div className="equipment-selector-grid">
                {EQUIPMENTS.map(item => {
                  const isSelected = equipmentList.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`equipment-card-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => handleToggleEquipment(item.key)}
                    >
                      <div className="chk-icon-box">
                        {isSelected ? <Check size={16} /> : <div className="dot-placeholder"></div>}
                      </div>
                      <span className="eq-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: 力量基准 (1RM) */}
          {currentStep === 4 && (
            <div className="ob-step-form animate-slideIn">
              <div className="step-title-row">
                <h3 className="ob-step-title"><Sparkles size={20} /> 设定主要动作力量基准</h3>
                <button 
                  type="button" 
                  className="ob-estimator-toggle-btn"
                  onClick={() => setShowEstimator(!showEstimator)}
                >
                  <Calculator size={14} style={{ marginRight: '4px' }} />
                  {showEstimator ? '隐藏估算器' : '1RM 估算器'}
                </button>
              </div>
              <p className="ob-step-subtitle">输入主要复合动作的 1RM (最大单次重量) 估算值，用于您的能力归档记录，可随时直接跳过。</p>

              {/* 1RM 估算器弹窗工具面板 */}
              {showEstimator && (
                <div className="ob-estimator-panel animate-fadeIn">
                  <h4>⚙️ 1RM 极限重量估算小工具</h4>
                  <p className="estimator-desc">使用 Epley 公式：1RM = 使用重量 × (1 + 完成次数 / 30)</p>
                  
                  <div className="ob-form-group">
                    <label>目标基准动作</label>
                    <select value={estimatorTarget} onChange={(e) => setEstimatorTarget(e.target.value)}>
                      <option value="squat">深蹲 (Squat)</option>
                      <option value="bench">卧推 (Bench Press)</option>
                      <option value="deadlift">硬拉 (Deadlift)</option>
                      <option value="press">推举 (Overhead Press)</option>
                    </select>
                  </div>

                  <div className="ob-form-row">
                    <div className="ob-form-group half-width">
                      <label>使用重量 (kg)</label>
                      <input 
                        type="number" 
                        value={estimatorWeight}
                        onChange={(e) => {
                          setEstimatorWeight(e.target.value);
                          // 自动算
                          const w = parseFloat(e.target.value);
                          const r = parseInt(estimatorReps, 10);
                          if (w > 0 && r > 0) setEstimated1RM(Math.round(w * (1 + r / 30) * 10) / 10);
                        }}
                        placeholder="80"
                      />
                    </div>
                    <div className="ob-form-group half-width">
                      <label>完成次数 (reps)</label>
                      <input 
                        type="number" 
                        value={estimatorReps}
                        onChange={(e) => {
                          setEstimatorReps(e.target.value);
                          // 自动算
                          const w = parseFloat(estimatorWeight);
                          const r = parseInt(e.target.value, 10);
                          if (w > 0 && r > 0) setEstimated1RM(Math.round(w * (1 + r / 30) * 10) / 10);
                        }}
                        placeholder="5"
                      />
                    </div>
                  </div>

                  {estimated1RM > 0 && (
                    <div className="estimator-result">
                      <span>估算极限 1RM：</span>
                      <strong>{estimated1RM} kg</strong>
                      <button type="button" className="apply-est-btn" onClick={applyEstimatedValue}>
                        一键应用
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="ob-form-row">
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-squat">深蹲 1RM (kg)</label>
                  <input 
                    type="number" 
                    id="ob-squat" 
                    value={squat1RM}
                    onChange={(e) => setSquat1RM(e.target.value)}
                    placeholder="未设定"
                  />
                </div>
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-bench">卧推 1RM (kg)</label>
                  <input 
                    type="number" 
                    id="ob-bench" 
                    value={bench1RM}
                    onChange={(e) => setBench1RM(e.target.value)}
                    placeholder="未设定"
                  />
                </div>
              </div>

              <div className="ob-form-row">
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-deadlift">硬拉 1RM (kg)</label>
                  <input 
                    type="number" 
                    id="ob-deadlift" 
                    value={deadlift1RM}
                    onChange={(e) => setDeadlift1RM(e.target.value)}
                    placeholder="未设定"
                  />
                </div>
                <div className="ob-form-group half-width">
                  <label htmlFor="ob-press">推举 1RM (kg)</label>
                  <input 
                    type="number" 
                    id="ob-press" 
                    value={press1RM}
                    onChange={(e) => setPress1RM(e.target.value)}
                    placeholder="未设定"
                  />
                </div>
              </div>

              <div className="skip-step-notice">
                <HelpCircle size={14} />
                <span>此力量基准仅作参考，不自动覆盖计划中的今日训练重量。您可以完全不填直接进入下一步。</span>
              </div>
            </div>
          )}

          {/* STEP 5: 日程设置与确认摘要 */}
          {currentStep === 5 && (
            <div className="ob-step-form ob-step-summary animate-slideIn">
              <h3 className="ob-step-title"><Calendar size={20} /> 设置你的训练日程</h3>
              <p className="ob-step-subtitle">系统根据选定日程判断今日为训练日或休息日，这是唯一会影响系统推演逻辑的画像字段。</p>
              
              {/* 日程勾选网格 */}
              <div className="ob-schedule-box">
                <div className="ob-weekday-checklist">
                  {WEEKDAYS.map(day => {
                    const isSelected = trainingDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={`weekday-badge-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleDay(day.key)}
                      >
                        <div className="ob-chk-indicator">
                          {isSelected ? <Check size={12} /> : null}
                        </div>
                        <span>{day.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 练几休几快捷预设 */}
                <div className="ob-preset-shortcuts">
                  <span className="preset-label">快捷循环模式：</span>
                  <div className="preset-btn-group">
                    <button type="button" className="preset-tag-btn" onClick={() => handleApplyPreset('1-1')}>
                      练1休1 (每周4天)
                    </button>
                    <button type="button" className="preset-tag-btn" onClick={() => handleApplyPreset('2-1')}>
                      练2休1 (每周5天)
                    </button>
                    <button type="button" className="preset-tag-btn" onClick={() => handleApplyPreset('3-1')}>
                      练3休1 (每周6天)
                    </button>
                    <button type="button" className="preset-tag-btn" onClick={() => handleApplyPreset('5-2')}>
                      练5休2 (工作日)
                    </button>
                  </div>
                </div>

                <div className="selected-days-summary">
                  当前已选择：<strong>{trainingDays.length}</strong> 天/周 (星期{trainingDays.map(d => WEEKDAYS.find(w => w.key === d)?.label.replace('周','')).join('、') || '无'})
                </div>
              </div>

              {/* 画像信息摘要面板 */}
              <div className="ob-summary-panel">
                <h4>📊 个人画像摘要核对</h4>
                <div className="summary-grid">
                  <div className="summary-item"><span className="lbl">昵称：</span><span className="val">{nickname || '未设定'}</span></div>
                  <div className="summary-item"><span className="lbl">性别：</span><span className="val">{gender === 'male' ? '男' : gender === 'female' ? '女' : '其他'}</span></div>
                  <div className="summary-item"><span className="lbl">体能状态：</span><span className="val">{age}岁 / {height}cm / {weight}kg</span></div>
                  <div className="summary-item"><span className="lbl">背景目标：</span><span className="val">{trainingYears}经验 · {trainingLevel} · {primaryGoal}</span></div>
                  <div className="summary-item"><span className="lbl">单次时长：</span><span className="val">{sessionDurationMin}分钟</span></div>
                  <div className="summary-item"><span className="lbl">已设 1RM：</span><span className="val">
                    蹲 {squat1RM || '-'}kg / 推 {bench1RM || '-'}kg / 拉 {deadlift1RM || '-'}kg / 举 {press1RM || '-'}kg
                  </span></div>
                  <div className="summary-item" style={{ gridColumn: 'span 2' }}><span className="lbl">可用器械：</span><span className="val">
                    {equipmentList.map(eq => EQUIPMENTS.find(e => e.key === eq)?.label.split(' ')[0]).join(', ') || '未选择'}
                  </span></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 底部导航操作区 */}
        <div className="onboarding-footer">
          {currentStep > 1 ? (
            <button 
              type="button" 
              className="btn-secondary ob-nav-btn" 
              onClick={handlePrevStep}
              disabled={saving}
            >
              <ChevronLeft size={20} />
              <span>上一步</span>
            </button>
          ) : (
            <div className="footer-placeholder"></div>
          )}

          {currentStep < 5 ? (
            <button 
              type="button" 
              className="btn-primary ob-nav-btn" 
              onClick={handleNextStep}
            >
              <span>下一步</span>
              <ChevronRight size={20} />
            </button>
          ) : (
            <button 
              type="button" 
              className="btn-primary ob-save-btn" 
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="spinner-small"></div>
                  <span>正在保存画像...</span>
                </>
              ) : (
                <>
                  <Check size={20} />
                  <span>完成画像并前往计划配置</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingScreen;
