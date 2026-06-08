import { useState, useEffect, useMemo, useCallback } from 'react';
import { Lock, LockOpen, Scale, Settings, Dumbbell, Pause, Zap, Pen, Target, TrendingDown, TrendingUp, Frown, Lightbulb, AlertTriangle, Activity, Inbox, PieChart } from 'lucide-react';
import {
  fetchDietLog,
  saveDietLog,
  deleteDietLog,
  fetchHistoryDietLogs,
  saveUserNutritionConfig
} from './services/dietService';
import {
  calcCalorieBudget,
  calcMacronutrientTargets,
  auditNutritionSafety,
  getAiDietTuneUp
} from './dietUtils';
import {
  AEROBIC_DATA,
  getAerobicKcal,
  formatSubtypeDisplay
} from './aerobicData';
import {
  Utensils, Save, Loader2, Trash2, ShieldAlert,
  Sparkles, Flame, Calendar, FileText, Eye
} from 'lucide-react';

function DietScreen({
  userProfile,
  userNutritionConfig,
  todayBodyMetrics,
  isRestDay,
  onRefreshDiet
}) {
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSliderLocked, setIsSliderLocked] = useState(true);

  // 1. 身体状况参考数据
  const latestWeight = parseFloat(todayBodyMetrics?.weight_kg) || parseFloat(userProfile?.weight_kg) || 70;
  const userHeight = parseFloat(userProfile?.height_cm) || 175;
  const userAge = parseInt(userProfile?.age, 10) || 25;
  const userGender = userProfile?.gender || 'male';

  // 2. 本地配置表单状态
  const [configForm, setConfigForm] = useState({
    neat_tef_factor: 1.10,
    strength_level: 'beginner',
    custom_strength_kcal: 0,
    cardio_weekly_kcal: 0,
    deficit_slider: 0.80,
    plan_type: 'split',
    calc_mode: 'ratio',
    ratio_carbs: 50,
    ratio_protein: 30,
    ratio_fat: 20,
    multiple_config: {
      strength_day: { carbs: 3.0, protein: 2.0, fat: 0.8 },
      rest_day: { carbs: 1.5, protein: 2.0, fat: 0.8 }
    },
    custom_config: {
      strength_day: { carbs: 250, protein: 140, fat: 60 },
      rest_day: { carbs: 180, protein: 140, fat: 50 }
    }
  });

  // 从传入配置同步本地表单状态
  useEffect(() => {
    if (!userNutritionConfig) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setConfigForm({
        neat_tef_factor: parseFloat(userNutritionConfig.neat_tef_factor) || 1.10,
        strength_level: userNutritionConfig.strength_level || 'beginner',
        custom_strength_kcal: parseInt(userNutritionConfig.custom_strength_kcal, 10) || 0,
        cardio_weekly_kcal: parseInt(userNutritionConfig.cardio_weekly_kcal, 10) || 0,
        deficit_slider: parseFloat(userNutritionConfig.deficit_slider) || 0.80,
        plan_type: userNutritionConfig.plan_type || 'split',
        calc_mode: userNutritionConfig.calc_mode || 'ratio',
        ratio_carbs: parseInt(userNutritionConfig.ratio_carbs, 10) || 50,
        ratio_protein: parseInt(userNutritionConfig.ratio_protein, 10) || 30,
        ratio_fat: parseInt(userNutritionConfig.ratio_fat, 10) || 20,
        multiple_config: userNutritionConfig.multiple_config || {
          strength_day: { carbs: 3.0, protein: 2.0, fat: 0.8 },
          rest_day: { carbs: 1.5, protein: 2.0, fat: 0.8 }
        },
        custom_config: userNutritionConfig.custom_config || {
          strength_day: { carbs: 250, protein: 140, fat: 60 },
          rest_day: { carbs: 180, protein: 140, fat: 50 }
        }
      });
    });
    return () => { cancelled = true; };
  }, [userNutritionConfig]);

  // 3. 有氧周消耗计算器状态
  const [aerobicItems, setAerobicItems] = useState(() => {
    try {
      const saved = localStorage.getItem('training_assistant_aerobic_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 提纯大类以供选择
  const categoryMap = useMemo(() => {
    const uniqueRawCats = Array.from(new Set(AEROBIC_DATA.map((a) => a.category)));
    return uniqueRawCats.map(raw => {
      const clean = raw.split('\n')[0].split('*')[0].trim();
      return { raw, clean };
    });
  }, []);

  const initialCategory = categoryMap[0]?.raw || '跑步';
  const [calcCategory, setCalcCategory] = useState(initialCategory);

  const subtypes = useMemo(() => {
    return AEROBIC_DATA.filter(a => a.category === calcCategory).map(a => a.subtype);
  }, [calcCategory]);

  const [calcSubtype, setCalcSubtype] = useState(() => {
    return AEROBIC_DATA.find(a => a.category === initialCategory)?.subtype || '';
  });
  const [calcDuration, setCalcDuration] = useState('');
  const [calcFrequency, setCalcFrequency] = useState('3');

  const handleCalcCategoryChange = (cat) => {
    setCalcCategory(cat);
    const firstSub = AEROBIC_DATA.find(a => a.category === cat)?.subtype || '';
    setCalcSubtype(firstSub);
  };

  const computedCardioKcal = useMemo(() => {
    let weeklySum = 0;
    aerobicItems.forEach(item => {
      const single = getAerobicKcal(item.category, item.subtype, latestWeight, parseFloat(item.duration) || 0);
      weeklySum += single * (parseFloat(item.frequency) || 0);
    });
    return {
      weekly: Math.round(weeklySum),
      daily: Math.round(weeklySum / 7)
    };
  }, [aerobicItems, latestWeight]);

  const handleAddAerobicItem = () => {
    if (!calcDuration || isNaN(parseFloat(calcDuration)) || parseFloat(calcDuration) <= 0) {
      alert(calcSubtype === '每走一万步' ? '请填写有效的步数' : '请填写有效的运动时长');
      return;
    }
    if (!calcFrequency || isNaN(parseFloat(calcFrequency)) || parseFloat(calcFrequency) <= 0) {
      alert('请填写有效的每周频次');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      category: calcCategory,
      subtype: calcSubtype,
      duration: calcDuration,
      frequency: calcFrequency
    };
    const updated = [...aerobicItems, newItem];
    setAerobicItems(updated);
    localStorage.setItem('training_assistant_aerobic_items', JSON.stringify(updated));
    setCalcDuration('');
  };

  const handleRemoveAerobicItem = (id) => {
    const updated = aerobicItems.filter(item => item.id !== id);
    setAerobicItems(updated);
    localStorage.setItem('training_assistant_aerobic_items', JSON.stringify(updated));
  };

  const handleApplyCalculatedCardio = () => {
    setConfigForm(prev => ({
      ...prev,
      cardio_weekly_kcal: computedCardioKcal.weekly
    }));
    setSuccessMsg(`✓ 已将算得的每周有氧消耗 ${computedCardioKcal.weekly} kcal 同步折算到 TDEE 配置！`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // 4. 每日实际摄入对账状态与日志拉取
  const d = new Date();
  const todayDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [auditDate, setAuditDate] = useState(todayDateStr);
  const [auditDayType, setAuditDayType] = useState('strength_day');
  const [isAuditDayTypeManuallySet, setIsAuditDayTypeManuallySet] = useState(false);
  const [inputMode, setInputMode] = useState('grams'); // 'grams' | 'ratios'

  // 克数输入状态
  const [actualCarbs, setActualCarbs] = useState('');
  const [actualProtein, setActualProtein] = useState('');
  const [actualFat, setActualFat] = useState('');

  // 比例输入状态
  const [actualCaloriesInput, setActualCaloriesInput] = useState('');
  const [actualCarbRatio, setActualCarbRatio] = useState('50');
  const [actualProteinRatio, setActualProteinRatio] = useState('30');
  const [actualFatRatio, setActualFatRatio] = useState('20');

  const [actualRemarks, setActualRemarks] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // 7天历史对账单
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 加载某一天的对账数据
  const fetchAuditLog = async (targetDate) => {
    try {
      const data = await fetchDietLog(targetDate);

      if (data) {
        setAuditDayType(data.day_type);
        setIsAuditDayTypeManuallySet(true);
        setInputMode(data.entry_mode || 'grams');
        setActualRemarks(data.notes || '');
        if (data.entry_mode === 'ratio') {
          const totalKcal = parseFloat(data.actual_calories) || 0;
          setActualCaloriesInput(data.actual_calories?.toString() || '');
          if (totalKcal > 0) {
            setActualCarbRatio(Math.round((parseFloat(data.actual_carbs_g) * 4 / totalKcal) * 100).toString());
            setActualProteinRatio(Math.round((parseFloat(data.actual_protein_g) * 4 / totalKcal) * 100).toString());
            setActualFatRatio(Math.round((parseFloat(data.actual_fat_g) * 9 / totalKcal) * 100).toString());
          } else {
            setActualCarbRatio('50');
            setActualProteinRatio('30');
            setActualFatRatio('20');
          }
          setActualCarbs(data.actual_carbs_g?.toString() || '');
          setActualProtein(data.actual_protein_g?.toString() || '');
          setActualFat(data.actual_fat_g?.toString() || '');
        } else {
          setActualCarbs(data.actual_carbs_g?.toString() || '');
          setActualProtein(data.actual_protein_g?.toString() || '');
          setActualFat(data.actual_fat_g?.toString() || '');
          setActualCaloriesInput(data.actual_calories?.toString() || '');
        }
      } else {
        setActualCarbs('');
        setActualProtein('');
        setActualFat('');
        setActualCaloriesInput('');
        setActualRemarks('');
        setIsAuditDayTypeManuallySet(false);
      }
    } catch (err) {
      console.error('加载当日对账记录出错:', err);
    }
  };

  // 加载 7 天历史记录
  const fetchHistoryLogs = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await fetchHistoryDietLogs(7);

      const processed = (data || []).map(row => {
        const isStrDay = configForm.plan_type === 'unified' ? true : (row.day_type === 'strength_day');
        const cal = calcCalorieBudget(userProfile, latestWeight, configForm, isStrDay);
        const expected = calcMacronutrientTargets(cal.budget, latestWeight, configForm, isStrDay);

        const actual = {
          calories: Math.round(parseFloat(row.actual_calories) || 0),
          carbs: Math.round(parseFloat(row.actual_carbs_g) || 0),
          protein: Math.round(parseFloat(row.actual_protein_g) || 0),
          fat: Math.round(parseFloat(row.actual_fat_g) || 0)
        };

        const variance = {
          calories: actual.calories - expected.calories,
          carbs: actual.carbs - expected.carbs,
          protein: actual.protein - expected.protein,
          fat: actual.fat - expected.fat
        };

        let evaluation = '合理';
        let evalType = 'ok';
        if (variance.calories > 120) {
          evaluation = '盈余';
          evalType = 'surplus';
        } else if (variance.calories < -120) {
          evaluation = '赤字';
          evalType = 'deficit';
        }

        return {
          date: row.date,
          dayType: row.day_type === 'strength_day' ? '力训日' : '休息日',
          actual,
          expected,
          variance,
          evaluation,
          evalType,
          notes: row.notes
        };
      });

      setHistoryList(processed);
    } catch (err) {
      console.error('加载对账单历史列表出错:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [configForm, latestWeight, userProfile]);

  useEffect(() => {
    if (!auditDate) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) fetchAuditLog(auditDate);
    });
    return () => { cancelled = true; };
  }, [auditDate]);

  useEffect(() => {
    if (auditDate === todayDateStr && !isAuditDayTypeManuallySet) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setAuditDayType(isRestDay ? 'rest_day' : 'strength_day');
      });
      return () => { cancelled = true; };
    }
  }, [isRestDay, auditDate, todayDateStr, isAuditDayTypeManuallySet]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) fetchHistoryLogs();
    });
    return () => { cancelled = true; };
  }, [fetchHistoryLogs]);

  const actualValues = useMemo(() => {
    if (inputMode === 'grams') {
      const c = parseFloat(actualCarbs) || 0;
      const p = parseFloat(actualProtein) || 0;
      const f = parseFloat(actualFat) || 0;
      return {
        calories: Math.round(c * 4 + p * 4 + f * 9),
        carbs: Math.round(c),
        protein: Math.round(p),
        fat: Math.round(f)
      };
    } else {
      const kcal = parseFloat(actualCaloriesInput) || 0;
      const rc = parseFloat(actualCarbRatio) || 0;
      const rp = parseFloat(actualProteinRatio) || 0;
      const rf = parseFloat(actualFatRatio) || 0;
      return {
        calories: Math.round(kcal),
        carbs: Math.round((kcal * (rc / 100)) / 4),
        protein: Math.round((kcal * (rp / 100)) / 4),
        fat: Math.round((kcal * (rf / 100)) / 9)
      };
    }
  }, [inputMode, actualCarbs, actualProtein, actualFat, actualCaloriesInput, actualCarbRatio, actualProteinRatio, actualFatRatio]);

  const expectedValues = useMemo(() => {
    const isStrengthDay = configForm.plan_type === 'unified' ? true : (auditDayType === 'strength_day' || auditDayType === 'train');
    const cal = calcCalorieBudget(userProfile, latestWeight, configForm, isStrengthDay);
    const macros = calcMacronutrientTargets(cal.budget, latestWeight, configForm, isStrengthDay);
    return {
      calories: macros.calories,
      carbs: macros.carbs,
      protein: macros.protein,
      fat: macros.fat
    };
  }, [userProfile, latestWeight, configForm, auditDayType]);

  const expectedRatios = useMemo(() => {
    const total = expectedValues.carbs * 4 + expectedValues.protein * 4 + expectedValues.fat * 9;
    if (total === 0) return { carbs: 0, protein: 0, fat: 0 };
    return {
      carbs: Math.round((expectedValues.carbs * 4 / total) * 100),
      protein: Math.round((expectedValues.protein * 4 / total) * 100),
      fat: Math.round((expectedValues.fat * 9 / total) * 100)
    };
  }, [expectedValues]);

  const handleSaveAuditLog = async () => {
    if (inputMode === 'ratios') {
      const sum = (Number(actualCarbRatio) || 0) + (Number(actualProteinRatio) || 0) + (Number(actualFatRatio) || 0);
      if (sum !== 100) {
        setErrorMsg('实际摄入比例之和必须等于 100%');
        return;
      }
    }

    setSyncLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        date: auditDate,
        day_type: auditDayType === 'train' || auditDayType === 'strength_day' ? 'strength_day' : 'rest_day',
        entry_mode: inputMode,
        actual_carbs_g: actualValues.carbs,
        actual_protein_g: actualValues.protein,
        actual_fat_g: actualValues.fat,
        actual_calories: actualValues.calories,
        notes: actualRemarks || null,
        updated_at: new Date().toISOString()
      };

      await saveDietLog(payload);

      setSuccessMsg('🎉 每日饮食实际摄入对账数据保存成功！');
      setTimeout(() => setSuccessMsg(''), 3000);

      if (onRefreshDiet) await onRefreshDiet();
      await fetchHistoryLogs();
    } catch (err) {
      setErrorMsg('保存对账失败：' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDeleteAuditLog = async (targetDate) => {
    if (!window.confirm(`确定要物理删除 ${targetDate} 的饮食对账记录吗？`)) return;
    setSyncLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await deleteDietLog(targetDate);

      setSuccessMsg(`✓ 已删除 ${targetDate} 的对账记录。`);
      setTimeout(() => setSuccessMsg(''), 3000);

      if (targetDate === auditDate) {
        setActualCarbs('');
        setActualProtein('');
        setActualFat('');
        setActualCaloriesInput('');
        setActualRemarks('');
      }

      if (onRefreshDiet) await onRefreshDiet();
      await fetchHistoryLogs();
    } catch (err) {
      setErrorMsg('删除失败：' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // 5. 动态核算实时热量与碳蛋脂克数目标 (力训日 vs 休息日)
  const strengthDayStats = useMemo(() => {
    const cal = calcCalorieBudget(userProfile, latestWeight, configForm, true);
    const macros = calcMacronutrientTargets(cal.budget, latestWeight, configForm, true);
    const audits = auditNutritionSafety(macros.calories, cal.bmr, macros.protein, macros.fat, latestWeight, userGender);
    return { cal, macros, audits };
  }, [userProfile, latestWeight, configForm, userGender]);

  const restDayStats = useMemo(() => {
    const cal = calcCalorieBudget(userProfile, latestWeight, configForm, false);
    const macros = calcMacronutrientTargets(cal.budget, latestWeight, configForm, false);
    const audits = auditNutritionSafety(macros.calories, cal.bmr, macros.protein, macros.fat, latestWeight, userGender);
    return { cal, macros, audits };
  }, [userProfile, latestWeight, configForm, userGender]);

  // 6. AI 饮食反馈微调模块
  const [aiFeedbackType, setAiFeedbackType] = useState('');
  const [aiTuneResult, setAiTuneResult] = useState(null);

  const handleAiTuneRequest = (type) => {
    setAiFeedbackType(type);
    const baseGrams = {
      carbs: configForm.calc_mode === 'custom' ? configForm.custom_config.strength_day.carbs : strengthDayStats.macros.carbs,
      protein: configForm.calc_mode === 'custom' ? configForm.custom_config.strength_day.protein : strengthDayStats.macros.protein,
      fat: configForm.calc_mode === 'custom' ? configForm.custom_config.strength_day.fat : strengthDayStats.macros.fat,
    };
    const result = getAiDietTuneUp(type, baseGrams);
    setAiTuneResult(result);
  };

  const applyAiTuneResult = () => {
    if (!aiTuneResult) return;
    const { suggestion } = aiTuneResult;
    setConfigForm(prev => ({
      ...prev,
      calc_mode: 'custom',
      custom_config: {
        ...prev.custom_config,
        strength_day: {
          carbs: suggestion.carbs,
          protein: suggestion.protein,
          fat: suggestion.fat
        },
        rest_day: {
          // 保留休息日原有配置，AI 建议仅针对力训日进行调整
          ...prev.custom_config.rest_day
        }
      }
    }));
    setAiTuneResult(null);
    setAiFeedbackType('');
    setSuccessMsg('✓ AI 饮食建议已填充入自定义克数表单（仅调整力训日，休息日保持原配置。点击最下方按钮以保存激活）');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 7. 保存饮食方案到 Supabase
  const handleSaveConfig = async () => {
    if (configForm.calc_mode === 'ratio') {
      const sum = Number(configForm.ratio_carbs) + Number(configForm.ratio_protein) + Number(configForm.ratio_fat);
      if (sum !== 100) {
        setErrorMsg('比例总和必须为 100% (当前合计: ' + sum + '%)');
        return;
      }
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await saveUserNutritionConfig(configForm);

      setSuccessMsg('🎉 饮食核算方案已成功激活！今日对账将以此为准。');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefreshDiet) await onRefreshDiet();
    } catch (err) {
      setErrorMsg('方案保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 合并安全审查警告
  const mergedAudits = useMemo(() => {
    // 统一计划下力训日与休息日预算相同，只显示一份审查，避免误导性重复警告
    if (configForm.plan_type === 'unified') {
      return strengthDayStats.audits;
    }
    const list = [...strengthDayStats.audits];
    restDayStats.audits.forEach(ra => {
      if (!list.find(la => la.message === ra.message)) {
        list.push({ ...ra, message: `[休息日] ${ra.message}` });
      }
    });
    return list;
  }, [strengthDayStats.audits, restDayStats.audits, configForm.plan_type]);

  return (
    <div className="flex flex-col gap-8 animate-fadeIn pb-12">
      {/* 头部标题与描述 */}
      <div>
        <h2 className="page-header">饮食与能量代谢</h2>
        <p className="page-header-desc">配置专属 TDEE 能量预算，并核算宏量配比。</p>
      </div>

      {errorMsg && (
        <div className="mx-1 p-4 bg-bg-alert dark:bg-bg-alert-dark text-alert dark:text-alert-dark border-l-4 border-alert dark:border-alert-dark rounded-r-lg flex items-center gap-2 text-sm">
          <ShieldAlert size={16} className="shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box !border-success bg-green-500/10 !text-success text-sm border-l-4 px-4 py-3 font-semibold rounded-r-lg">
          {successMsg}
        </div>
      )}

      {/* 1. TDEE 基础参数配置卡片 */}
      <section className="card p-5 md:p-6 flex flex-col gap-5 rounded-2xl shadow-sm">
        <h3 className="card-title-standard">
          <Flame size={18} className="text-primary" />1. TDEE 日能耗核算配置
        </h3>

        {/* 基础个人画像参考数据展示 */}
        <div className="p-4 bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/50 dark:border-border-card-dark/50 rounded-xl flex flex-col gap-2 text-sm leading-relaxed select-none">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="text-text-secondary dark:text-text-secondary-dark font-bold">画像参考：</span>
              <span className="font-bold text-text-main dark:text-text-main-dark">
                {userGender === 'male' ? '男' : '女'} · {userAge}岁 · {userHeight}cm
              </span>
            </div>
            <div>
              <span className="text-text-secondary dark:text-text-secondary-dark font-bold">最新体重：</span>
              <span className="font-bold text-text-main dark:text-text-main-dark">{latestWeight.toFixed(1)} kg</span>
            </div>
          </div>
          <div className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark/80 leading-normal border-t border-border-card/30 dark:border-border-card-dark/30 pt-2">
            <Lightbulb size={14} className="inline shrink-0" /> Mifflin-St Jeor 公式得出基础代谢 BMR：<strong>{strengthDayStats.cal.bmr} kcal</strong>。无运动能耗（BMR * {configForm.neat_tef_factor}）为：<strong>{Math.round(strengthDayStats.cal.bmr * configForm.neat_tef_factor)} kcal</strong>。
          </div>
        </div>

        {/* 方案是否激活警告条 */}
        {userNutritionConfig && (configForm.plan_type !== userNutritionConfig.plan_type || configForm.deficit_slider !== parseFloat(userNutritionConfig.deficit_slider)) && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500 text-xs md:text-sm leading-relaxed flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-extrabold block text-sm mb-0.5">当前热量预算草稿尚未保存激活！</span>
              系统当前激活的是「{userNutritionConfig.plan_type === 'split' ? '分日计划' : '统一计划'}」，您在此做的调整需要滚动到页面下方点击 <strong>确认激活并应用此饮食方案</strong> 才会对每日对账生效。
            </div>
          </div>
        )}

        {/* 力量消耗等级与分日/统一计划选择 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control w-full">
            <label className="section-subtitle select-none">力量训练消耗级别</label>
            <select
              value={configForm.strength_level}
              onChange={(e) => setConfigForm(prev => ({ ...prev, strength_level: e.target.value }))}
              className="select-standard"
            >
              <option value="none">无力训 (0 kcal)</option>
              <option value="beginner">初学力训 ({userGender === 'female' ? '100' : '150'} kcal)</option>
              <option value="intermediate">进阶力训 ({userGender === 'female' ? '150' : '200'} kcal)</option>
              <option value="advanced">老手力训 ({userGender === 'female' ? '200' : '250'} kcal)</option>
              <option value="custom">自定义能耗数值</option>
            </select>
          </div>

          <div className="form-control w-full">
            <label className="section-subtitle select-none">热量调控方案</label>
            <select
              value={configForm.plan_type}
              onChange={(e) => setConfigForm(prev => ({ ...prev, plan_type: e.target.value }))}
              className="select-standard"
            >
              <option value="split">分日计划 (Split - 碳水热量循环)</option>
              <option value="unified">统一计划 (Unified - 每日预算均等)</option>
            </select>
          </div>
        </div>

        {/* 自定义力训能耗输入 */}
        {configForm.strength_level === 'custom' && (
          <div className="form-control w-full animate-fadeIn">
            <label className="section-subtitle select-none">自定义力训单次消耗 (kcal)</label>
            <input
              type="number"
              value={configForm.custom_strength_kcal}
              onChange={(e) => setConfigForm(prev => ({ ...prev, custom_strength_kcal: parseInt(e.target.value, 10) || 0 }))}
              className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus:border-primary rounded-xl"
              placeholder="如 300"
            />
          </div>
        )}

        {/* 有氧周消耗计算器 (Cardio Weekly Calculator) */}
        <div className="p-4 md:p-5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 flex flex-col gap-4">
          <h4 className="text-sm md:text-base font-black text-primary flex items-center gap-1"><Activity size={16} /> 有氧运动周消耗计算器</h4>
          <p className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark/80 leading-normal">
            系统将基于您当前的体重 <strong>{latestWeight} kg</strong> 按照科学系数线性估算每次运动卡路里。汇总出的周有氧总消耗将平均折算到每一天。
          </p>

          {/* 添加有氧单项表单，支持深浅模式 */}
          <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/60 dark:border-border-card-dark/60 rounded-xl p-3 md:p-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="section-subtitle select-none">有氧项目大类</label>
                <select
                  value={calcCategory}
                  onChange={(e) => handleCalcCategoryChange(e.target.value)}
                  className="select-standard"
                >
                  {categoryMap.map((c) => (
                    <option key={c.raw} value={c.raw}>{c.clean}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="section-subtitle select-none">有氧强度/速度</label>
                <select
                  value={calcSubtype}
                  onChange={(e) => setCalcSubtype(e.target.value)}
                  className="select-standard"
                >
                  {subtypes.map((sub) => (
                    <option key={sub} value={sub}>
                      {formatSubtypeDisplay(sub, calcCategory)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="section-subtitle select-none">
                  {calcSubtype === '每走一万步' ? '步数' : '时长 (分钟)'}
                </label>
                <input
                  type="number"
                  value={calcDuration}
                  onChange={(e) => setCalcDuration(e.target.value)}
                  placeholder={calcSubtype === '每走一万步' ? '如 10000' : '如 45'}
                  className="input-standard !text-center"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="section-subtitle select-none">每周频次 (次)</label>
                <input
                  type="number"
                  value={calcFrequency}
                  onChange={(e) => setCalcFrequency(e.target.value)}
                  placeholder="如 3"
                  className="input-standard !text-center"
                />
              </div>

              <button
                type="button"
                onClick={handleAddAerobicItem}
                className="btn-main w-full col-span-2 md:col-span-1"
              >
                + 加入计划
              </button>
            </div>
          </div>

          {/* 已加入的有氧列表 */}
          {aerobicItems.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {aerobicItems.map((item) => {
                const singleBurn = getAerobicKcal(item.category, item.subtype, latestWeight, parseFloat(item.duration) || 0);
                const cleanCatName = item.category.split('\n')[0].split('*')[0].trim();
                const subtypeText = formatSubtypeDisplay(item.subtype, item.category);
                const totalItemKcal = singleBurn * (parseFloat(item.frequency) || 0);

                return (
                  <div key={item.id} className="flex justify-between items-center bg-bg-card dark:bg-bg-card-dark border border-border-card/60 dark:border-border-card-dark/60 rounded-xl p-3 text-xs md:text-sm">
                    <div className="space-y-1">
                      <div className="font-bold text-text-main dark:text-text-main-dark">
                        {cleanCatName} - {subtypeText}
                      </div>
                      <div className="text-text-secondary dark:text-text-secondary-dark font-medium text-xs">
                        {item.subtype === '每走一万步' ? `${item.duration} 步` : `${item.duration} 分钟`} × 每周 {item.frequency} 次 (单次约 {singleBurn} kcal)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-text-main dark:text-text-main-dark">每周 {totalItemKcal} kcal</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAerobicItem(item.id)}
                        className="text-error hover:text-red-700 p-2.5 cursor-pointer rounded-lg hover:bg-red-500/10 transition-colors shrink-0 flex items-center justify-center"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-5 text-text-secondary dark:text-text-secondary-dark italic text-xs md:text-sm border border-dashed rounded-xl bg-bg-card/50 dark:bg-bg-card-dark/30">
              <Inbox size={48} className="text-text-secondary/30 mb-2" /><span className="text-text-secondary">暂无有氧运动计划，在上方添加一个吧！</span>
            </div>
          )}

          {/* 汇总与应用 */}
          {aerobicItems.length > 0 && (
            <div className="border-t border-primary/10 pt-3 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark select-none font-semibold">
                <span>每周有氧能耗合计: <strong className="text-text-main dark:text-text-main-dark font-mono">{computedCardioKcal.weekly} kcal</strong></span>
                <span>每日折算均值: <strong className="text-primary font-mono">{computedCardioKcal.daily} kcal / 天</strong></span>
              </div>

              <button
                type="button"
                onClick={handleApplyCalculatedCardio}
                className="w-full h-11 text-sm md:text-base font-black rounded-xl bg-primary hover:opacity-90 active:scale-[0.98] transition-all text-white cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                🚀 一键套用每日均值 ({computedCardioKcal.daily} kcal/天)
              </button>
            </div>
          )}
        </div>

        {/* 3. 热量赤字调控系数 */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex justify-between items-center select-none text-sm font-bold text-text-secondary dark:text-text-secondary-dark flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <span>热量调控系数 (Deficit Slider)</span>
              <button
                type="button"
                onClick={() => setIsSliderLocked(!isSliderLocked)}
                className={`badge py-1.5 h-6 text-[10px] sm:text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 select-none active:scale-95 ${
                  isSliderLocked
                    ? 'bg-bg-hover text-text-secondary border-border-card dark:border-border-card-dark'
                    : 'bg-primary text-white border-primary shadow-xs'
                }`}
              >
                {isSliderLocked ? <><Lock size={12} className="inline" /> 防误触锁定</> : <><LockOpen size={12} className="inline" /> 编辑中</>}
              </button>
            </span>
            <span 
              onClick={() => {
                setIsSliderLocked(false);
                setConfigForm(prev => ({ ...prev, deficit_slider: 1.0 }));
              }}
              className="text-primary text-base font-black font-mono bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg cursor-pointer active:scale-95 transition-all select-none"
              title="点击重置为 100% 保持"
            >
              {Math.round(configForm.deficit_slider * 100)}% 
              ({configForm.deficit_slider === 1.0 ? '保持' : configForm.deficit_slider < 1.0 ? `缺口 ${Math.round((1 - configForm.deficit_slider)*100)}%` : `盈余 ${Math.round((configForm.deficit_slider - 1)*100)}%`})
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.2"
            step="0.01"
            value={configForm.deficit_slider}
            disabled={isSliderLocked}
            onChange={(e) => setConfigForm(prev => ({ ...prev, deficit_slider: parseFloat(e.target.value) }))}
            className={`range range-primary range-sm transition-opacity ${isSliderLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
          />
          <div className="relative w-full h-5 text-xs text-text-secondary/40 dark:text-text-secondary-dark/40 font-mono font-bold select-none mt-1">
            <span 
              className="absolute left-0 cursor-pointer hover:text-text-secondary active:scale-95 transition-transform whitespace-nowrap"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setIsSliderLocked(false);
                setConfigForm(prev => ({ ...prev, deficit_slider: 0.5 }));
              }}
              title="设定为 50%"
            >
              减脂 50%
            </span>
            <span 
              className="absolute left-[71.4%] -translate-x-1/2 cursor-pointer hover:text-text-secondary text-primary/60 active:scale-95 transition-transform whitespace-nowrap"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setIsSliderLocked(false);
                setConfigForm(prev => ({ ...prev, deficit_slider: 1.0 }));
              }}
              title="设定为 100%"
            >
              📍 保持 100%
            </span>
            <span 
              className="absolute right-0 cursor-pointer hover:text-text-secondary active:scale-95 transition-transform whitespace-nowrap"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setIsSliderLocked(false);
                setConfigForm(prev => ({ ...prev, deficit_slider: 1.2 }));
              }}
              title="设定为 120%"
            >
              增肌 120%
            </span>
          </div>
        </div>
      </section>

      {/* 2. 三大营养素配比方案配置卡片 */}
      <section className="card p-5 md:p-6 flex flex-col gap-5 rounded-2xl shadow-sm">
        <h3 className="card-title-standard">
          <Utensils size={18} className="text-primary" />2. 三大营养素配比方案
        </h3>

        {/* 方案是否激活警告条 */}
        {userNutritionConfig && (configForm.calc_mode !== userNutritionConfig.calc_mode || 
          (configForm.calc_mode === 'ratio' && (
            configForm.ratio_carbs !== userNutritionConfig.ratio_carbs ||
            configForm.ratio_protein !== userNutritionConfig.ratio_protein ||
            configForm.ratio_fat !== userNutritionConfig.ratio_fat
          ))) && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500 text-xs md:text-sm leading-relaxed flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-extrabold block text-sm mb-0.5">当前配比方案草稿尚未保存激活！</span>
              目前激活的核算基准为「{
                userNutritionConfig.calc_mode === 'ratio' ? '热量占比' : 
                userNutritionConfig.calc_mode === 'weight_multiple' ? '体重倍数' : '自定义克数'
              }」，您在此做的调整需要滚动到页面下方点击 <strong>确认激活并应用此饮食方案</strong> 才会生效。
            </div>
          </div>
        )}

        {/* 计算模式选择 Tab */}
        <div className="grid grid-cols-3 bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl p-1 gap-1 select-none">
          {[
            { key: 'ratio', label: '热量占比', icon: PieChart },
            { key: 'weight_multiple', label: '体重倍数', icon: Scale },
            { key: 'custom', label: '自定义克数', icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2.5 sm:py-3.5 rounded-xl text-xs sm:text-sm md:text-base font-black transition-all whitespace-nowrap ${
                configForm.calc_mode === key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
              }`}
              onClick={() => setConfigForm(prev => ({ ...prev, calc_mode: key }))}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 模式 1: 热量占比输入 */}
        {configForm.calc_mode === 'ratio' && (
          <div className="flex flex-col gap-4 border border-dashed border-border-card/60 dark:border-border-card-dark/60 p-4 rounded-xl bg-bg-main/5 dark:bg-bg-main-dark/5 animate-fadeIn">
            <span className="section-subtitle select-none">设定能量占比 (合计必须为 100%)</span>
            <div className="grid grid-cols-3 gap-3">
              <div className="form-control">
                <label className="section-subtitle select-none">碳水 (%)</label>
                <input
                  type="number"
                  value={configForm.ratio_carbs}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, ratio_carbs: parseInt(e.target.value, 10) || 0 }))}
                  className="input input-bordered w-full h-11 text-base font-mono font-bold text-center rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                />
              </div>
              <div className="form-control">
                <label className="section-subtitle select-none">蛋白 (%)</label>
                <input
                  type="number"
                  value={configForm.ratio_protein}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, ratio_protein: parseInt(e.target.value, 10) || 0 }))}
                  className="input input-bordered w-full h-11 text-base font-mono font-bold text-center rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                />
              </div>
              <div className="form-control">
                <label className="section-subtitle select-none">脂肪 (%)</label>
                <input
                  type="number"
                  value={configForm.ratio_fat}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, ratio_fat: parseInt(e.target.value, 10) || 0 }))}
                  className="input input-bordered w-full h-11 text-base font-mono font-bold text-center rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* 模式 2: 体重倍数输入 */}
        {configForm.calc_mode === 'weight_multiple' && (
          <div className="flex flex-col gap-4 border border-dashed border-border-card/60 dark:border-border-card-dark/60 p-4 rounded-xl bg-bg-main/5 dark:bg-bg-main-dark/5 animate-fadeIn">
            <span className="section-subtitle select-none">每公斤体重克数配比 (g/kg)</span>
            
            {/* 力量日 */}
            <div className="flex flex-col gap-3 pb-3 border-b border-border-card/45 dark:border-border-card-dark/45">
              <span className="section-subtitle select-none flex items-center gap-1 text-primary"><Dumbbell size={12} />力训日倍数：</span>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">碳水 g/kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.multiple_config.strength_day.carbs}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      multiple_config: {
                        ...prev.multiple_config,
                        strength_day: { ...prev.multiple_config.strength_day, carbs: parseFloat(e.target.value) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="碳水"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">蛋白 g/kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.multiple_config.strength_day.protein}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      multiple_config: {
                        ...prev.multiple_config,
                        strength_day: { ...prev.multiple_config.strength_day, protein: parseFloat(e.target.value) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="蛋白"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">脂肪 g/kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.multiple_config.strength_day.fat}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      multiple_config: {
                        ...prev.multiple_config,
                        strength_day: { ...prev.multiple_config.strength_day, fat: parseFloat(e.target.value) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="脂肪"
                  />
                </div>
              </div>
            </div>

            {/* 休息日 */}
            {configForm.plan_type === 'split' && (
              <div className="flex flex-col gap-3">
                <span className="section-subtitle select-none flex items-center gap-1"><Pause size={12} />休息日倍数：</span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">碳水 g/kg</span>
                    <input
                      type="number"
                      step="0.1"
                      value={configForm.multiple_config.rest_day.carbs}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        multiple_config: {
                          ...prev.multiple_config,
                          rest_day: { ...prev.multiple_config.rest_day, carbs: parseFloat(e.target.value) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="碳水"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">蛋白 g/kg</span>
                    <input
                      type="number"
                      step="0.1"
                      value={configForm.multiple_config.rest_day.protein}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        multiple_config: {
                          ...prev.multiple_config,
                          rest_day: { ...prev.multiple_config.rest_day, protein: parseFloat(e.target.value) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="蛋白"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">脂肪 g/kg</span>
                    <input
                      type="number"
                      step="0.1"
                      value={configForm.multiple_config.rest_day.fat}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        multiple_config: {
                          ...prev.multiple_config,
                          rest_day: { ...prev.multiple_config.rest_day, fat: parseFloat(e.target.value) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="脂肪"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 模式 3: 进阶自定义克数输入 */}
        {configForm.calc_mode === 'custom' && (
          <div className="flex flex-col gap-4 border border-dashed border-border-card/60 dark:border-border-card-dark/60 p-4 rounded-xl bg-bg-main/5 dark:bg-bg-main-dark/5 animate-fadeIn">
            <span className="section-subtitle select-none">设定固定克数目标 (g)</span>
            
            {/* 力量日 */}
            <div className="flex flex-col gap-3 pb-3 border-b border-border-card/45 dark:border-border-card-dark/45">
              <span className="section-subtitle select-none flex items-center gap-1 text-primary"><Dumbbell size={12} />力训日目标：</span>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">碳水 g</span>
                  <input
                    type="number"
                    value={configForm.custom_config.strength_day.carbs}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      custom_config: {
                        ...prev.custom_config,
                        strength_day: { ...prev.custom_config.strength_day, carbs: parseInt(e.target.value, 10) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="碳水"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">蛋白 g</span>
                  <input
                    type="number"
                    value={configForm.custom_config.strength_day.protein}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      custom_config: {
                        ...prev.custom_config,
                        strength_day: { ...prev.custom_config.strength_day, protein: parseInt(e.target.value, 10) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="蛋白"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">脂肪 g</span>
                  <input
                    type="number"
                    value={configForm.custom_config.strength_day.fat}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      custom_config: {
                        ...prev.custom_config,
                        strength_day: { ...prev.custom_config.strength_day, fat: parseInt(e.target.value, 10) || 0 }
                      }
                    }))}
                    className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    placeholder="脂肪"
                  />
                </div>
              </div>
            </div>

            {/* 休息日 */}
            {configForm.plan_type === 'split' && (
              <div className="flex flex-col gap-3">
                <span className="section-subtitle select-none flex items-center gap-1"><Pause size={12} />休息日目标：</span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">碳水 g</span>
                    <input
                      type="number"
                      value={configForm.custom_config.rest_day.carbs}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        custom_config: {
                          ...prev.custom_config,
                          rest_day: { ...prev.custom_config.rest_day, carbs: parseInt(e.target.value, 10) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="碳水"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">蛋白 g</span>
                    <input
                      type="number"
                      value={configForm.custom_config.rest_day.protein}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        custom_config: {
                          ...prev.custom_config,
                          rest_day: { ...prev.custom_config.rest_day, protein: parseInt(e.target.value, 10) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="蛋白"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-semibold text-center">脂肪 g</span>
                    <input
                      type="number"
                      value={configForm.custom_config.rest_day.fat}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        custom_config: {
                          ...prev.custom_config,
                          rest_day: { ...prev.custom_config.rest_day, fat: parseInt(e.target.value, 10) || 0 }
                        }
                      }))}
                      className="input input-bordered h-11 text-center font-mono font-bold text-base rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="脂肪"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 方案效果实时预算看板 (Preview Card) */}
        <div className="p-4 bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl border border-border-card/45 dark:border-border-card-dark/45 select-none flex flex-col gap-4">
          <span className="font-extrabold text-text-main dark:text-text-main-dark flex items-center gap-1.5 pb-2 border-b border-border-card/30 dark:border-border-card-dark/30 text-sm md:text-base">
            <Eye size={16} className="text-primary" />
            预算方案效果实时预览
          </span>
          
          <div className="flex flex-col gap-5">
            {/* 力训日预算 Card */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-text-main dark:text-text-main-dark">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                <span>力训日预算目标：</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {/* 热量格子 */}
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                  <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">热量</span>
                  <span className="text-sm md:text-lg font-black text-primary font-mono mt-0.5 leading-none block">
                    {strengthDayStats.macros.calories}
                  </span>
                  <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">kcal</span>
                </div>
                {/* 碳水格子 */}
                <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                  <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">碳水</span>
                  <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                    {strengthDayStats.macros.carbs}
                  </span>
                  <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                </div>
                {/* 蛋白格子 */}
                <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                  <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">蛋白</span>
                  <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                    {strengthDayStats.macros.protein}
                  </span>
                  <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                </div>
                {/* 脂肪格子 */}
                <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                  <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">脂肪</span>
                  <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                    {strengthDayStats.macros.fat}
                  </span>
                  <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                </div>
              </div>
            </div>

            {/* 休息日预算 Card */}
            {configForm.plan_type === 'split' && (
              <div className="flex flex-col gap-2.5 border-t border-border-card/25 dark:border-border-card-dark/25 pt-4">
                <div className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark">
                  <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
                  <span>休息日预算目标：</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {/* 热量格子 */}
                  <div className="bg-success/5 dark:bg-success/10 border border-success/20 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                    <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">热量</span>
                    <span className="text-sm md:text-lg font-black text-success font-mono mt-0.5 leading-none block">
                      {restDayStats.macros.calories}
                    </span>
                    <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">kcal</span>
                  </div>
                  {/* 碳水格子 */}
                  <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                    <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">碳水</span>
                    <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                      {restDayStats.macros.carbs}
                    </span>
                    <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                  </div>
                  {/* 蛋白格子 */}
                  <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                    <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">蛋白</span>
                    <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                      {restDayStats.macros.protein}
                    </span>
                    <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                  </div>
                  {/* 脂肪格子 */}
                  <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2.5 flex flex-col items-center justify-center shadow-xs">
                    <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold">脂肪</span>
                    <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">
                      {restDayStats.macros.fat}
                    </span>
                    <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. 饮食安全红线检测警示框 */}
      {mergedAudits.length > 0 && (
        <section className="card p-5 md:p-6 bg-bg-alert/5 dark:bg-bg-alert-dark/5 border border-red-500/20 dark:border-red-500/10 flex flex-col gap-3 animate-fadeIn select-none rounded-2xl">
          <h4 className="text-sm md:text-base font-black text-error flex items-center gap-1.5">
            <ShieldAlert size={18} /> 医疗级能量与营养红线警示：
          </h4>
          <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-text-secondary dark:text-text-secondary-dark">
            {mergedAudits.map((audit, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border text-left bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-500 font-medium"
              >
                <AlertTriangle size={14} className="inline shrink-0 mr-1" />{audit.message}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. AI 饮食反馈与微调配置面板 */}
      <section className="card p-5 md:p-6 flex flex-col gap-4 bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 rounded-2xl shadow-sm">
        <h3 className="card-title-standard !text-primary !border-primary/20">
          <Sparkles size={16} className="animate-pulse" />AI 饮食体感优化调校
        </h3>
        <p className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark leading-normal">
          根据您最近的减脂速度或训练状态，点击下方体感反馈，AI 会为您调整碳水配比，免除复杂的计算。
        </p>

        <div className="grid grid-cols-3 gap-2.5 select-none">
          {[
            { key: 'difficult', label: '疲惫/减太快', Icon: Frown },
            { key: 'plateau', label: '平台期/减太慢', Icon: TrendingDown },
            { key: 'gain', label: '转力训增肌', Icon: Dumbbell },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`flex flex-col items-center justify-center p-2 rounded-2xl h-16 border transition-all cursor-pointer ${
                aiFeedbackType === key
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-bg-card dark:bg-bg-card-dark border-border-card/50 dark:border-border-card-dark text-text-secondary dark:text-text-secondary-dark hover:text-text-main hover:bg-bg-hover/30'
              }`}
              onClick={() => handleAiTuneRequest(key)}
            >
              <Icon size={22} />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold mt-1 text-center whitespace-normal leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* AI 推荐结果展示与应用 */}
        {aiTuneResult && (
          <div className="p-4 bg-bg-card dark:bg-bg-card-dark rounded-xl border border-border-card/50 dark:border-border-card-dark/50 flex flex-col gap-3 animate-fadeIn text-xs md:text-sm shadow-sm">
            <p className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed bg-bg-main/30 dark:bg-bg-main-dark/30 p-3 rounded-lg font-medium border border-border-card/25 dark:border-border-card-dark/25">
              <Lightbulb size={14} className="inline shrink-0 mr-1" />{aiTuneResult.reason}
            </p>
            <div className="flex justify-between items-center select-none flex-wrap gap-2 pt-1 border-t border-border-card/10 dark:border-border-card-dark/10">
              <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-bold">
                推荐值: <strong className="text-primary font-mono text-sm md:text-base">C: {aiTuneResult.suggestion.carbs}g / P: {aiTuneResult.suggestion.protein}g / F: {aiTuneResult.suggestion.fat}g</strong>
              </span>
              <button
                type="button"
                className="btn-main px-4"
                onClick={applyAiTuneResult}
              >
                一键应用推荐值
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 保存激活方案 */}
      <button
        type="button"
        disabled={saving}
        onClick={handleSaveConfig}
        className="btn-main w-full"
      >
        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        <span>{saving ? '保存方案中...' : '确认激活并应用此饮食方案'}</span>
      </button>

      {/* 5. 每日实际摄入对账面板 (Expected vs. Actual) */}
      <section className="card p-5 md:p-6 flex flex-col gap-5 rounded-2xl shadow-sm">
        <h3 className="card-title-standard">
          <Calendar size={18} className="text-primary" />3. 每日饮食实际摄入对账
        </h3>

        <div className="flex flex-col gap-4">
          {/* 日期选择与当天性质 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="section-subtitle select-none">核算日期</label>
              <input
                type="date"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="input input-bordered w-full h-12 text-sm md:text-base font-mono font-bold rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card/80 dark:border-border-card-dark/80 text-center focus:border-primary"
              />
            </div>

            {configForm.plan_type !== 'unified' && (
              <div className="flex flex-col gap-1">
                <label className="section-subtitle select-none">当天性质</label>
                <div className="grid grid-cols-2 gap-1 bg-bg-main/30 dark:bg-bg-main-dark/30 p-1 rounded-xl border border-border-card dark:border-border-card-dark h-12 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuditDayType('strength_day');
                      setIsAuditDayTypeManuallySet(true);
                    }}
                    className={`text-center py-2 rounded-lg text-sm md:text-base font-black transition-all ${
                      auditDayType === 'strength_day'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                    }`}
                  >
                    <Zap size={12} className="inline" /> 力训日
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditDayType('rest_day');
                      setIsAuditDayTypeManuallySet(true);
                    }}
                    className={`text-center py-2 rounded-lg text-sm md:text-base font-black transition-all ${
                      auditDayType === 'rest_day'
                        ? 'bg-success text-white shadow-sm'
                        : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                    }`}
                  >
                    <Pause size={12} className="inline" /> 休息日
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 预计目标看板 (Expected Values) */}
          <div className="p-4 border border-border-card/60 dark:border-border-card-dark/60 rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 flex flex-col gap-2 select-none">
            <div className="flex justify-between items-center border-b border-border-card/30 dark:border-border-card-dark/30 pb-2 flex-wrap gap-1">
              <span className="text-sm md:text-base font-extrabold text-text-main dark:text-text-main-dark flex items-center gap-1.5">
                <Calendar size={14} className="inline" /> {auditDate} {configForm.plan_type === 'unified' ? '(统一方案)' : `(${auditDayType === 'strength_day' ? '力训日' : '休息日'})`} 目标
              </span>
              <span className="badge badge-success text-white font-bold rounded-lg text-xs">
                基准：{configForm.calc_mode === 'ratio' ? '热量占比' : configForm.calc_mode === 'weight_multiple' ? '体重倍数' : '自定义克数'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {/* 预计热量 */}
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-2 flex flex-col items-center justify-center shadow-xs">
                <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold select-none">预计热量</span>
                <span className="text-sm md:text-lg font-black text-primary font-mono mt-0.5 leading-none block">{expectedValues.calories}</span>
                <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">kcal</span>
              </div>
              {/* 预计碳水 */}
              <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2 flex flex-col items-center justify-center shadow-xs">
                <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold select-none">预计碳水</span>
                <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">{expectedValues.carbs}</span>
                <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g <span className="text-[9px] font-normal font-sans">({expectedRatios.carbs}%)</span></span>
              </div>
              {/* 预计蛋白 */}
              <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2 flex flex-col items-center justify-center shadow-xs">
                <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold select-none">预计蛋白</span>
                <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">{expectedValues.protein}</span>
                <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g <span className="text-[9px] font-normal font-sans">({expectedRatios.protein}%)</span></span>
              </div>
              {/* 预计脂肪 */}
              <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 rounded-xl p-2 flex flex-col items-center justify-center shadow-xs">
                <span className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark font-sans font-bold select-none">预计脂肪</span>
                <span className="text-sm md:text-lg font-black text-text-main dark:text-text-main-dark font-mono mt-0.5 leading-none block">{expectedValues.fat}</span>
                <span className="text-[10px] text-text-secondary/70 font-normal font-sans mt-0.5 block leading-none scale-90">g <span className="text-[9px] font-normal font-sans">({expectedRatios.fat}%)</span></span>
              </div>
            </div>
          </div>

          {/* 录入实际摄入 */}
          <div className="border-t border-border-card/20 dark:border-border-card-dark/20 pt-4 flex flex-col gap-3">
            <span className="block text-base font-extrabold text-text-main dark:text-text-main-dark"><Pen size={16} className="inline mr-1" />录入实际摄入数据 (源自外部食物识别 App)</span>

            {/* 输入模式切换 */}
            <div className="flex bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card dark:border-border-card-dark p-1 rounded-xl items-center gap-1 select-none h-12">
              <button
                type="button"
                onClick={() => setInputMode('grams')}
                className={`flex-1 text-center py-2 rounded-lg text-sm md:text-base font-black transition-all ${
                  inputMode === 'grams'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                }`}
              >
                克数直录 (g)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('ratio')}
                className={`flex-1 text-center py-2 rounded-lg text-sm md:text-base font-black transition-all ${
                  inputMode === 'ratio'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                }`}
              >
                比例折算 (%)
              </button>
            </div>

            {/* 克数直录表单 */}
            {inputMode === 'grams' ? (
              <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                <div className="flex flex-col gap-1">
                  <label className="section-subtitle text-center select-none">实际碳水 (g)</label>
                  <input
                    type="number"
                    value={actualCarbs}
                    onChange={(e) => setActualCarbs(e.target.value)}
                    className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    min="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="section-subtitle text-center select-none">实际蛋白 (g)</label>
                  <input
                    type="number"
                    value={actualProtein}
                    onChange={(e) => setActualProtein(e.target.value)}
                    className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    min="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="section-subtitle text-center select-none">实际脂肪 (g)</label>
                  <input
                    type="number"
                    value={actualFat}
                    onChange={(e) => setActualFat(e.target.value)}
                    className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                    min="0"
                  />
                </div>
              </div>
            ) : (
              // 比例折算表单
              <div className="flex flex-col gap-3 animate-fadeIn">
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="section-subtitle text-center select-none">实际热量</label>
                    <input
                      type="number"
                      value={actualCaloriesInput}
                      onChange={(e) => setActualCaloriesInput(e.target.value)}
                      className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      placeholder="kcal"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="section-subtitle text-center select-none">碳水 (%)</label>
                    <input
                      type="number"
                      value={actualCarbRatio}
                      onChange={(e) => setActualCarbRatio(e.target.value)}
                      className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="section-subtitle text-center select-none">蛋白 (%)</label>
                    <input
                      type="number"
                      value={actualProteinRatio}
                      onChange={(e) => setActualProteinRatio(e.target.value)}
                      className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="section-subtitle text-center select-none">脂肪 (%)</label>
                    <input
                      type="number"
                      value={actualFatRatio}
                      onChange={(e) => setActualFatRatio(e.target.value)}
                      className="input input-bordered h-12 text-center font-mono font-bold text-lg rounded-xl bg-bg-main/10 dark:bg-bg-main-dark/10 border-border-card dark:border-border-card-dark focus:border-primary"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                {/* 自动求和校验 */}
                {(() => {
                  const sum = (Number(actualCarbRatio) || 0) + (Number(actualProteinRatio) || 0) + (Number(actualFatRatio) || 0);
                  if (sum !== 100) {
                    return (
                      <p className="text-xs text-error font-bold flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={14} className="inline shrink-0" /> 比例之和必须等于 100% (当前为: {sum}%)
                      </p>
                    );
                  }
                  return (
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card dark:border-border-card-dark p-3 rounded-lg flex flex-col font-mono leading-normal shadow-xs">
                      <span className="font-semibold text-text-main dark:text-text-main-dark">✓ 比例合理，折算得到实际摄入：</span>
                      <span className="font-bold text-primary mt-1">
                        碳水: {actualValues.carbs}g | 蛋白: {actualValues.protein}g | 脂肪: {actualValues.fat}g
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 备注 */}
            <div className="flex flex-col gap-1 mt-1">
              <label className="section-subtitle select-none">饮食备注 (大餐聚会、干净饮食等)</label>
              <input
                type="text"
                value={actualRemarks}
                onChange={(e) => setActualRemarks(e.target.value)}
                placeholder="录入该日的备注明细..."
                className="input-standard !font-sans !font-bold"
              />
            </div>
          </div>

          {/* 实时对比偏差看板 (Expected vs. Actual) */}
          <div className="border-t border-border-card/20 dark:border-border-card-dark/20 pt-4 flex flex-col gap-3 select-none">
            <span className="block text-base md:text-lg font-extrabold text-text-main dark:text-text-main-dark"><Scale size={16} className="inline mr-1" />今日摄入偏差核算 (预计 ➔ 实际)</span>
            <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
              {/* 热量偏差 */}
              {(() => {
                const diff = actualValues.calories - expectedValues.calories;
                const isCompliant = Math.abs(diff) <= 120;
                const isOver = diff > 120;
                let bgCls = 'bg-info/10 dark:bg-info/20 border-info/20 dark:border-info/30 text-info';
                let tag = '偏低';
                if (isCompliant) {
                  bgCls = 'bg-success/10 dark:bg-success/20 border-success/20 dark:border-success/30 text-success';
                  tag = '达标';
                } else if (isOver) {
                  bgCls = 'bg-error/10 dark:bg-error/20 border-error/20 dark:border-error/30 text-error';
                  tag = '超标';
                }
                return (
                  <div className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between ${bgCls}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm sm:text-base md:text-lg font-black font-sans text-text-main dark:text-text-main-dark">热量</span>
                      <span className="text-xs md:text-sm font-extrabold px-2 py-0.5 rounded-full bg-current/10 text-current select-none">{tag}</span>
                    </div>
                    <div className="font-mono mt-1">
                      <p className="text-[10.5px] sm:text-sm md:text-base font-bold text-text-main dark:text-text-main-dark/95 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        {expectedValues.calories}➔<strong className="text-text-main dark:text-text-main-dark font-black">{actualValues.calories}</strong> kcal
                      </p>
                      <p className="text-[11.5px] sm:text-base font-bold mt-1.5 font-sans whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        偏差: <span className="text-sm sm:text-lg font-black font-mono">{diff > 0 ? `+${diff}` : diff}</span> kcal
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 蛋白质偏差 */}
              {(() => {
                const diff = actualValues.protein - expectedValues.protein;
                const isAdequate = diff >= 0;
                const bgCls = isAdequate ? 'bg-success/10 dark:bg-success/20 border-success/20 dark:border-success/30 text-success' : 'bg-warning/10 dark:bg-warning/20 border-warning/20 dark:border-warning/30 text-warning';
                const tag = isAdequate ? '充足' : '不足';
                return (
                  <div className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between ${bgCls}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm sm:text-base md:text-lg font-black font-sans text-text-main dark:text-text-main-dark">蛋白</span>
                      <span className="text-xs md:text-sm font-extrabold px-2 py-0.5 rounded-full bg-current/10 text-current select-none">{tag}</span>
                    </div>
                    <div className="font-mono mt-1">
                      <p className="text-[10.5px] sm:text-sm md:text-base font-bold text-text-main dark:text-text-main-dark/95 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        {expectedValues.protein}➔<strong className="text-text-main dark:text-text-main-dark font-black">{actualValues.protein}</strong> g
                      </p>
                      <p className="text-[11.5px] sm:text-base font-bold mt-1.5 font-sans whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        偏差: <span className="text-sm sm:text-lg font-black font-mono">{diff > 0 ? `+${diff}` : diff}</span> g
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 碳水偏差 */}
              {(() => {
                const diff = actualValues.carbs - expectedValues.carbs;
                const isCompliant = Math.abs(diff) <= 20;
                const isOver = diff > 20;
                let bgCls = 'bg-info/10 dark:bg-info/20 border-info/20 dark:border-info/30 text-info';
                let tag = '偏少';
                if (isCompliant) {
                  bgCls = 'bg-success/10 dark:bg-success/20 border-success/20 dark:border-success/30 text-success';
                  tag = '正常';
                } else if (isOver) {
                  bgCls = 'bg-error/10 dark:bg-error/20 border-error/20 dark:border-error/30 text-error';
                  tag = '过量';
                }
                return (
                  <div className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between ${bgCls}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm sm:text-base md:text-lg font-black font-sans text-text-main dark:text-text-main-dark">碳水</span>
                      <span className="text-xs md:text-sm font-extrabold px-2 py-0.5 rounded-full bg-current/10 text-current select-none">{tag}</span>
                    </div>
                    <div className="font-mono mt-1">
                      <p className="text-[10.5px] sm:text-sm md:text-base font-bold text-text-main dark:text-text-main-dark/95 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        {expectedValues.carbs}➔<strong className="text-text-main dark:text-text-main-dark font-black">{actualValues.carbs}</strong> g
                      </p>
                      <p className="text-[11.5px] sm:text-base font-bold mt-1.5 font-sans whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        偏差: <span className="text-sm sm:text-lg font-black font-mono">{diff > 0 ? `+${diff}` : diff}</span> g
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 脂肪偏差 */}
              {(() => {
                const diff = actualValues.fat - expectedValues.fat;
                const isCompliant = Math.abs(diff) <= 12;
                const isOver = diff > 12;
                let bgCls = 'bg-info/10 dark:bg-info/20 border-info/20 dark:border-info/30 text-info';
                let tag = '偏少';
                if (isCompliant) {
                  bgCls = 'bg-success/10 dark:bg-success/20 border-success/20 dark:border-success/30 text-success';
                  tag = '正常';
                } else if (isOver) {
                  bgCls = 'bg-error/10 dark:bg-error/20 border-error/20 dark:border-error/30 text-error';
                  tag = '过量';
                }
                return (
                  <div className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between ${bgCls}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm sm:text-base md:text-lg font-black font-sans text-text-main dark:text-text-main-dark">脂肪</span>
                      <span className="text-xs md:text-sm font-extrabold px-2 py-0.5 rounded-full bg-current/10 text-current select-none">{tag}</span>
                    </div>
                    <div className="font-mono mt-1">
                      <p className="text-[10.5px] sm:text-sm md:text-base font-bold text-text-main dark:text-text-main-dark/95 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        {expectedValues.fat}➔<strong className="text-text-main dark:text-text-main-dark font-black">{actualValues.fat}</strong> g
                      </p>
                      <p className="text-[11.5px] sm:text-base font-bold mt-1.5 font-sans whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        偏差: <span className="text-sm sm:text-lg font-black font-mono">{diff > 0 ? `+${diff}` : diff}</span> g
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 对账操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={handleSaveAuditLog}
              disabled={syncLoading}
              type="button"
              className="btn-main w-full sm:flex-1"
            >
              {syncLoading ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
              <span>{syncLoading ? '对账同步中...' : '记录并保存饮食对账'}</span>
            </button>
            
            <button
              onClick={() => handleDeleteAuditLog(auditDate)}
              disabled={syncLoading}
              type="button"
              className="btn-sec border-error! text-error! hover:bg-error/5! w-full sm:w-auto sm:px-8"
            >
              <Trash2 size={16} />
              <span>删除对账</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. 最近 7 天饮食对账历史对账单 */}
      <section className="card p-5 md:p-6 flex flex-col gap-4 rounded-2xl shadow-sm">
        <h3 className="card-title-standard">
          <Calendar size={18} className="text-primary" />4. 最近 7 天饮食对账历史对账单
        </h3>

        {historyLoading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2 text-text-secondary dark:text-text-secondary-dark text-xs md:text-sm select-none">
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>正在读取历史饮食记录...</span>
          </div>
        ) : historyList.length === 0 ? (
          <div className="text-center text-text-secondary dark:text-text-secondary-dark text-xs md:text-sm p-8 bg-bg-main/20 dark:bg-bg-main-dark/20 border border-dashed border-border-card/70 dark:border-border-card-dark/70 rounded-xl select-none">
            <Inbox size={48} className="text-text-secondary/30 mb-2" /><span className="text-text-secondary">暂无历史饮食记录。请在上方输入实际数据并保存对账！</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
            {historyList.map((item, idx) => (
              <div key={idx} className="border border-border-card/60 dark:border-border-card-dark/60 rounded-xl p-4 bg-bg-main/10 dark:bg-bg-main-dark/10 flex flex-col gap-3 relative shadow-xs">
                {/* 顶部日期与评价 */}
                <div className="flex items-center justify-between border-b border-border-card/20 dark:border-border-card-dark/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm font-bold text-text-main dark:text-text-main-dark font-mono">{item.date}</span>
                    <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-lg border font-bold ${
                      item.dayType === '力训日' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-success/10 text-success border-success/20'
                    }`}>
                      {item.dayType === '力训日' ? <><Zap size={10} className="inline" /> 力训</> : <><Pause size={10} className="inline" /> 休息</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs md:text-sm font-black text-text-main dark:text-text-main-dark">{item.evalType === 'ok' ? <Target size={14} className="inline shrink-0 mr-0.5" /> : item.evalType === 'surplus' ? <TrendingUp size={14} className="inline shrink-0 mr-0.5" /> : <TrendingDown size={14} className="inline shrink-0 mr-0.5" />}{item.evaluation}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAuditLog(item.date)}
                      className="text-error hover:text-red-700 p-2.5 cursor-pointer rounded-lg hover:bg-red-500/10 transition-colors shrink-0 flex items-center justify-center active:scale-95"
                      title="物理删除此条记录"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* 备注存在时显示 */}
                {item.notes && (
                  <p className="text-xs md:text-sm text-text-secondary dark:text-text-secondary-dark bg-bg-card dark:bg-bg-card-dark p-2 rounded-lg border border-border-card/30 dark:border-border-card-dark/30 italic">
                    备注: {item.notes}
                  </p>
                )}

                {/* 对比指标明细 */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans font-semibold">热量(kcal)</span>
                    <span className="text-text-main dark:text-text-main-dark mt-1 font-bold">{item.actual.calories}</span>
                    <span className={`text-xs md:text-sm leading-tight font-black mt-1 ${
                      Math.abs(item.variance.calories) <= 120 ? 'text-success' :
                      item.variance.calories > 120 ? 'text-error' : 'text-info'
                    }`}>
                      {item.variance.calories > 0 ? `+${item.variance.calories}` : item.variance.calories}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans font-semibold">碳水(g)</span>
                    <span className="text-text-main dark:text-text-main-dark mt-1 font-bold">{item.actual.carbs}</span>
                    <span className={`text-xs md:text-sm leading-tight font-black mt-1 ${
                      Math.abs(item.variance.carbs) <= 20 ? 'text-success' :
                      item.variance.carbs > 20 ? 'text-error' : 'text-info'
                    }`}>
                      {item.variance.carbs > 0 ? `+${item.variance.carbs}` : item.variance.carbs}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans font-semibold">蛋白(g)</span>
                    <span className="text-text-main dark:text-text-main-dark mt-1 font-bold">{item.actual.protein}</span>
                    <span className={`text-xs md:text-sm leading-tight font-black mt-1 ${
                      item.variance.protein >= 0 ? 'text-success' : 'text-warning'
                    }`}>
                      {item.variance.protein > 0 ? `+${item.variance.protein}` : item.variance.protein}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans font-semibold">脂肪(g)</span>
                    <span className="text-text-main dark:text-text-main-dark mt-1 font-bold">{item.actual.fat}</span>
                    <span className={`text-xs md:text-sm leading-tight font-black mt-1 ${
                      Math.abs(item.variance.fat) <= 12 ? 'text-success' :
                      item.variance.fat > 12 ? 'text-error' : 'text-info'
                    }`}>
                      {item.variance.fat > 0 ? `+${item.variance.fat}` : item.variance.fat}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DietScreen;
