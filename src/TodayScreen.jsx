import { useState, useMemo } from 'react';
import { calcCalorieBudget, calcMacronutrientTargets } from './dietUtils';
import { saveDietLog } from './services/dietService';
import { saveBodyMetrics } from './services/bodyService';
import { getBmiInfo, getWhtrInfo } from './healthUtils';
import { Play, RotateCcw, Heart, Utensils, Calendar, ChevronDown, ArrowRight, SkipForward, Flag, Loader2, Zap, Dumbbell, Timer, Scale, Moon, ClipboardList, Pause, Ruler } from 'lucide-react';
import WorkoutSessionSummary from './components/WorkoutSessionSummary';
import { Button } from './design-system/components';

// 训练摘要纯展示组件（从 JSX IIFE 提取）
const TIER_MINUTES = { T1: 3.5, T2: 2.5, T3: 1.5 };
const WARMUP_MIN = 10;
const TRANSITION_MIN_PER_EX = 3;

function WorkoutSummary({ exercises }) {
  const { exCount, totalWeight, estMinutes } = useMemo(() => {
    const exCount = exercises.length;
    const totalWeight = exercises.reduce((sum, ex) => sum + ((ex.weight || 0) * (ex.sets || 0)), 0);
    const transitionMin = Math.max(0, exCount - 1) * TRANSITION_MIN_PER_EX;
    const setsMin = exercises.reduce((sum, ex) => {
      const sets = ex.sets || 0;
      const factor = TIER_MINUTES[ex.tier] || 2;
      return sum + (sets * factor);
    }, 0);
    const estMinutes = Math.max(15, Math.round(WARMUP_MIN + transitionMin + setsMin));
    return { exCount, totalWeight, estMinutes };
  }, [exercises]);

  return (
    <div className="flex flex-col gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
      <div className="flex items-center gap-2"><Dumbbell size={14} /><span><span className="font-bold text-text-main dark:text-text-main-dark">{exCount}</span> 个动作</span></div>
      <div className="flex items-center gap-2"><Dumbbell size={14} /><span>总训练量 <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{totalWeight.toFixed(1)}kg</span></span></div>
      <div className="flex items-center gap-2"><Timer size={14} /><span>预计耗时 <span className="font-bold text-text-main dark:text-text-main-dark">{estMinutes}</span> 分钟</span></div>
    </div>
  );
}

function TodayScreen({
  activeProgram,
  activeUserProgram,
  activeUserPrograms,
  programs,
  todayWorkout,
  sessionState,
  onStartTrain,
  onOpenPreview,
  onSwitchProgram,
  onGoToLibrary,
  getExerciseCNName,
  isTodayCompleted,
  todayWorkoutSummary,
  isRestDay = false,
  nextTrainingDate = '',
  onSkipTraining,
  onExtraTraining,
  daysUntilStart = 0,
  userProfile = null,
  todayBodyMetrics = null,
  onRefreshBodyMetrics,
  todayDietLog,
  userNutritionConfig,
  onRefreshDiet,
  onTriggerDeload
}) {
  const [showProgramSwitcher, setShowProgramSwitcher] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const isSessionActive = sessionState && sessionState.isActive;

  // 今日身体记录快速打卡状态
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hr, setHr] = useState('');
  const [sleep, setSleep] = useState('');
  const [fatigue, setFatigue] = useState('5');
  const [savingBody, setSavingBody] = useState(false);
  const [bodyError, setBodyError] = useState('');
  const [isEditingBody, setIsEditingBody] = useState(false);

  const startEditingBody = () => {
    if (todayBodyMetrics) {
      setWeight(todayBodyMetrics.weight_kg?.toString() || '');
      setWaist(todayBodyMetrics.waist_cm?.toString() || '');
      setHr(todayBodyMetrics.heart_rate?.toString() || '');
      setSleep(todayBodyMetrics.sleep_hours?.toString() || '');
      setFatigue(todayBodyMetrics.fatigue_rating?.toString() || '5');
    } else {
      setWeight('');
      setWaist('');
      setHr('');
      setSleep('');
      setFatigue('5');
    }
    setIsEditingBody(true);
  };

  // 今日饮食记录快速打卡状态
  const [actCarbs, setActCarbs] = useState('');
  const [actProtein, setActProtein] = useState('');
  const [actFat, setActFat] = useState('');
  const [actCalories, setActCalories] = useState('');
  const [dietNotes, setDietNotes] = useState('');
  const [savingDiet, setSavingDiet] = useState(false);
  const [dietError, setDietError] = useState('');
  const [isEditingDiet, setIsEditingDiet] = useState(false);
  const [entryMode, setEntryMode] = useState('grams'); // grams | ratio
  const [localDayType, setLocalDayType] = useState(''); // 'strength_day' | 'rest_day'

  const startEditingDiet = () => {
    if (todayDietLog) {
      setActCarbs(todayDietLog.actual_carbs_g?.toString() || '');
      setActProtein(todayDietLog.actual_protein_g?.toString() || '');
      setActFat(todayDietLog.actual_fat_g?.toString() || '');
      setActCalories(todayDietLog.actual_calories?.toString() || '');
      setDietNotes(todayDietLog.notes || '');
      setEntryMode(todayDietLog.entry_mode || 'grams');
      setLocalDayType(todayDietLog.day_type || (isRestDay ? 'rest_day' : 'strength_day'));
    } else {
      setActCarbs('');
      setActProtein('');
      setActFat('');
      setActCalories('');
      setDietNotes('');
      setEntryMode('grams');
      setLocalDayType(isRestDay ? 'rest_day' : 'strength_day');
    }
    setIsEditingDiet(true);
  };

  // 保存今日快捷身体指标
  const handleSaveDiet = async (e) => {
    e.preventDefault();
    setSavingDiet(true);
    setDietError('');
    try {
      const d = new Date();
      const todayISOString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const activeDayType = localDayType || (isRestDay ? 'rest_day' : 'strength_day');

      let carbsVal = parseFloat(actCarbs) || 0;
      let proteinVal = parseFloat(actProtein) || 0;
      let fatVal = parseFloat(actFat) || 0;
      let calVal = parseFloat(actCalories) || 0;

      if (entryMode === 'ratio') {
        if (calVal <= 0) {
          setDietError('请填写有效的实际摄入热量');
          setSavingDiet(false);
          return;
        }
        const rc = parseInt(userNutritionConfig?.ratio_carbs, 10) || 50;
        const rp = parseInt(userNutritionConfig?.ratio_protein, 10) || 30;
        const rf = parseInt(userNutritionConfig?.ratio_fat, 10) || 20;

        carbsVal = (calVal * (rc / 100)) / 4;
        proteinVal = (calVal * (rp / 100)) / 4;
        fatVal = (calVal * (rf / 100)) / 9;
      } else {
        if (carbsVal < 0 || proteinVal < 0 || fatVal < 0) {
          setDietError('克数值不能为负');
          setSavingDiet(false);
          return;
        }
        calVal = carbsVal * 4 + proteinVal * 4 + fatVal * 9;
      }

      const entry = {
        date: todayISOString,
        day_type: activeDayType,
        entry_mode: entryMode,
        actual_carbs_g: Math.round(carbsVal * 10) / 10,
        actual_protein_g: Math.round(proteinVal * 10) / 10,
        actual_fat_g: Math.round(fatVal * 10) / 10,
        actual_calories: Math.round(calVal),
        notes: dietNotes || null,
        updated_at: new Date().toISOString()
      };

      await saveDietLog(entry);

      setIsEditingDiet(false);
      if (onRefreshDiet) {
        await onRefreshDiet();
      }
    } catch (err) {
      setDietError('对账单保存失败：' + err.message);
    } finally {
      setSavingDiet(false);
    }
  };

  const renderDietCard = () => {
    if (!userNutritionConfig) {
      return (
        <div className="card flex flex-col gap-2 opacity-80 border border-dashed border-border-card text-center py-4">
          <Utensils size={24} className="text-text-secondary/50 mx-auto" />
          <p className="text-sm font-bold text-text-secondary select-none">未激活饮食核算方案</p>
          <p className="text-xs text-text-secondary/70 max-w-xs mx-auto select-none">请前往底部「饮食」页签，完成 TDEE 与宏量配比配置并激活。</p>
        </div>
      );
    }

    const activeDayType = localDayType || (isRestDay ? 'rest_day' : 'strength_day');
    const isStrengthDay = activeDayType === 'strength_day';
    const weightForCalc = parseFloat(todayBodyMetrics?.weight_kg) || parseFloat(userProfile?.weight_kg) || 70;
    const calBudget = calcCalorieBudget(userProfile, weightForCalc, userNutritionConfig, isStrengthDay);
    const macroTargets = calcMacronutrientTargets(calBudget.budget, weightForCalc, userNutritionConfig, isStrengthDay);

    const hasData = todayDietLog && !isEditingDiet;

    if (hasData) {
      const deltaCal = todayDietLog.actual_calories - macroTargets.calories;
      const isSurplus = deltaCal > 0;
      const progressCarbs = Math.min(100, Math.round((todayDietLog.actual_carbs_g / macroTargets.carbs) * 100)) || 0;
      const progressProtein = Math.min(100, Math.round((todayDietLog.actual_protein_g / macroTargets.protein) * 100)) || 0;
      const progressFat = Math.min(100, Math.round((todayDietLog.actual_fat_g / macroTargets.fat) * 100)) || 0;
      const progressCal = Math.min(100, Math.round((todayDietLog.actual_calories / macroTargets.calories) * 100)) || 0;

      return (
        <div className="card flex flex-col gap-3.5 border border-primary/20 dark:border-primary/30">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base md:text-lg font-bold text-text-main dark:text-text-main-dark">
              <Utensils size={15} className="text-orange-500" /><span>今日已录饮食对账</span>
            </span>
            <button
              type="button"
              className="btn-aux text-primary bg-transparent hover:bg-bg-hover dark:hover:bg-bg-hover-dark font-bold"
              onClick={startEditingDiet}
            >
              修改对账
            </button>
          </div>

          <div className="flex flex-col gap-1.5 p-3 bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/30 rounded-xl">
            <div className="flex justify-between items-center text-sm font-bold select-none text-text-secondary">
              <span>卡路里摄入对照</span>
              <span className="font-mono text-text-main dark:text-text-main-dark text-base">
                {todayDietLog.actual_calories} / {macroTargets.calories} <small className="text-xs text-text-secondary font-bold">kcal</small>
              </span>
            </div>
            <progress className={`progress w-full h-2 ${progressCal >= 100 ? 'progress-success' : 'progress-primary'}`} value={progressCal} max="100"></progress>
            <div className="flex justify-between items-center text-xs select-none font-bold mt-0.5">
              <span className="text-text-secondary/70">
                比例: {progressCal}%
              </span>
              <span className={isSurplus ? 'text-amber-500' : 'text-green-500'}>
                {isSurplus ? `超支 +${deltaCal} kcal` : `剩余还可吃 ${Math.abs(deltaCal)} kcal`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs leading-relaxed">
            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🌾 碳水</span>
                <span className="scale-90 origin-right">{progressCarbs}%</span>
              </div>
              <progress className="progress progress-info w-full h-1" value={progressCarbs} max="100"></progress>
              <div className="flex items-baseline font-mono text-text-main mt-0.5">
                <span className="font-bold text-[11px] sm:text-xs leading-none">
                  {todayDietLog.actual_carbs_g.toFixed(0)}/{macroTargets.carbs}
                </span>
                <span className="text-[9px] text-text-secondary/70 font-normal font-sans ml-0.5">g</span>
              </div>
            </div>

            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🥩 蛋白</span>
                <span className="scale-90 origin-right">{progressProtein}%</span>
              </div>
              <progress className="progress progress-success w-full h-1" value={progressProtein} max="100"></progress>
              <div className="flex items-baseline font-mono text-text-main mt-0.5">
                <span className="font-bold text-[11px] sm:text-xs leading-none">
                  {todayDietLog.actual_protein_g.toFixed(0)}/{macroTargets.protein}
                </span>
                <span className="text-[9px] text-text-secondary/70 font-normal font-sans ml-0.5">g</span>
              </div>
            </div>

            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🥑 脂肪</span>
                <span className="scale-90 origin-right">{progressFat}%</span>
              </div>
              <progress className="progress progress-warning w-full h-1" value={progressFat} max="100"></progress>
              <div className="flex items-baseline font-mono text-text-main mt-0.5">
                <span className="font-bold text-[11px] sm:text-xs leading-none">
                  {todayDietLog.actual_fat_g.toFixed(0)}/{macroTargets.fat}
                </span>
                <span className="text-[9px] text-text-secondary/70 font-normal font-sans ml-0.5">g</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const currentKcal = entryMode === 'ratio'
      ? (parseFloat(actCalories) || 0)
      : ((parseFloat(actCarbs) || 0) * 4 + (parseFloat(actProtein) || 0) * 4 + (parseFloat(actFat) || 0) * 9);

    return (
      <div className="card flex flex-col gap-3">
        <div className="flex justify-between items-center select-none mb-1">
          <span className="flex items-center gap-1.5 text-base md:text-lg font-bold text-text-main dark:text-text-main-dark">
            <Utensils size={15} className="text-orange-500 animate-pulse" />
            <span>录入今日饮食对账</span>
          </span>
          {todayDietLog && (
            <button
              type="button"
              className="btn-aux text-text-secondary bg-transparent hover:bg-bg-hover dark:hover:bg-bg-hover-dark font-bold"
              onClick={() => setIsEditingDiet(false)}
            >
              取消
            </button>
          )}
        </div>

        <form onSubmit={handleSaveDiet} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="form-control">
              <label className="section-subtitle">今天性质</label>
              <select
                value={activeDayType}
                onChange={(e) => setLocalDayType(e.target.value)}
                className="select-standard"
              >
                <option value="strength_day">力训日 (TDEE较多)</option>
                <option value="rest_day">休息日 (TDEE较少)</option>
              </select>
            </div>
            <div className="form-control">
              <label className="section-subtitle">录入模式</label>
              <select
                value={entryMode}
                onChange={(e) => setEntryMode(e.target.value)}
                className="select-standard"
              >
                <option value="grams">克数直录 (Carbs/Pro/Fat)</option>
                <option value="ratio">比例折算 (热量加占比)</option>
              </select>
            </div>
          </div>

          {entryMode === 'grams' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="section-subtitle text-center">碳水 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.carbs}g`}
                  value={actCarbs}
                  onChange={(e) => setActCarbs(e.target.value)}
                  className="input-standard text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="section-subtitle text-center">蛋白 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.protein}g`}
                  value={actProtein}
                  onChange={(e) => setActProtein(e.target.value)}
                  className="input-standard text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="section-subtitle text-center">脂肪 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.fat}g`}
                  value={actFat}
                  onChange={(e) => setActFat(e.target.value)}
                  className="input-standard text-center"
                />
              </div>
            </div>
          ) : (
            <div className="form-control w-full">
              <label className="section-subtitle">实际消耗总热量 (kcal)</label>
              <input
                type="number"
                placeholder={`今日预算 ${macroTargets.calories} kcal`}
                value={actCalories}
                onChange={(e) => setActCalories(e.target.value)}
                className="input-standard"
              />
            </div>
          )}

          <div className="bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl p-2.5 border border-border-card/40 flex justify-between items-center text-xs text-text-secondary select-none">
            <span>
              已录热量合计: <strong className="font-mono text-text-main text-sm">{Math.round(currentKcal)}</strong> kcal
            </span>
            <span>
              目标偏差:{' '}
              <strong className={`font-mono text-sm ${currentKcal > macroTargets.calories ? 'text-amber-500' : 'text-green-500'}`}>
                {currentKcal > macroTargets.calories
                  ? `+${Math.round(currentKcal - macroTargets.calories)}`
                  : `-${Math.round(macroTargets.calories - currentKcal)}`
                }{' '}
                kcal
              </strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={savingDiet}
            className="btn-main w-full"
          >
            {savingDiet && <Loader2 className="animate-spin" size={12} />}
            <span>{savingDiet ? '正在对账...' : '提交今日对账'}</span>
          </button>

          {dietError && (
            <p className="text-xs font-bold text-center text-error">{dietError}</p>
          )}
        </form>
      </div>
    );
  };

  // BMI/WHtR 评估计算辅助函数已由 healthUtils 导入

  const liveBmi = useMemo(() => {
    if (!weight || !userProfile?.height_cm) return null;
    const wVal = parseFloat(weight);
    return isNaN(wVal) ? null : getBmiInfo(wVal, userProfile.height_cm);
  }, [weight, userProfile]);

  const liveWhtr = useMemo(() => {
    if (!waist || !userProfile?.height_cm) return null;
    const wVal = parseFloat(waist);
    return isNaN(wVal) ? null : getWhtrInfo(wVal, userProfile.height_cm);
  }, [waist, userProfile]);

  // 保存今日快捷身体指标
  const handleSaveBody = async (e) => {
    e.preventDefault();
    const wVal = parseFloat(weight);
    if (isNaN(wVal) || wVal <= 0) {
      setBodyError('请填写有效的体重数值');
      return;
    }
    setSavingBody(true);
    setBodyError('');
    try {
      const d = new Date();
      const todayISOString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = {
        date: todayISOString,
        weight_kg: wVal,
        waist_cm: parseFloat(waist) || null,
        heart_rate: parseInt(hr, 10) || null,
        sleep_hours: parseFloat(sleep) || null,
        fatigue_rating: parseInt(fatigue, 10) || null,
        updated_at: new Date().toISOString()
      };

      await saveBodyMetrics(entry);

      setIsEditingBody(false);
      if (onRefreshBodyMetrics) {
        await onRefreshBodyMetrics();
      }
    } catch (err) {
      setBodyError('保存失败：' + err.message);
    } finally {
      setSavingBody(false);
    }
  };

  const renderBodyCard = () => {
    const hasData = todayBodyMetrics && !isEditingBody;

    if (hasData) {
      const bmi = userProfile?.height_cm ? getBmiInfo(todayBodyMetrics.weight_kg, userProfile.height_cm) : null;
      const whtr = userProfile?.height_cm && todayBodyMetrics.waist_cm ? getWhtrInfo(todayBodyMetrics.waist_cm, userProfile.height_cm) : null;
      const fatigueLabels = {
        1: '充沛', 2: '充沛', 3: '充沛',
        4: '一般', 5: '一般', 6: '一般', 7: '一般',
        8: '疲惫', 9: '疲惫', 10: '疲惫'
      };
      const fatigueText = fatigueLabels[todayBodyMetrics.fatigue_rating] || '一般';
      const fatigueColor = todayBodyMetrics.fatigue_rating >= 8
        ? 'text-red-500'
        : todayBodyMetrics.fatigue_rating <= 3
          ? 'text-green-500'
          : 'text-amber-500';

      return (
        <div className="card flex flex-col gap-3.5 border border-success/20 dark:border-success/30">
          <div className="flex justify-between items-center mb-1 select-none">
            <span className="flex items-center gap-1.5 text-base md:text-lg font-bold text-text-main dark:text-text-main-dark">
              <Heart size={16} className="text-red-500" /><span>今日身体状态</span>
            </span>
            <button
              type="button"
              className="btn-aux text-primary bg-transparent hover:bg-bg-hover dark:hover:bg-bg-hover-dark font-bold"
              onClick={startEditingBody}
            >
              修改记录
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs"><Scale size={12} className="inline mr-0.5" />体重</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.weight_kg.toFixed(1)} <small className="text-xs font-bold text-text-secondary">kg</small>
              </strong>
              {bmi && (
                <span className={`badge badge-sm font-black mt-1 py-0.5 max-w-max rounded text-[10px] sm:text-xs ${bmi.badgeColor}`}>
                  BMI: {bmi.bmi} · {bmi.label}
                </span>
              )}
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs"><Ruler size={12} className="inline mr-0.5" />腰围</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.waist_cm ? `${todayBodyMetrics.waist_cm.toFixed(1)} cm` : '未录入'}
              </strong>
              {whtr && (
                <span className={`badge badge-sm font-black mt-1 py-0.5 max-w-max rounded text-[10px] sm:text-xs ${whtr.badgeColor}`}>
                  WHtR: {whtr.whtr} · {whtr.label}
                </span>
              )}
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs"><Heart size={12} className="inline mr-0.5" />静息心率</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.heart_rate ? `${todayBodyMetrics.heart_rate} bpm` : '未录入'}
              </strong>
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs"><Moon size={12} className="inline mr-0.5" />睡眠 & <Zap size={12} className="inline mr-0.5" />疲劳</span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono">
                  {todayBodyMetrics.sleep_hours ? `${todayBodyMetrics.sleep_hours.toFixed(1)} h` : '未录入'}
                </span>
                <span className="font-bold text-xs text-text-secondary">
                  疲劳度:{' '}
                  <span className={`font-extrabold ${fatigueColor}`}>
                    {todayBodyMetrics.fatigue_rating || '-'}/10 ({fatigueText})
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1 select-none">
          <span className="flex items-center gap-1.5 text-base md:text-lg font-bold text-text-main dark:text-text-main-dark">
            <Heart size={16} className="text-red-500 animate-pulse" /><span>今日身体状态打卡</span>
          </span>
          {todayBodyMetrics && (
            <button
              type="button"
              className="btn-aux text-text-secondary bg-transparent hover:bg-bg-hover dark:hover:bg-bg-hover-dark font-bold"
              onClick={() => setIsEditingBody(false)}
            >
              取消
            </button>
          )}
        </div>

        <form onSubmit={handleSaveBody} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none">
                <label className="section-subtitle">体重 (kg) *</label>
                {liveBmi && (
                  <span className={`badge badge-sm font-black scale-90 origin-right rounded ${liveBmi.badgeColor} text-xs`}>
                    {liveBmi.label}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.1"
                placeholder="体重 kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="input-standard"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none">
                <label className="section-subtitle">腰围 (cm)</label>
                {liveWhtr && (
                  <span className={`badge badge-sm font-black scale-90 origin-right rounded ${liveWhtr.badgeColor} text-xs`}>
                    {liveWhtr.label}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.5"
                placeholder="腰围 cm"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                className="input-standard"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="section-subtitle">静息心率 (bpm)</label>
              <input
                type="number"
                step="1"
                placeholder="心率 bpm"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                className="input-standard"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="section-subtitle">睡眠时长 (h)</label>
              <input
                type="number"
                step="0.5"
                placeholder="睡眠 h"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="input-standard"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="section-subtitle flex items-center gap-1">
              <Zap size={11} />主观疲劳度 (1 - 10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={fatigue}
              onChange={(e) => setFatigue(e.target.value)}
              className="range range-primary range-xs cursor-pointer"
            />
            <div className="flex justify-between text-xs text-text-secondary/40 font-mono font-bold px-1 select-none">
              <span role="button" tabIndex={0} aria-label="疲劳度设为1" className="cursor-pointer hover:text-primary transition-colors" onClick={() => setFatigue('1')} onKeyDown={(e) => { if (e.key === 'Enter') setFatigue('1'); }}>充沛 1</span>
              <span role="button" tabIndex={0} aria-label="疲劳度设为5" className="cursor-pointer hover:text-primary transition-colors" onClick={() => setFatigue('5')} onKeyDown={(e) => { if (e.key === 'Enter') setFatigue('5'); }}>5</span>
              <span role="button" tabIndex={0} aria-label="疲劳度设为10" className="cursor-pointer hover:text-primary transition-colors" onClick={() => setFatigue('10')} onKeyDown={(e) => { if (e.key === 'Enter') setFatigue('10'); }}>疲惫 10</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingBody}
            className="btn-main w-full"
          >
            {savingBody && <Loader2 className="animate-spin" size={12} />}
            <span>{savingBody ? '正在保存...' : '保存今日身体数据'}</span>
          </button>

          {bodyError && (
            <p className="text-[11px] font-bold text-center text-error">{bodyError}</p>
          )}
        </form>
      </div>
    );
  };

  const skipReasons = [
    { value: 'fatigue', label: '身体疲劳' },
    { value: 'injury', label: '轻微受伤' },
    { value: 'travel', label: '出差/旅行' },
    { value: 'illness', label: '生病' },
    { value: 'busy', label: '事务繁忙' },
    { value: 'other', label: '其他原因' },
  ];

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  // 无活跃计划 → 引导去计划库
  if (!activeProgram) {
    return (
      <div className="flex flex-col gap-8 animate-fadeIn">
        <div className="mb-2">
          <h2 className="page-header">今日</h2>
          <p className="page-header-desc flex items-center gap-2 mt-2 select-none">
            <Calendar size={16} className="opacity-70 text-primary" />
            <span>{getFormattedDate()}</span>
          </p>
        </div>

        <div className="card hover:border-primary/30 transition-all duration-200 cursor-pointer" onClick={onGoToLibrary}>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <ClipboardList size={48} className="text-text-secondary/40" />
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">选择一个训练计划</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-xs">
              从计划库中选择一个适合你的训练计划，配置好参数就可以开始训练了。
            </p>
            <button type="button" className="btn-main px-6 max-w-max">
              浏览计划库 <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {renderBodyCard()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* 头部 */}
      <div>
        <h2 className="page-header">今日</h2>
        <p className="page-header-desc flex items-center gap-2 select-none">
          <Calendar size={16} className="opacity-70 text-primary" />
          <span>{getFormattedDate()}</span>
        </p>
      </div>

      {/* 计划切换器（多个活跃计划时） */}
      {activeUserPrograms.length > 1 && (
        <div className="relative">
          <button type="button"
            className="btn-aux text-text-main dark:text-text-main-dark font-bold text-xs"
            onClick={() => setShowProgramSwitcher(prev => !prev)}
          >
            {activeProgram.name} <ChevronDown size={14} />
          </button>
          {showProgramSwitcher && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-xl shadow-lg p-2 min-w-[160px]">
              {activeUserPrograms.map(up => {
                const prog = programs.find(p => p.id === up.program_id);
                if (!prog) return null;
                const isActive = up.id === activeUserProgram?.id;
                return (
                  <button key={up.id} type="button"
                    className={`btn btn-sm btn-ghost w-full justify-start font-bold text-xs cursor-pointer ${isActive ? 'text-primary' : ''}`}
                    onClick={() => { onSwitchProgram(up.id); setShowProgramSwitcher(false); }}
                  >
                    {prog.name} {isActive && '✓'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* 下周一开启减载提示条 */}
        {(() => {
          if (!activeUserProgram) return null;
          const gdState = activeUserProgram.program_state?.global_deload || {};
          const gdConfig = activeUserProgram.exercise_config?._global_deload || {};
          if (gdConfig.trigger_type !== 'weeks') return null;
          if (gdState.status !== 'active') return null;
          if (gdState.postponed_until) return null;
          if (!gdState.active_start_at) return null;
          
          const startDiffDays = Math.floor((new Date() - new Date(gdState.active_start_at)) / (1000 * 60 * 60 * 24));
          if (startDiffDays > 5) return null;

          return (
            <div className="alert-box !bg-yellow-500/10 dark:!bg-yellow-500/5 !border-yellow-500/30 !text-amber-600 dark:!text-amber-500 border-l-4 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs select-none">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="shrink-0 mt-0.5" size={16} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm">计划减载提醒</span>
                  <span className="text-xs leading-normal opacity-90">
                    按照计划，本周起已自动开启减载周期。如果您想正常进行本周训练并延迟减载，可选择：
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-outline border-amber-600/30 dark:border-amber-500/30 text-amber-600 dark:text-amber-500 font-bold hover:bg-amber-600/10 shrink-0 self-end sm:self-auto cursor-pointer rounded-lg px-2.5 h-7"
                onClick={() => {
                  const today = new Date();
                  const dayOfWeek = today.getDay();
                  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
                  const nextMonday = new Date(today.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000);
                  nextMonday.setHours(0, 0, 0, 0);
                  onTriggerDeload('inactive', nextMonday.toISOString(), false);
                }}
              >
                从下周一开启减载
              </button>
            </div>
          );
        })()}

        {/* 已完成 */}
        {isTodayCompleted ? (
          <div className="flex flex-col gap-3">
            <WorkoutSessionSummary
              workouts={todayWorkoutSummary}
              getExerciseCNName={getExerciseCNName}
              title="今日训练总结"
              latestOnly
              compact
            />
            {/* 手动减载按钮 (从下次开始) */}
            {activeUserProgram && !isSessionActive && (
              <button
                type="button"
                className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-dashed select-none cursor-pointer ${
                  activeUserProgram.program_state?.global_deload?.pending_next_session
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                    : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                }`}
                onClick={() => {
                  const gdState = activeUserProgram.program_state?.global_deload || {};
                  if (gdState.pending_next_session) {
                    onTriggerDeload('inactive', null, false);
                  } else {
                    onTriggerDeload('inactive', null, true);
                  }
                }}
              >
                <RotateCcw size={14} />
                <span>
                  {activeUserProgram.program_state?.global_deload?.pending_next_session
                    ? '取消预设下次减载'
                    : '从下次开始减载 (下次训练自动减量)'}
                </span>
              </button>
            )}
          </div>
        ) : daysUntilStart > 0 ? (
          /* 尚未开始 */
          <div className="card !border-primary/20 dark:!border-primary/30">
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
              <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">未开始</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">计划尚未开始</span>
              {activeProgram && (
                <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                  {activeProgram.name}
                </span>
              )}
            </div>
            <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />
            <div className="flex flex-col items-center text-center gap-3 select-none py-4">
              <Calendar className="text-primary" size={48} />
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                距离开始还有 <span className="text-primary font-bold text-lg">{daysUntilStart}</span> 天
              </p>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                耐心等待，养精蓄锐，届时全力以赴！
              </p>
            </div>
          </div>
        ) : isRestDay ? (
          /* 休息日 */
          <div className="card !border-green-500/10 dark:!border-green-500/20">
            <div className="flex justify-between items-center mb-3 select-none">
              <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
              <span className="text-xs font-extrabold tracking-wider text-text-secondary dark:text-text-secondary-dark uppercase opacity-70">Rest & Recover</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">休息日</span>
              <span className="badge badge-ghost font-bold text-xs"><Pause size={10} className="inline mr-0.5" />休息日</span>
              {activeProgram && (
                <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                  {activeProgram.name}
                </span>
              )}
            </div>
            <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark mb-2">让肌肉充分修复</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
              合理的修整是超量恢复的基石。给肌肉充足的时间重整肌纤维，你将在下一次训练中更加强大！
            </p>
            <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-1 select-none">
              <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">下次训练日程</span>
              <strong className="text-lg font-extrabold text-primary mt-0.5">{nextTrainingDate || '未设定'}</strong>
            </div>

            {/* 手动减载按钮 (从下次开始) */}
            {activeUserProgram && !isSessionActive && (
              <button
                type="button"
                className={`w-full mt-3 h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-dashed select-none cursor-pointer ${
                  activeUserProgram.program_state?.global_deload?.pending_next_session
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                    : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                }`}
                onClick={() => {
                  const gdState = activeUserProgram.program_state?.global_deload || {};
                  if (gdState.pending_next_session) {
                    onTriggerDeload('inactive', null, false);
                  } else {
                    onTriggerDeload('inactive', null, true);
                  }
                }}
              >
                <RotateCcw size={14} />
                <span>
                  {activeUserProgram.program_state?.global_deload?.pending_next_session
                    ? '取消预设下次减载'
                    : '从下次开始减载 (下次训练自动减量)'}
                </span>
              </button>
            )}
          </div>
        ) : todayWorkout && todayWorkout.exercises ? (
          /* 今日训练 */
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="card hover:border-primary/30 transition-all duration-200 cursor-pointer text-left w-full"
              onClick={onOpenPreview}
            >
              <div className="flex justify-between items-center mb-3 select-none">
                <span className="badge badge-primary badge-outline font-bold text-sm">今日安排</span>
                <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">点击查看详情 →</span>
              </div>

              {/* Day 标签 + 状态徽章 + 计划名 一行 */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark">
                  {todayWorkout ? `${todayWorkout.dayLabel} 训练日` : '休息日'}
                </span>
                {isSessionActive && (
                  <span className="badge badge-warning badge-outline font-bold text-xs gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                    进行中
                  </span>
                )}
                {!isSessionActive && isTodayCompleted && (
                  <span className="badge badge-success badge-outline font-bold text-xs">🎉 已完成</span>
                )}
                {!isSessionActive && !isTodayCompleted && (
                  <span className="badge badge-primary badge-outline font-bold text-xs"><Zap size={10} className="inline mr-0.5" />训练日</span>
                )}
                {activeProgram && (
                  <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                    {activeProgram.name}
                  </span>
                )}
              </div>

              <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />
              <WorkoutSummary exercises={todayWorkout?.exercises || []} />
            </button>

            {/* 卡片下方：开始训练 + 跳过 */}
            {!isSessionActive && (
              <div className="flex flex-col gap-2">
                <Button
                  fullWidth
                  size="lg"
                  leftIcon={<Play size={18} fill="currentColor" />}
                  onClick={onStartTrain}
                >
                  开始今日训练 ({todayWorkout?.dayLabel || ''})
                </Button>
                <button type="button"
                  className="btn-sec w-full"
                  onClick={() => setShowSkipModal(true)}
                >
                  <SkipForward size={16} />
                  <span>跳过今日训练（自动顺延）</span>
                </button>

                {/* 手动减载按钮 (从本次开始) */}
                {activeUserProgram && (
                  <button
                    type="button"
                    className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-dashed select-none cursor-pointer ${
                      activeUserProgram.program_state?.global_deload?.status === 'active'
                        ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                        : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                    }`}
                    onClick={() => {
                      const gdState = activeUserProgram.program_state?.global_deload || {};
                      if (gdState.status === 'active') {
                        onTriggerDeload('inactive', null, false, true);
                      } else {
                        onTriggerDeload('active', null, false);
                      }
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>
                      {activeUserProgram.program_state?.global_deload?.status === 'active'
                        ? '取消本次减载 (回归常规强度)'
                        : '从本次开始减载 (今日下发减量强度)'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {isSessionActive && (
              <button type="button"
                className="btn-main w-full animate-bounce"
                onClick={onStartTrain}
              >
                <RotateCcw size={18} />
                <span>恢复进行中的训练</span>
              </button>
            )}
          </div>
        ) : (
          /* 计划存在但无今日训练数据 */
          <div className="card opacity-70">
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center py-4">
              暂无训练安排
            </p>
          </div>
        )}

        {/* 过度训练警报 */}
        {(() => {
          if (!activeUserProgram) return null;
          const gdState = activeUserProgram.program_state?.global_deload || {};
          const lastCompletedStr = gdState.last_deload_completed_at || activeUserProgram.program_state?.start_date || activeUserProgram.created_at;
          if (!lastCompletedStr) return null;
          
          const elapsedDays = Math.floor((new Date() - new Date(lastCompletedStr)) / (1000 * 60 * 60 * 24));
          if (elapsedDays < 56 || gdState.status === 'active') return null;

          return (
            <div className="alert-box !bg-bg-alert dark:!bg-bg-alert-dark !border-alert dark:!border-alert-dark !text-alert dark:!text-alert-dark border-l-4 p-4 rounded-xl flex items-start gap-2.5 shadow-xs select-none">
              <RotateCcw className="shrink-0 mt-0.5" size={16} />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">过度训练风险预警</span>
                <span className="text-xs leading-normal opacity-90">
                  您已连续高强度训练超过 8 周未进行减载。CNS（中枢神经）疲劳与关节累积压力可能会降低训练效果并增加受伤风险，建议手动开启一次减载期以促进恢复。
                </span>
              </div>
            </div>
          );
        })()}

        {renderBodyCard()}

        {renderDietCard()}
      </div>

      {/* 底部按钮 - 休息日加练入口（仅休息日仍保留在底部） */}
      {!isTodayCompleted && isRestDay && !isSessionActive && (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-sec w-full cursor-not-allowed bg-bg-hover dark:bg-bg-hover-dark opacity-60 border-0">
            今日休息中，合理恢复
          </button>
          <button type="button"
            className="btn-sec w-full"
            onClick={() => setShowExtraModal(true)}
          >
            <Flag size={16} />
            <span>今天想加练？</span>
          </button>
        </div>
      )}

      {/* 跳过训练确认弹窗 */}
      {showSkipModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">跳过今日训练</h3>
            <p className="py-2 text-sm text-text-secondary">跳过今天后，训练计划将自动顺延。请记录跳过原因，这将帮助 AI 为你提供更好的建议。</p>
            <div className="flex flex-col gap-2 py-2">
              <span className="text-xs font-semibold text-text-secondary">跳过原因</span>
              <div className="flex flex-wrap gap-2">
                {skipReasons.map(reason => (
                  <button key={reason.value} type="button"
                    className={`btn btn-sm ${skipReason === reason.value ? 'btn-primary' : 'btn-ghost border border-border-card'}`}
                    onClick={() => setSkipReason(reason.value)}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-action">
              <button className="btn-sec px-5" onClick={() => { setShowSkipModal(false); setSkipReason(''); }}>取消</button>
              <button className="btn-main px-5" onClick={() => { onSkipTraining(skipReason); setShowSkipModal(false); setSkipReason(''); }}>确认跳过</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setShowSkipModal(false); setSkipReason(''); }}>close</button>
          </form>
        </dialog>
      )}

      {/* 加练确认弹窗 */}
      {showExtraModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">今天想加练？</h3>
            <p className="py-4 text-sm text-text-secondary">今天是休息日，加练会影响恢复。确定要开始吗？点击确认后将进入训练打卡界面。</p>
            <div className="modal-action">
              <button className="btn-sec px-5" onClick={() => setShowExtraModal(false)}>取消</button>
              <button className="btn-main px-5" onClick={() => { onExtraTraining(); setShowExtraModal(false); }}>确认加练</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowExtraModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

export default TodayScreen;
