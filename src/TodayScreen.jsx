import { useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { calcCalorieBudget, calcMacronutrientTargets } from './dietUtils';
import { Play, RotateCcw, CheckCircle, Heart, Utensils, Calendar, ChevronDown, ArrowRight, SkipForward, Flag, Loader2, Zap } from 'lucide-react';

const TIER_COLORS = {
  T1: { bg: 'bg-tier-t1/10', text: 'text-tier-t1', darkText: 'dark:text-tier-t1-dark', border: 'border-tier-t1/20', darkBorder: 'dark:border-tier-t1-dark/20' },
  T2: { bg: 'bg-tier-t2/10', text: 'text-tier-t2', darkText: 'dark:text-tier-t2-dark', border: 'border-tier-t2/20', darkBorder: 'dark:border-tier-t2-dark/20' },
  T3: { bg: 'bg-tier-t3/10', text: 'text-tier-t3', darkText: 'dark:text-tier-t3-dark', border: 'border-tier-t3/20', darkBorder: 'dark:border-tier-t3-dark/20' },
};

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
  onRefreshBodyMetrics
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

      const { data: existing, error: queryErr } = await supabase
        .from('diet_logs')
        .select('id')
        .eq('date', todayISOString)
        .limit(1);

      if (queryErr) throw queryErr;

      let saveErr;
      if (existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from('diet_logs')
          .update(entry)
          .eq('id', existing[0].id);
        saveErr = updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('diet_logs')
          .insert([entry]);
        saveErr = insertErr;
      }

      if (saveErr) throw saveErr;

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
          <div className="flex justify-between items-center select-none">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-text-main dark:text-text-main-dark">
              <Utensils size={15} className="text-orange-500" />
              <span>今日饮食对账</span>
              <span className="badge badge-outline badge-xs text-[11px] font-extrabold rounded-md border-primary/30 text-primary">
                {isStrengthDay ? '力训日 🏋️' : '休息日 ☕'}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-primary font-bold cursor-pointer hover:bg-bg-hover"
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

          <div className="grid grid-cols-3 gap-2.5 text-xs leading-relaxed">
            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🌾 碳水</span>
                <span>{progressCarbs}%</span>
              </div>
              <progress className="progress progress-info w-full h-1" value={progressCarbs} max="100"></progress>
              <span className="font-mono font-bold text-text-main mt-0.5 text-xs">
                {todayDietLog.actual_carbs_g.toFixed(0)} / {macroTargets.carbs}g
              </span>
            </div>

            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🥩 蛋白</span>
                <span>{progressProtein}%</span>
              </div>
              <progress className="progress progress-success w-full h-1" value={progressProtein} max="100"></progress>
              <span className="font-mono font-bold text-text-main mt-0.5 text-xs">
                {todayDietLog.actual_protein_g.toFixed(0)} / {macroTargets.protein}g
              </span>
            </div>

            <div className="bg-bg-main/15 dark:bg-bg-main-dark/15 p-2 rounded-lg border border-border-card/25 flex flex-col gap-1">
              <div className="flex justify-between items-center font-bold text-text-secondary select-none">
                <span>🥑 脂肪</span>
                <span>{progressFat}%</span>
              </div>
              <progress className="progress progress-warning w-full h-1" value={progressFat} max="100"></progress>
              <span className="font-mono font-bold text-text-main mt-0.5 text-xs">
                {todayDietLog.actual_fat_g.toFixed(0)} / {macroTargets.fat}g
              </span>
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
        <div className="flex justify-between items-center select-none mb-0.5">
          <span className="flex items-center gap-1.5 text-base font-extrabold text-text-main dark:text-text-main-dark">
            <Utensils size={15} className="text-orange-500 animate-pulse" />
            <span>录入今日饮食对账</span>
          </span>
          {todayDietLog && (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-text-secondary font-bold rounded cursor-pointer"
              onClick={() => setIsEditingDiet(false)}
            >
              取消
            </button>
          )}
        </div>

        <form onSubmit={handleSaveDiet} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="form-control">
              <label className="label py-0.5 text-xs font-bold text-text-secondary select-none">今天性质</label>
              <select
                value={activeDayType}
                onChange={(e) => setLocalDayType(e.target.value)}
                className="select select-bordered select-sm w-full h-9 bg-bg-main/10 border-border-card text-xs font-bold focus:outline-none"
              >
                <option value="strength_day">力训日 (TDEE较多)</option>
                <option value="rest_day">休息日 (TDEE较少)</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0.5 text-xs font-bold text-text-secondary select-none">录入模式</label>
              <select
                value={entryMode}
                onChange={(e) => setEntryMode(e.target.value)}
                className="select select-bordered select-sm w-full h-9 bg-bg-main/10 border-border-card text-xs font-bold focus:outline-none"
              >
                <option value="grams">克数直录 (Carbs/Pro/Fat)</option>
                <option value="ratio">比例折算 (热量加占比)</option>
              </select>
            </div>
          </div>

          {entryMode === 'grams' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary select-none">碳水 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.carbs}g`}
                  value={actCarbs}
                  onChange={(e) => setActCarbs(e.target.value)}
                  className="input input-bordered w-full h-10 text-sm font-mono font-bold text-center bg-bg-main/20 border-border-card focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary select-none">蛋白 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.protein}g`}
                  value={actProtein}
                  onChange={(e) => setActProtein(e.target.value)}
                  className="input input-bordered w-full h-10 text-sm font-mono font-bold text-center bg-bg-main/20 border-border-card focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary select-none">脂肪 (g)</label>
                <input
                  type="number"
                  placeholder={`目标 ${macroTargets.fat}g`}
                  value={actFat}
                  onChange={(e) => setActFat(e.target.value)}
                  className="input input-bordered w-full h-10 text-sm font-mono font-bold text-center bg-bg-main/20 border-border-card focus:border-primary"
                />
              </div>
            </div>
          ) : (
            <div className="form-control w-full">
              <label className="text-xs font-bold text-text-secondary select-none">实际消耗总热量 (kcal)</label>
              <input
                type="number"
                placeholder={`今日预算 ${macroTargets.calories} kcal`}
                value={actCalories}
                onChange={(e) => setActCalories(e.target.value)}
                className="input input-bordered w-full h-10 text-sm font-mono font-bold bg-bg-main/20 border-border-card focus:border-primary"
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
            className="btn btn-primary btn-sm btn-block font-bold shadow-sm cursor-pointer"
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

  // BMI/WHtR 评估计算辅助函数
  const getBmiInfo = (w, h) => {
    if (!w || !h) return null;
    const bmi = w / ((h / 100) ** 2);
    let label = '标准';
    let badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
    if (bmi < 18.5) {
      label = '偏瘦';
      badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    } else if (bmi < 24) {
      label = '标准';
      badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
    } else if (bmi < 28) {
      label = '超重';
      badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    } else {
      label = '肥胖';
      badgeColor = 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    return { bmi: bmi.toFixed(1), label, badgeColor };
  };

  const getWhtrInfo = (waistCm, heightCm) => {
    if (!waistCm || !heightCm) return null;
    const whtr = waistCm / heightCm;
    let label = '理想';
    let badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
    if (whtr < 0.46) {
      label = '消瘦';
      badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    } else if (whtr < 0.51) {
      label = '理想';
      badgeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
    } else if (whtr < 0.57) {
      label = '超重';
      badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    } else {
      label = '腹部肥胖';
      badgeColor = 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    return { whtr: whtr.toFixed(3), label, badgeColor };
  };

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

      const { data: existing, error: queryErr } = await supabase
        .from('body_metrics')
        .select('id')
        .eq('date', todayISOString)
        .limit(1);

      if (queryErr) throw queryErr;

      let saveErr;
      if (existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from('body_metrics')
          .update(entry)
          .eq('id', existing[0].id);
        saveErr = updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('body_metrics')
          .insert([entry]);
        saveErr = insertErr;
      }

      if (saveErr) throw saveErr;

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
            <span className="flex items-center gap-1.5 text-base font-extrabold text-text-main dark:text-text-main-dark">
              <Heart size={16} className="text-red-500" /><span>今日身体状态</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-primary font-bold cursor-pointer hover:bg-bg-hover dark:hover:bg-bg-hover-dark rounded"
              onClick={startEditingBody}
            >
              修改记录
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs">⚖️ 体重</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.weight_kg.toFixed(1)} <small className="text-xs font-bold text-text-secondary">kg</small>
              </strong>
              {bmi && (
                <span className={`badge badge-sm font-black mt-1 py-0.5 max-w-max rounded text-xs ${bmi.badgeColor}`}>
                  BMI: {bmi.bmi} · {bmi.label}
                </span>
              )}
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs">📏 腰围</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.waist_cm ? `${todayBodyMetrics.waist_cm.toFixed(1)} cm` : '未录入'}
              </strong>
              {whtr && (
                <span className={`badge badge-sm font-black mt-1 py-0.5 max-w-max rounded text-xs ${whtr.badgeColor}`}>
                  WHtR: {whtr.whtr} · {whtr.label}
                </span>
              )}
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs">💓 静息心率</span>
              <strong className="text-lg font-extrabold text-text-main dark:text-text-main-dark font-mono mt-0.5">
                {todayBodyMetrics.heart_rate ? `${todayBodyMetrics.heart_rate} bpm` : '未录入'}
              </strong>
            </div>

            <div className="bg-bg-main/20 dark:bg-bg-main-dark/20 p-2.5 rounded-xl border border-border-card/30 flex flex-col justify-center">
              <span className="text-text-secondary/70 font-semibold select-none text-xs">🛌 睡眠 & ⚡ 疲劳</span>
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
          <span className="flex items-center gap-1.5 text-base font-extrabold text-text-main dark:text-text-main-dark">
            <Heart size={16} className="text-red-500 animate-pulse" /><span>今日身体状态打卡</span>
          </span>
          {todayBodyMetrics && (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-text-secondary font-bold rounded cursor-pointer"
              onClick={() => setIsEditingBody(false)}
            >
              取消
            </button>
          )}
        </div>

        <form onSubmit={handleSaveBody} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none text-xs font-bold text-text-secondary">
                <label>体重 (kg) *</label>
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
                className="input input-bordered w-full h-10 text-sm font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none text-xs font-bold text-text-secondary">
                <label>腰围 (cm)</label>
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
                className="input input-bordered w-full h-10 text-sm font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary select-none">静息心率 (bpm)</label>
              <input
                type="number"
                step="1"
                placeholder="心率 bpm"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                className="input input-bordered w-full h-10 text-sm font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary select-none">睡眠时长 (h)</label>
              <input
                type="number"
                step="0.5"
                placeholder="睡眠 h"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="input input-bordered w-full h-10 text-sm font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-secondary flex items-center gap-1 select-none">
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
              <span>充沛 1</span><span>5</span><span>疲惫 10</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingBody}
            className="btn btn-primary btn-sm btn-block font-bold shadow-sm cursor-pointer"
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
          <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">今日</h2>
          <p className="text-base text-text-secondary dark:text-text-secondary-dark flex items-center gap-2 mt-2 select-none">
            <Calendar size={16} className="opacity-70 text-primary" />
            <span>{getFormattedDate()}</span>
          </p>
        </div>

        <div className="card hover:border-primary/30 transition-all duration-200 cursor-pointer" onClick={onGoToLibrary}>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <span className="text-4xl">📋</span>
            <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">选择一个训练计划</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-xs">
              从计划库中选择一个适合你的训练计划，配置好参数就可以开始训练了。
            </p>
            <button type="button" className="btn btn-primary btn-sm gap-2 font-bold shadow-md">
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
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">今日</h2>
        <p className="text-base text-text-secondary dark:text-text-secondary-dark flex items-center gap-2 mt-1.5 select-none">
          <Calendar size={16} className="opacity-70 text-primary" />
          <span>{getFormattedDate()}</span>
        </p>
      </div>

      {/* 计划切换器（多个活跃计划时） */}
      {activeUserPrograms.length > 1 && (
        <div className="relative">
          <button type="button"
            className="btn btn-ghost btn-sm gap-2 text-xs font-bold cursor-pointer"
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

        {/* 已完成 */}
        {isTodayCompleted ? (
          <div className="card !border-green-500/20 dark:!border-green-500/30">
            <div className="flex flex-col items-center text-center gap-2.5 mb-5 select-none">
              <CheckCircle className="text-green-500" size={48} />
              <h3 className="text-xl font-bold text-text-main dark:text-text-main-dark">今日训练已完成</h3>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">你今天做得棒极了！以下是训练摘要：</p>
            </div>
            <div className="flex flex-col gap-3.5">
              {todayWorkoutSummary.map((log, idx) => {
                const tc = TIER_COLORS[log.tier] || TIER_COLORS.T1;
                return (
                  <div key={log.id || idx} className={`flex justify-between items-center p-3 rounded-xl border bg-bg-main/20 dark:bg-bg-main-dark/20 ${tc.border} ${tc.darkBorder}`}>
                    <div className="flex items-center gap-2">
                      <span className={`badge font-bold text-xs px-2 py-0.5 rounded ${tc.bg} ${tc.text} ${tc.darkText} ${tc.border} ${tc.darkBorder}`}>
                        {log.tier}
                      </span>
                      <span className="text-base font-bold text-text-main dark:text-text-main-dark">{getExerciseCNName(log.exercise)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-text-main dark:text-text-main-dark bg-bg-hover dark:bg-bg-hover-dark px-2 py-0.5 rounded">
                        {log.weight_kg?.toFixed(1)}kg
                      </span>
                      <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        末组 <span className="text-text-main dark:text-text-main-dark text-base font-bold">{log.actual_last_set_reps}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
              <span className="badge badge-ghost font-bold text-xs">☕ 休息日</span>
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
                  <span className="badge badge-primary badge-outline font-bold text-xs">⚡ 训练日</span>
                )}
                {activeProgram && (
                  <span className="badge badge-outline font-bold text-xs text-text-secondary dark:text-text-secondary-dark">
                    {activeProgram.name}
                  </span>
                )}
              </div>

              <div className="border-t border-border-card/50 dark:border-border-card-dark/50 mb-3" />

              {(() => {
                const exercises = todayWorkout.exercises || [];
                const exCount = exercises.length;
                const totalWeight = exercises.reduce((sum, ex) => sum + ((ex.weight || 0) * (ex.sets || 0)), 0);
                // 估算时长：每组约 90s 组间休息 + 30s 动作
                const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
                const estMinutes = Math.max(15, Math.round(totalSets * 2));
                return (
                  <div className="flex flex-col gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                    <div className="flex items-center gap-2">
                      <span>💪</span>
                      <span><span className="font-bold text-text-main dark:text-text-main-dark">{exCount}</span> 个动作</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🏋️</span>
                      <span>总训练量 <span className="font-bold text-text-main dark:text-text-main-dark font-mono">{totalWeight.toFixed(1)}kg</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>预计耗时 <span className="font-bold text-text-main dark:text-text-main-dark">{estMinutes}</span> 分钟</span>
                    </div>
                  </div>
                );
              })()}
            </button>

            {/* 卡片下方：开始训练 + 跳过 */}
            {!isSessionActive && (
              <div className="flex flex-col gap-2">
                <button type="button"
                  className="btn btn-primary btn-block btn-lg shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                  onClick={onStartTrain}
                >
                  <Play size={18} fill="currentColor" />
                  <span>开始今日训练 ({todayWorkout?.dayLabel || ''})</span>
                </button>
                <button type="button"
                  className="btn btn-ghost btn-block text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold cursor-pointer"
                  onClick={() => setShowSkipModal(true)}
                >
                  <SkipForward size={16} />
                  <span>跳过今日训练（自动顺延）</span>
                </button>
              </div>
            )}

            {isSessionActive && (
              <button type="button"
                className="btn btn-primary btn-block btn-lg shadow-md flex items-center justify-center gap-2 cursor-pointer select-none animate-bounce"
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

        {renderBodyCard()}

        {renderDietCard()}
      </div>

      {/* 底部按钮 - 休息日加练入口（仅休息日仍保留在底部） */}
      {!isTodayCompleted && isRestDay && !isSessionActive && (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn btn-neutral btn-block btn-lg flex items-center justify-center gap-2 border-border-card dark:border-border-card-dark select-none">
            今日休息中，合理恢复
          </button>
          <button type="button"
            className="btn btn-ghost btn-block text-text-secondary dark:text-text-secondary-dark border border-border-card dark:border-border-card-dark font-semibold cursor-pointer"
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
              <button className="btn btn-ghost" onClick={() => { setShowSkipModal(false); setSkipReason(''); }}>取消</button>
              <button className="btn btn-primary" onClick={() => { onSkipTraining(skipReason); setShowSkipModal(false); setSkipReason(''); }}>确认跳过</button>
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
            <p className="py-4 text-sm text-text-secondary">今天是休息日，加练会影响恢复。确定要开始吗？加练后计划将顺延至下一个训练日。</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowExtraModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={() => { onExtraTraining(); setShowExtraModal(false); }}>确认加练</button>
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
