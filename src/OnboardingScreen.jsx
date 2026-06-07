import { useState } from 'react';
import { saveUserProfile } from './services/profileService';
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
  Award,
  AlertTriangle,
  Loader2,
  Wrench
} from 'lucide-react';

/**
 * OnboardingScreen 用户画像引导流程组件
 * 使用 Tailwind CSS + DaisyUI 进行完全重构，适配浅色/深色模式
 * 
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
      days = ['Monday', 'Wednesday', 'Friday', 'Sunday'];
    } else if (presetType === '2-1') {
      days = ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Sunday'];
    } else if (presetType === '3-1') {
      days = ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'];
    } else if (presetType === '5-2') {
      days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    }
    setTrainingDays(days);
    setTrainingDaysPerWeek(days.length);
  };

  // 表单步骤跳转验证
  const handleNextStep = () => {
    if (currentStep === 1) {
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

      await saveUserProfile(profileData);

      if (nickname.trim()) {
        localStorage.setItem('user_nickname', nickname.trim());
      } else {
        localStorage.removeItem('user_nickname');
      }

      localStorage.setItem('onboarding_completed', 'true');
      onComplete();

    } catch (err) {
      console.error('保存画像数据失败：', err);
      setErrorMsg('保存画像数据失败，请检查网络：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onSkip();
  };

  const stepsCount = 5;
  const progressPercent = (currentStep / stepsCount) * 100;
  
  const getStepName = () => {
    switch (currentStep) {
      case 1: return '基本信息';
      case 2: return '训练背景';
      case 3: return '可用器械';
      case 4: return '力量基准';
      case 5: return '确认与日程';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-main/95 dark:bg-bg-main-dark/95 backdrop-blur-lg overflow-y-auto w-full max-w-[480px] mx-auto animate-fadeIn select-none">
      <div className="w-full bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* 顶部操作条 */}
        <div className="flex items-center justify-between p-5 border-b border-border-card dark:border-border-card-dark shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Dumbbell size={20} className="filter drop-shadow-[0_0_6px_rgba(255,107,53,0.35)]" />
            <span className="text-base font-extrabold tracking-wide">
              训练画像引导
            </span>
          </div>
          <button 
            type="button" 
            className="btn btn-ghost btn-xs text-text-secondary dark:text-text-secondary-dark font-bold hover:bg-bg-hover dark:hover:bg-bg-hover-dark rounded-lg cursor-pointer" 
            onClick={handleSkipOnboarding}
            aria-label="跳过引导"
          >
            跳过
          </button>
        </div>

        {/* 进度条与步骤指示 */}
        <div className="px-5 pt-4 shrink-0 flex flex-col gap-2">
          <progress className="progress progress-primary w-full h-1.5" value={progressPercent} max="100"></progress>
          <div className="flex justify-between items-center text-xs font-bold text-text-secondary dark:text-text-secondary-dark select-none mt-1">
            <span>步骤 {currentStep} / {stepsCount}</span>
            <span className="text-primary">{getStepName()}</span>
          </div>
        </div>

        {/* 错误提示框 */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-bg-alert dark:bg-bg-alert-dark text-alert dark:text-alert-dark border-l-4 border-alert dark:border-alert-dark rounded-r-lg flex items-center gap-2 text-xs animate-fadeIn shrink-0">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 核心内容区 */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          
          {/* STEP 1: 基本信息 */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4 animate-slideIn">
              <div>
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                  <User size={18} className="text-primary" />
                  <span>基本信息设置</span>
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 leading-relaxed">这些数据会作为本地参考存档，不影响系统推荐的建议重量。</p>
              </div>

              {/* 昵称 */}
              <div className="form-control w-full">
                <label className="section-subtitle" htmlFor="ob-nickname">
                  昵称 (选填)
                </label>
                <input 
                  type="text" 
                  id="ob-nickname" 
                  className="input-standard !font-sans !font-bold"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="怎么称呼你？"
                  maxLength={15}
                />
              </div>

              {/* 性别选择 */}
              <div className="form-control w-full">
                <label className="section-subtitle select-none">
                  性别
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['male', 'female', 'other'].map(g => (
                    <button 
                      key={g}
                      type="button" 
                      className={`btn btn-md h-10 rounded-xl font-bold cursor-pointer transition-all text-sm ${
                        gender === g 
                          ? 'btn-primary text-white shadow-md' 
                          : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                      }`}
                      onClick={() => setGender(g)}
                    >
                      {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 年龄身高 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-age">
                    年龄 (岁)
                  </label>
                  <input 
                    type="number" 
                    id="ob-age" 
                    className="input-standard font-bold"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-height">
                    身高 (cm)
                  </label>
                  <input 
                    type="number" 
                    id="ob-height" 
                    className="input-standard font-bold"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                    min="50"
                    max="250"
                    required
                  />
                </div>
              </div>

              {/* 体重 */}
              <div className="form-control w-full">
                <label className="section-subtitle" htmlFor="ob-weight">
                  当前体重 (kg)
                </label>
                <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark px-3 h-11 w-full focus-within:border-primary">
                  <input 
                    type="number" 
                    id="ob-weight" 
                    className="w-full bg-transparent text-base font-mono font-bold text-text-main dark:text-text-main-dark focus:outline-none"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70.0"
                    step="0.1"
                    min="20"
                    max="300"
                    required
                  />
                  <span className="text-sm font-bold text-text-secondary/50 dark:text-text-secondary-dark/50 select-none">kg</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 训练背景 */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4 animate-slideIn">
              <div>
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                  <Activity size={18} className="text-primary" />
                  <span>选择训练背景</span>
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 leading-relaxed">定制你的健身侧写，辅助记录您的体能进化阶段。</p>
              </div>

              {/* 训练年限 */}
              <div className="form-control w-full">
                <label className="section-subtitle select-none">
                  训练年限
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['0-1年', '1-3年', '3-5年', '5年以上'].map(y => (
                    <button 
                      key={y}
                      type="button" 
                      className={`btn btn-md h-10 rounded-xl font-bold cursor-pointer transition-all text-sm ${
                        trainingYears === y 
                          ? 'btn-primary text-white shadow-md' 
                          : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                      }`}
                      onClick={() => setTrainingYears(y)}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* 训练水平 */}
              <div className="form-control w-full">
                <label className="section-subtitle select-none">
                  目前训练水平
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['初学者', '中级者', '高级者'].map(lvl => (
                    <button 
                      key={lvl}
                      type="button" 
                      className={`btn btn-md h-10 rounded-xl font-bold cursor-pointer transition-all text-sm ${
                        trainingLevel === lvl 
                          ? 'btn-primary text-white shadow-md' 
                          : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                      }`}
                      onClick={() => setTrainingLevel(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* 主要目标 */}
              <div className="form-control w-full">
                <label className="section-subtitle select-none">
                  主要训练目标
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['增肌', '减脂', '提高力量', '身体健康'].map(g => (
                    <button 
                      key={g}
                      type="button" 
                      className={`btn btn-md h-10 rounded-xl font-bold cursor-pointer transition-all text-sm ${
                        primaryGoal === g 
                          ? 'btn-primary text-white shadow-md' 
                          : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                      }`}
                      onClick={() => setPrimaryGoal(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 单次时长 */}
              <div className="form-control w-full mt-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="section-subtitle" htmlFor="ob-duration">
                    每次训练预计时长
                  </label>
                  <span className="text-xs font-extrabold text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                    {sessionDurationMin} 分钟
                  </span>
                </div>
                <input 
                  type="range" 
                  id="ob-duration"
                  min="20" 
                  max="180" 
                  step="5"
                  className="range range-primary range-sm cursor-pointer" 
                  value={sessionDurationMin} 
                  onChange={(e) => setSessionDurationMin(parseInt(e.target.value, 10))}
                />
                <div className="w-full flex justify-between text-xs text-text-secondary/50 font-mono mt-1 select-none">
                  <span className="cursor-pointer hover:text-primary transition-colors animate-fadeIn" onClick={() => setSessionDurationMin(20)}>20m</span>
                  <span className="cursor-pointer hover:text-primary transition-colors animate-fadeIn" onClick={() => setSessionDurationMin(60)}>60m</span>
                  <span className="cursor-pointer hover:text-primary transition-colors animate-fadeIn" onClick={() => setSessionDurationMin(100)}>100m</span>
                  <span className="cursor-pointer hover:text-primary transition-colors animate-fadeIn" onClick={() => setSessionDurationMin(140)}>140m</span>
                  <span className="cursor-pointer hover:text-primary transition-colors animate-fadeIn" onClick={() => setSessionDurationMin(180)}>180m</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 可用器械 */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4 animate-slideIn">
              <div>
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                  <Sliders size={18} className="text-primary" />
                  <span>可用器械 (多选)</span>
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 leading-relaxed">勾选您训练场馆中拥有的可用器械类别（仅作参考）。</p>
              </div>

              <div className="flex flex-col gap-2">
                {EQUIPMENTS.map(item => {
                  const isSelected = equipmentList.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`btn btn-md h-12 w-full rounded-xl flex items-center justify-between font-bold cursor-pointer transition-all border px-4 text-base ${
                        isSelected 
                          ? 'btn-primary text-white shadow-sm' 
                          : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                      }`}
                      onClick={() => handleToggleEquipment(item.key)}
                    >
                      <span>{item.label}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-white text-primary border-white' : 'border-border-card dark:border-border-card-dark bg-transparent'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: 力量基准 (1RM) */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4 animate-slideIn">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                  <Sparkles size={18} className="text-primary" />
                  <span>主要动作力量基准</span>
                </h3>
                <button 
                  type="button" 
                  className="btn btn-xs btn-outline btn-primary rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  onClick={() => setShowEstimator(!showEstimator)}
                >
                  <Calculator size={12} />
                  <span>{showEstimator ? '收起计算器' : '1RM 估算器'}</span>
                </button>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">
                输入您的 1RM（单次最大重量，单位：kg）极限进行归档，可选择跳过。
              </p>

              {/* 1RM 估算器工具面板 */}
              {showEstimator && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-3 animate-fadeIn">
                  <h4 className="text-xs font-extrabold text-primary flex items-center gap-1"><Wrench size={12} /> 1RM 极限重量估算器</h4>
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark leading-normal">
                    根据 Epley 公式：1RM = 负重 × (1 + 次数 / 30)
                  </p>
                  
                  <div className="form-control w-full">
                    <label className="section-subtitle select-none">目标动作</label>
                    <select 
                      className="select-standard !h-9 !rounded-lg"
                      value={estimatorTarget} 
                      onChange={(e) => setEstimatorTarget(e.target.value)}
                    >
                      <option value="squat">深蹲 (Squat)</option>
                      <option value="bench">卧推 (Bench Press)</option>
                      <option value="deadlift">硬拉 (Deadlift)</option>
                      <option value="press">推举 (Overhead Press)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="section-subtitle select-none">负重 (kg)</label>
                      <input 
                        type="number" 
                        className="input input-bordered input-sm h-9 text-center font-mono font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none text-sm"
                        value={estimatorWeight}
                        onChange={(e) => {
                          setEstimatorWeight(e.target.value);
                          const w = parseFloat(e.target.value);
                          const r = parseInt(estimatorReps, 10);
                          if (w > 0 && r > 0) setEstimated1RM(Math.round(w * (1 + r / 30) * 10) / 10);
                        }}
                        placeholder="80"
                      />
                    </div>
                    <div className="form-control">
                      <label className="section-subtitle select-none">完成次数 (次)</label>
                      <input 
                        type="number" 
                        className="input input-bordered input-sm h-9 text-center font-mono font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark focus:border-primary focus:outline-none text-sm"
                        value={estimatorReps}
                        onChange={(e) => {
                          setEstimatorReps(e.target.value);
                          const w = parseFloat(estimatorWeight);
                          const r = parseInt(e.target.value, 10);
                          if (w > 0 && r > 0) setEstimated1RM(Math.round(w * (1 + r / 30) * 10) / 10);
                        }}
                        placeholder="5"
                      />
                    </div>
                  </div>

                  {estimated1RM > 0 && (
                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-primary/10 select-none">
                      <div className="text-xs text-text-main dark:text-text-main-dark">
                        估算极限: <strong className="text-primary font-mono text-sm">{estimated1RM}</strong> kg
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-primary btn-xs text-white rounded font-bold cursor-pointer" 
                        onClick={applyEstimatedValue}
                      >
                        一键填充
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 力量基准列表 */}
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-squat">
                    深蹲 1RM
                  </label>
                  <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark px-2.5 h-11 w-full focus-within:border-primary">
                    <input 
                      type="number" 
                      id="ob-squat" 
                      className="w-full bg-transparent text-base font-mono font-bold text-text-main dark:text-text-main-dark focus:outline-none"
                      value={squat1RM}
                      onChange={(e) => setSquat1RM(e.target.value)}
                      placeholder="未设定"
                    />
                    <span className="text-xs font-bold text-text-secondary/35 select-none">kg</span>
                  </div>
                </div>
                
                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-bench">
                    卧推 1RM
                  </label>
                  <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark px-2.5 h-11 w-full focus-within:border-primary">
                    <input 
                      type="number" 
                      id="ob-bench" 
                      className="w-full bg-transparent text-base font-mono font-bold text-text-main dark:text-text-main-dark focus:outline-none"
                      value={bench1RM}
                      onChange={(e) => setBench1RM(e.target.value)}
                      placeholder="未设定"
                    />
                    <span className="text-xs font-bold text-text-secondary/35 select-none">kg</span>
                  </div>
                </div>

                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-deadlift">
                    硬拉 1RM
                  </label>
                  <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark px-2.5 h-11 w-full focus-within:border-primary">
                    <input 
                      type="number" 
                      id="ob-deadlift" 
                      className="w-full bg-transparent text-base font-mono font-bold text-text-main dark:text-text-main-dark focus:outline-none"
                      value={deadlift1RM}
                      onChange={(e) => setDeadlift1RM(e.target.value)}
                      placeholder="未设定"
                    />
                    <span className="text-xs font-bold text-text-secondary/35 select-none">kg</span>
                  </div>
                </div>

                <div className="form-control">
                  <label className="section-subtitle" htmlFor="ob-press">
                    推举 1RM
                  </label>
                  <div className="input input-bordered flex items-center gap-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark px-2.5 h-11 w-full focus-within:border-primary">
                    <input 
                      type="number" 
                      id="ob-press" 
                      className="w-full bg-transparent text-base font-mono font-bold text-text-main dark:text-text-main-dark focus:outline-none"
                      value={press1RM}
                      onChange={(e) => setPress1RM(e.target.value)}
                      placeholder="未设定"
                    />
                    <span className="text-xs font-bold text-text-secondary/35 select-none">kg</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 p-3 bg-bg-hover dark:bg-bg-hover-dark rounded-xl flex items-start gap-2 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed select-none">
                <HelpCircle size={14} className="shrink-0 text-primary mt-0.5" />
                <span>此力量基准仅作存档参考，不会自动覆盖计划中的首训建议重量，您可以完全不填。</span>
              </div>
            </div>
          )}

          {/* STEP 5: 日程设置与确认 */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-4 animate-slideIn">
              <div>
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                  <Calendar size={18} className="text-primary" />
                  <span>训练日程安排</span>
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 leading-relaxed">
                  系统根据选定日程判断今日为训练日或休息日，这是唯一会影响系统推演逻辑的画像字段。
                </p>
              </div>

              {/* 日程勾选网格 */}
              <div className="flex flex-col gap-3.5 mt-1">
                <div className="grid grid-cols-4 gap-2">
                  {WEEKDAYS.map(day => {
                    const isSelected = trainingDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={`btn btn-sm h-10 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all border text-xs sm:text-sm px-1.5 sm:px-3 ${
                          isSelected 
                            ? 'btn-primary text-white shadow-sm' 
                            : 'btn-outline border-border-card dark:border-border-card-dark text-text-secondary hover:bg-bg-hover dark:hover:bg-bg-hover-dark'
                        }`}
                        onClick={() => handleToggleDay(day.key)}
                      >
                        <span>{day.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 练几休几快捷预设 */}
                <div className="flex flex-col gap-2 p-3 bg-bg-main/20 dark:bg-bg-main-dark/20 rounded-xl border border-border-card/50">
                  <span className="text-xs font-bold text-text-secondary">快捷循环模式：</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn btn-outline border-border-card dark:border-border-card-dark hover:bg-bg-hover text-xs h-9 rounded-lg font-bold cursor-pointer" onClick={() => handleApplyPreset('1-1')}>
                      练1休1 (每周4天)
                    </button>
                    <button type="button" className="btn btn-outline border-border-card dark:border-border-card-dark hover:bg-bg-hover text-xs h-9 rounded-lg font-bold cursor-pointer" onClick={() => handleApplyPreset('2-1')}>
                      练2休1 (每周5天)
                    </button>
                    <button type="button" className="btn btn-outline border-border-card dark:border-border-card-dark hover:bg-bg-hover text-xs h-9 rounded-lg font-bold cursor-pointer" onClick={() => handleApplyPreset('3-1')}>
                      练3休1 (每周6天)
                    </button>
                    <button type="button" className="btn btn-outline border-border-card dark:border-border-card-dark hover:bg-bg-hover text-xs h-9 rounded-lg font-bold cursor-pointer" onClick={() => handleApplyPreset('5-2')}>
                      练5休2 (工作日)
                    </button>
                  </div>
                </div>

                <div className="text-xs font-bold text-primary px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10 select-none">
                  已选择：{trainingDays.length} 天/周 ({trainingDays.map(d => WEEKDAYS.find(w => w.key === d)?.label).join('、') || '未设定'})
                </div>
              </div>

              {/* 画像信息摘要面板 */}
              <div className="mt-1 p-4 bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl border border-border-card/50 flex flex-col gap-2">
                <h4 className="section-subtitle flex items-center gap-1.5 pb-1 border-b border-border-card/50 select-none">
                  <Award size={14} className="text-primary" />
                  <span>个人画像摘要核对</span>
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs leading-relaxed">
                  <div><span className="text-text-secondary font-bold">昵称：</span><span className="font-bold text-text-main dark:text-text-main-dark">{nickname || '未设定'}</span></div>
                  <div><span className="text-text-secondary font-bold">性别：</span><span className="font-bold text-text-main dark:text-text-main-dark">{gender === 'male' ? '男' : gender === 'female' ? '女' : '其他'}</span></div>
                  <div className="col-span-2"><span className="text-text-secondary font-bold">体能：</span><span className="font-bold text-text-main dark:text-text-main-dark">{age}岁 / {height}cm / {weight}kg</span></div>
                  <div className="col-span-2"><span className="text-text-secondary font-bold">阶段：</span><span className="font-bold text-text-main dark:text-text-main-dark">{trainingYears}经验 · {trainingLevel} · {primaryGoal}</span></div>
                  <div><span className="text-text-secondary font-bold">单次时长：</span><span className="font-bold text-text-main dark:text-text-main-dark">{sessionDurationMin}分钟</span></div>
                  <div className="col-span-2"><span className="text-text-secondary font-bold">1RM 基准：</span><span className="font-mono font-bold text-text-main dark:text-text-main-dark">
                    蹲 {squat1RM || '-'} / 推 {bench1RM || '-'} / 拉 {deadlift1RM || '-'} / 举 {press1RM || '-'}
                  </span></div>
                  <div className="col-span-2 truncate"><span className="text-text-secondary font-bold">可用器械：</span><span className="font-bold text-text-main dark:text-text-main-dark">
                    {equipmentList.map(eq => EQUIPMENTS.find(e => e.key === eq)?.label.split(' ')[0]).join(', ') || '未选择'}
                  </span></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 底部导航操作区 */}
        <div className="p-5 border-t border-border-card dark:border-border-card-dark flex items-center justify-between gap-4 shrink-0">
          {currentStep > 1 ? (
            <button 
              type="button" 
              className="btn btn-sm btn-outline border-border-card dark:border-border-card-dark text-text-secondary dark:text-text-secondary-dark flex-1 h-10 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer" 
              onClick={handlePrevStep}
              disabled={saving}
            >
              <ChevronLeft size={16} />
              <span>上一步</span>
            </button>
          ) : (
            <div className="flex-1"></div>
          )}

          {currentStep < 5 ? (
            <button 
              type="button" 
              className="btn btn-primary btn-sm text-white flex-1 h-10 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer" 
              onClick={handleNextStep}
            >
              <span>下一步</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary btn-sm text-white flex-1 h-10 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md" 
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>正在保存画像...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>完成画像并前往计划</span>
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
