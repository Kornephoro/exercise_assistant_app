import { useState } from 'react';
import { Sun, Moon, Settings, BookOpen, RotateCcw, Info, ChevronRight, Dumbbell, Scale } from 'lucide-react';
import { DEFAULT_GYM_EQUIPMENT_CONFIG } from './unitUtils';
import { saveUserProfile } from './services/profileService';

function MyPage({ themeMode, onThemeModeChange, onReOnboard, onOpenLibrary, gymEquipmentConfig = null, setGymEquipmentConfig = null, onRefreshProfile = null }) {
  const [nickname] = useState(() => localStorage.getItem('user_nickname') || '');
  const [showBarbellModal, setShowBarbellModal] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [daysSince] = useState(() => {
    const completedAt = localStorage.getItem('onboarding_completed_at');
    if (completedAt) {
      const start = new Date(completedAt);
      const now = new Date();
      return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }
    return 0;
  });

  const avatarChar = nickname ? nickname.charAt(0).toUpperCase() : '?';
  const displayName = nickname || '未设置昵称';

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* 头部标题与描述 */}
      <div>
        <h2 className="page-header">我的</h2>
        <p className="page-header-desc">管理您的个人画像、系统配色及应用设置。</p>
      </div>

      {/* 用户卡片 */}
      <div className="card flex flex-row items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white text-2xl font-black shadow-md shrink-0">
          {avatarChar}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark truncate">
            {displayName}
          </span>
          <span className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
            {daysSince > 0
              ? `已训练 ${daysSince} 天`
              : '完成训练画像开启旅程'}
          </span>
        </div>
      </div>

      {/* 偏好设置 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <Settings size={16} className="text-primary" />偏好设置
        </h3>

        {/* 主题切换 */}
        <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
          <div className="flex items-center gap-3 min-w-0 mb-1 select-none">
            {themeMode === 'dark' ? <Moon size={18} className="text-primary" /> : <Sun size={18} className="text-primary" />}
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">主题配色</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                {themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色模式' : '浅色模式'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-0.5 gap-0.5 select-none">
            {[
              { key: 'light', label: '浅色' },
              { key: 'dark', label: '深色' },
              { key: 'system', label: '跟随系统' }
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => onThemeModeChange(item.key)}
                className={`py-1.5 rounded text-xs font-bold transition-all ${
                  themeMode === item.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 健身房器材配重设置 */}
        <button
          type="button"
          onClick={() => setShowBarbellModal(true)}
          className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 w-full text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Scale size={18} className="text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">健身房器材配重设置</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                设置您的空杆重量、可用杠铃片、哑铃阶梯递增及龙门架档位
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary/40 shrink-0" />
        </button>

        {/* 重新进入训练画像 */}
        <button
          type="button"
          onClick={onReOnboard}
          className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 w-full text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <RotateCcw size={18} className="text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">重新进入训练画像</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                重新设置每周可训练天数等偏好
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary/40 shrink-0" />
        </button>
      </div>

      {/* 训练库 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <BookOpen size={16} className="text-primary" />训练
        </h3>

        <button
          type="button"
          onClick={onOpenLibrary}
          className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 w-full text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Dumbbell size={18} className="text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">动作库</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                浏览所有可用的训练动作
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary/40 shrink-0" />
        </button>
      </div>

      {/* 关于 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <Info size={16} className="text-primary" />关于
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
          <div className="flex items-center gap-3 min-w-0">
            <Info size={18} className="text-text-secondary dark:text-text-secondary-dark shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">版本</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 font-mono">
                v1.0.0 MVP
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary dark:text-text-secondary-dark text-center py-2 opacity-60">
        💪 训练助手 · 让坚持更简单
      </p>

      {showBarbellModal && (
        <GymEquipmentModal
          isOpen={showBarbellModal}
          onClose={() => setShowBarbellModal(false)}
          initialConfig={gymEquipmentConfig}
          onSave={async (newConfig) => {
            setGymEquipmentConfig(newConfig);
            localStorage.setItem('gym_equipment_config', JSON.stringify(newConfig));
            setToastMsg('配重配置本地已生效！');
            setTimeout(() => setToastMsg(null), 2500);
            
            try {
              await saveUserProfile({ gym_equipment_config: newConfig });
              setToastMsg('配重配置已保存并同步至云端！');
              setTimeout(() => setToastMsg(null), 2500);
            } catch (err) {
              console.warn('云端同步失败 (可能由于未执行 SQL 迁移):', err.message);
            }
            if (onRefreshProfile) onRefreshProfile();
          }}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 dark:bg-white/95 text-white dark:text-black text-xs font-bold px-4 py-2.5 rounded-full shadow-lg pointer-events-none animate-fadeIn flex items-center gap-1.5 border border-border-card/25 dark:border-border-card-dark/25">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

// ==================== STANDARD_PLATES 常量 ====================
const STANDARD_PLATES = {
  kg: [25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25, 0.5],
  lbs: [45.0, 35.0, 25.0, 10.0, 5.0, 2.5]
};

// ==================== GymEquipmentModal 弹窗组件 ====================

function GymEquipmentModal({ isOpen, onClose, initialConfig, onSave }) {
  const [activeUnit, setActiveUnit] = useState('kg');
  const [customPlateInput, setCustomPlateInput] = useState('');
  const [config, setConfig] = useState(() => {
    const raw = JSON.parse(JSON.stringify(initialConfig || DEFAULT_GYM_EQUIPMENT_CONFIG));
    // 归一化所有的 kg 和 lbs 配置
    for (const unit of ['kg', 'lbs']) {
      if (!raw[unit]) raw[unit] = {};
      
      // 1. 杠铃片标准化与初始化
      if (!raw[unit].barbell) raw[unit].barbell = {};
      let plates = raw[unit].barbell.plates;
      if (!plates || !Array.isArray(plates)) {
        plates = [...STANDARD_PLATES[unit]];
      } else {
        // 保证标准片总是存在
        const uniquePlates = new Set([...STANDARD_PLATES[unit], ...plates.map(p => parseFloat(p))]);
        plates = Array.from(uniquePlates).sort((a, b) => b - a);
      }
      raw[unit].barbell.plates = plates;
      
      let enabled = raw[unit].barbell.enabled_plates;
      if (!enabled || !Array.isArray(enabled)) {
        // 默认 kg 排除最轻的 0.5，其他全启用
        raw[unit].barbell.enabled_plates = plates.filter(p => unit === 'lbs' || p !== 0.5);
      } else {
        raw[unit].barbell.enabled_plates = enabled.map(p => parseFloat(p)).filter(p => plates.includes(p));
      }
      
      // 2. 哑铃规则标准化与初始化
      if (!raw[unit].dumbbell) raw[unit].dumbbell = {};
      let rules = raw[unit].dumbbell.rules;
      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        const threshold = raw[unit].dumbbell.threshold ?? (unit === 'kg' ? 10 : 20);
        const smallStep = raw[unit].dumbbell.small_step ?? (unit === 'kg' ? 2 : 5);
        const largeStep = raw[unit].dumbbell.large_step ?? (unit === 'kg' ? 2.5 : 5);
        rules = [
          { limit: threshold, step: smallStep },
          { limit: null, step: largeStep }
        ];
      }
      raw[unit].dumbbell.rules = rules;
      
      // 3. 龙门架标准化与初始化
      if (!raw[unit].cable) raw[unit].cable = {};
      if (raw[unit].cable.step === undefined) {
        raw[unit].cable.step = unit === 'kg' ? 2.5 : 5.0;
      }
    }
    return raw;
  });

  if (!isOpen) return null;

  const unitConfig = config[activeUnit] || {
    barbell: { bar_weight: 20, plates: [], enabled_plates: [] },
    dumbbell: { rules: [] },
    cable: { step: 2.5 }
  };

  const setUnitProp = (section, key, val) => {
    setConfig(prev => {
      const next = { ...prev };
      if (!next[activeUnit]) next[activeUnit] = {};
      if (!next[activeUnit][section]) next[activeUnit][section] = {};
      next[activeUnit][section][key] = val;
      return next;
    });
  };

  const handleTogglePlate = (plate) => {
    const enabled = unitConfig.barbell?.enabled_plates || [];
    const nextEnabled = enabled.includes(plate)
      ? enabled.filter(p => p !== plate)
      : [...enabled, plate];
    nextEnabled.sort((a, b) => b - a);
    setUnitProp('barbell', 'enabled_plates', nextEnabled);
  };

  const handleAddPlate = () => {
    const val = parseFloat(customPlateInput);
    if (isNaN(val) || val <= 0) return;
    const roundedVal = Math.round(val * 100) / 100;
    
    setConfig(prev => {
      const next = { ...prev };
      const barbell = next[activeUnit].barbell;
      const plates = barbell.plates || [];
      const enabled = barbell.enabled_plates || [];
      
      if (!plates.includes(roundedVal)) {
        const nextPlates = [...plates, roundedVal].sort((a, b) => b - a);
        const nextEnabled = [...enabled, roundedVal].sort((a, b) => b - a);
        next[activeUnit].barbell.plates = nextPlates;
        next[activeUnit].barbell.enabled_plates = nextEnabled;
      }
      return next;
    });
    setCustomPlateInput('');
  };

  const handleDeletePlate = (plate) => {
    if (STANDARD_PLATES[activeUnit].includes(plate)) return;
    
    setConfig(prev => {
      const next = { ...prev };
      const barbell = next[activeUnit].barbell;
      next[activeUnit].barbell.plates = (barbell.plates || []).filter(p => p !== plate);
      next[activeUnit].barbell.enabled_plates = (barbell.enabled_plates || []).filter(p => p !== plate);
      return next;
    });
  };

  const handleAddDumbbellRule = () => {
    setConfig(prev => {
      const next = { ...prev };
      const rules = next[activeUnit].dumbbell.rules;
      const newRules = [...rules];
      const lastIndex = newRules.length - 1;
      const lastRule = newRules[lastIndex];
      
      let newLimit = 10;
      const limitedRules = newRules.filter(r => r.limit !== null && r.limit !== undefined);
      if (limitedRules.length > 0) {
        newLimit = Math.max(...limitedRules.map(r => parseFloat(r.limit) || 0)) + 10;
      }
      
      newRules.splice(lastIndex, 0, { limit: newLimit, step: lastRule.step });
      next[activeUnit].dumbbell.rules = newRules;
      return next;
    });
  };

  const handleRemoveDumbbellRule = (index) => {
    setConfig(prev => {
      const next = { ...prev };
      const rules = next[activeUnit].dumbbell.rules;
      if (rules.length <= 1) return prev;
      
      const newRules = rules.filter((_, idx) => idx !== index);
      next[activeUnit].dumbbell.rules = newRules;
      return next;
    });
  };

  const handleChangeDumbbellRule = (index, field, value) => {
    setConfig(prev => {
      const next = { ...prev };
      const rules = next[activeUnit].dumbbell.rules;
      const newRules = rules.map((rule, idx) => {
        if (idx === index) {
          const updated = { ...rule };
          if (field === 'limit') {
            updated.limit = value === '' ? null : parseFloat(value);
          } else {
            updated.step = parseFloat(value) || 0.1;
          }
          return updated;
        }
        return rule;
      });
      next[activeUnit].dumbbell.rules = newRules;
      return next;
    });
  };

  const handleReset = () => {
    const defaults = DEFAULT_GYM_EQUIPMENT_CONFIG[activeUnit];
    setConfig(prev => {
      const next = { ...prev };
      next[activeUnit] = JSON.parse(JSON.stringify(defaults));
      // 重置后同样进行一次标准化
      const rawUnit = next[activeUnit];
      if (!rawUnit.barbell) rawUnit.barbell = {};
      rawUnit.barbell.plates = [...STANDARD_PLATES[activeUnit]];
      rawUnit.barbell.enabled_plates = rawUnit.barbell.plates.filter(p => activeUnit === 'lbs' || p !== 0.5);
      return next;
    });
  };

  const handleSaveClick = () => {
    const nextConfig = JSON.parse(JSON.stringify(config));
    for (const unit of ['kg', 'lbs']) {
      if (nextConfig[unit]?.dumbbell?.rules) {
        const rules = nextConfig[unit].dumbbell.rules;
        const finite = rules.filter(r => r.limit !== null && r.limit !== undefined).sort((a, b) => a.limit - b.limit);
        const infinite = rules.filter(r => r.limit === null || r.limit === undefined);
        if (infinite.length === 0) {
          infinite.push({ limit: null, step: 2.5 });
        }
        nextConfig[unit].dumbbell.rules = [...finite, ...infinite];
      }
    }
    onSave(nextConfig);
    onClose();
  };

  const platesList = unitConfig.barbell?.plates || [];
  const dumbbellRules = unitConfig.dumbbell?.rules || [];

  const getDumbbellLabel = (idx) => {
    const isLast = idx === dumbbellRules.length - 1;
    if (!isLast) return `上限 ≤`;
    if (dumbbellRules.length > 1) {
      const prevLimit = dumbbellRules[idx - 1].limit;
      return `${prevLimit} ${activeUnit} 以上`;
    }
    return '全部重量';
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md bg-bg-card dark:bg-bg-card-dark text-text-main dark:text-text-main-dark border border-border-card dark:border-border-card-dark">
        <div className="flex items-center justify-between pb-3 border-b border-border-card dark:border-border-card-dark mb-4">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Settings size={18} className="text-primary" />健身房器材配重设置
          </h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-main text-lg font-bold">×</button>
        </div>

        {/* 顶部单位切换 */}
        <div className="flex bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card dark:border-border-card-dark rounded-lg p-0.5 gap-0.5 mb-4 select-none">
          {['kg', 'lbs'].map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setActiveUnit(u)}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                activeUnit === u
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main font-bold'
              }`}
            >
              {u.toUpperCase()} 模式配置
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {/* 1. 杠铃配置 */}
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
            <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark tracking-wider uppercase select-none">1. 杠铃空杆与可用配片</h4>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">杠铃空杆重量 ({activeUnit})</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={unitConfig.barbell?.bar_weight ?? ''}
                onChange={e => setUnitProp('barbell', 'bar_weight', parseFloat(e.target.value) || 0)}
                className="input input-bordered input-sm w-24 text-right bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark font-mono font-semibold"
              />
            </div>
            
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-xs font-semibold text-text-secondary/80">勾选可用的杠铃片规格（单侧）：</span>
              <div className="grid grid-cols-4 gap-2">
                {platesList.map(p => {
                  const isEnabled = (unitConfig.barbell?.enabled_plates || []).includes(p);
                  const isStandard = STANDARD_PLATES[activeUnit].includes(p);
                  return (
                    <div key={p} className="relative">
                      <button
                        type="button"
                        onClick={() => handleTogglePlate(p)}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isEnabled
                            ? 'bg-primary/10 border-primary text-primary font-black'
                            : 'bg-bg-card dark:bg-bg-card-dark border-border-card/50 dark:border-border-card-dark/50 text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        {p} {activeUnit}
                      </button>
                      {!isStandard && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlate(p);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-bg-card dark:border-bg-card-dark cursor-pointer opacity-80 hover:opacity-100"
                          title="彻底删除此规格"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 新增自定义杠铃片区域 */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-card/30 dark:border-border-card-dark/30">
                <span className="text-xs font-semibold text-text-secondary">自定义片重:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={customPlateInput}
                  onChange={e => setCustomPlateInput(e.target.value)}
                  className="input input-bordered input-sm w-20 text-center font-mono font-bold bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark"
                  placeholder="重量"
                />
                <span className="text-xs font-semibold text-text-secondary">{activeUnit}</span>
                <button
                  type="button"
                  onClick={handleAddPlate}
                  className="btn-aux h-8 px-2 flex items-center justify-center font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer"
                >
                  添加
                </button>
              </div>

              <p className="text-[10px] text-text-secondary mt-1 select-none">
                💡 自动圆整将排除未勾选的片。常用标准片不能删除，自定义添加的非标片可点击右上角 `×` 彻底清除。
              </p>
            </div>
          </div>

          {/* 2. 哑铃配置 */}
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark tracking-wider uppercase select-none">2. 哑铃分段递增规则</h4>
              <button
                type="button"
                onClick={handleAddDumbbellRule}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                ➕ 添加分段
              </button>
            </div>
            
            <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark/80 select-none leading-relaxed">
              💡 <b>多分段说明</b>：支持自定义多个重量区间的递增步长。例如第一段上限设为 10，步长为 2，系统会生成 2 至 10{activeUnit} 的规格。第二段上限设为 20，步长为 2.5，系统会继续接续生成 12.5 至 20{activeUnit} 的规格（即包含开区间 `(10, 20]`）。最后的一段为无上限，代表超出之前所有上限后的步长。如果您的健身房所有哑铃都使用同一个递增步长，只需点击 🗑️ 删掉其他所有的分段规则，只留下最后一条「全部重量」分段并设置您的步长即可。
            </p>

            <div className="space-y-2.5 mt-1">
              {dumbbellRules.map((rule, idx) => {
                const isLast = idx === dumbbellRules.length - 1;
                return (
                  <div key={idx} className="flex items-center gap-2 bg-bg-card dark:bg-bg-card-dark p-2 rounded-lg border border-border-card/30 dark:border-border-card-dark/30">
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-text-secondary truncate shrink-0">
                        {getDumbbellLabel(idx)}
                      </span>
                      {!isLast && (
                        <div className="flex items-center gap-1 min-w-0">
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            value={rule.limit ?? ''}
                            onChange={e => handleChangeDumbbellRule(idx, 'limit', e.target.value)}
                            className="input input-bordered input-sm w-16 text-center font-mono font-bold p-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark"
                            placeholder="上限"
                          />
                          <span className="text-xs font-semibold text-text-secondary shrink-0">{activeUnit}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-semibold text-text-secondary">步长</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={rule.step ?? ''}
                        onChange={e => handleChangeDumbbellRule(idx, 'step', e.target.value)}
                        className="input input-bordered input-sm w-16 text-center font-mono font-bold p-1 bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark"
                        placeholder="步长"
                      />
                      <span className="text-xs font-semibold text-text-secondary">{activeUnit}</span>
                    </div>

                    {!isLast && dumbbellRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDumbbellRule(idx)}
                        className="text-xs text-error hover:text-error/80 p-1 font-bold select-none shrink-0 cursor-pointer"
                        title="删除此分段"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 龙门架/插销器械配置 */}
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
            <h4 className="text-xs font-extrabold text-text-secondary dark:text-text-secondary-dark tracking-wider uppercase select-none">3. 龙门架与插销器械 (Cable/Machine)</h4>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">插销片递增步长 ({activeUnit})</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={unitConfig.cable?.step ?? ''}
                onChange={e => setUnitProp('cable', 'step', parseFloat(e.target.value) || 0)}
                className="input input-bordered input-sm w-24 text-right bg-bg-card dark:bg-bg-card-dark border-border-card dark:border-border-card-dark font-mono font-semibold"
              />
            </div>
            <p className="text-[10px] text-text-secondary select-none font-medium">
              💡 用于龙门架或固定器械，系统会自动将重量圆整为最临近的倍数（例如设为 5{activeUnit} 时，13{activeUnit} 将圆整为 15{activeUnit}）。
            </p>
          </div>
        </div>

        <div className="modal-action border-t border-border-card dark:border-border-card-dark pt-3 mt-4 flex items-center justify-between">
          <button type="button" onClick={handleReset} className="btn-sec btn-sm text-xs px-3 py-1 cursor-pointer">
            恢复默认
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-sec btn-sm px-4 py-1 cursor-pointer">取消</button>
            <button type="button" onClick={handleSaveClick} className="btn-main btn-sm px-5 py-1 text-white cursor-pointer font-bold">保存</button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export default MyPage;
