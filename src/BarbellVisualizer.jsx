import { useState, useMemo, useEffect, useRef } from 'react';

// 标准 IPF/IWF 杠铃片颜色与尺寸配置 (KG 模式)
const PLATE_CONFIGS_KG = {
  '25': { color: '#EF4444', gradient: ['#F87171', '#EF4444', '#991B1B'], height: 72, width: 14 },
  '20': { color: '#3B82F6', gradient: ['#60A5FA', '#3B82F6', '#1E40AF'], height: 72, width: 12 },
  '15': { color: '#FBBF24', gradient: ['#FDE047', '#FBBF24', '#78350F'], height: 72, width: 10 },
  '10': { color: '#34D399', gradient: ['#6EE7B7', '#34D399', '#064E3B'], height: 72, width: 8 },
  '5': { color: '#F3F4F6', gradient: ['#FFFFFF', '#E5E7EB', '#4B5563'], height: 50, width: 7, border: '#9CA3AF' },
  '2.5': { color: '#4B5563', gradient: ['#6B7280', '#4B5563', '#111827'], height: 40, width: 6 },
  '1.25': { color: '#E5E7EB', gradient: ['#F3F4F6', '#D1D5DB', '#374151'], height: 32, width: 5 },
  '0.5': { color: '#F9FAFB', gradient: ['#FFFFFF', '#F3F4F6', '#9CA3AF'], height: 24, width: 4 }
};

// 标准杠铃片颜色与尺寸配置 (LBS 模式)
const PLATE_CONFIGS_LBS = {
  '55': { color: '#EF4444', gradient: ['#F87171', '#EF4444', '#991B1B'], height: 72, width: 14 },
  '45': { color: '#3B82F6', gradient: ['#60A5FA', '#3B82F6', '#1E40AF'], height: 72, width: 12 },
  '35': { color: '#FBBF24', gradient: ['#FDE047', '#FBBF24', '#78350F'], height: 72, width: 10 },
  '25': { color: '#34D399', gradient: ['#6EE7B7', '#34D399', '#064E3B'], height: 72, width: 8 },
  '15': { color: '#F3F4F6', gradient: ['#FFFFFF', '#E5E7EB', '#4B5563'], height: 50, width: 7, border: '#9CA3AF' },
  '10': { color: '#4B5563', gradient: ['#6B7280', '#4B5563', '#111827'], height: 40, width: 6 },
  '5': { color: '#E5E7EB', gradient: ['#F3F4F6', '#D1D5DB', '#374151'], height: 32, width: 5 },
  '2.5': { color: '#F9FAFB', gradient: ['#FFFFFF', '#F3F4F6', '#9CA3AF'], height: 24, width: 4 }
};

const ALL_STANDARD_PLATES = new Set([25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25, 0.5, 45.0, 35.0]);

function getPlateLimit(originalP, plateLimits, isStandard) {
  if (!plateLimits || typeof plateLimits !== 'object') {
    return isStandard ? Infinity : 1;
  }
  
  if (plateLimits[originalP] !== undefined && plateLimits[originalP] !== null) {
    return parseInt(plateLimits[originalP], 10);
  }
  
  const strKey = parseFloat(originalP).toString();
  if (plateLimits[strKey] !== undefined && plateLimits[strKey] !== null) {
    return parseInt(plateLimits[strKey], 10);
  }
  
  const floatKey1 = parseFloat(originalP).toFixed(1);
  if (plateLimits[floatKey1] !== undefined && plateLimits[floatKey1] !== null) {
    return parseInt(plateLimits[floatKey1], 10);
  }
  
  const floatKey2 = parseFloat(originalP).toFixed(2);
  if (plateLimits[floatKey2] !== undefined && plateLimits[floatKey2] !== null) {
    return parseInt(plateLimits[floatKey2], 10);
  }
  
  return isStandard ? Infinity : 1;
}

function generateAlternativePlates(target, enabledPlates = [], plateLimits = {}) {
  const sorted = [...enabledPlates]
    .map(p => parseFloat(p))
    .filter(p => !isNaN(p) && p > 0)
    .sort((a, b) => b - a);

  if (sorted.length === 0 || target <= 0) return [];

  const results = [];
  const current = [];
  const seen = new Set();

  function dfs(index, remaining) {
    if (results.length >= 15) return;
    if (Math.abs(remaining) < 0.01) {
      const sortedCombo = [...current].sort((a, b) => b - a);
      const key = sortedCombo.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        results.push(sortedCombo);
      }
      return;
    }
    if (remaining < -0.01 || index >= sorted.length) {
      return;
    }

    const p = sorted[index];
    const isStandard = ALL_STANDARD_PLATES.has(p);
    const limit = getPlateLimit(p, plateLimits, isStandard);
    
    const maxQty = limit === Infinity ? 6 : limit;

    for (let qty = 0; qty <= maxQty; qty++) {
      if (qty * p > remaining + 0.01) break;
      for (let k = 0; k < qty; k++) current.push(p);
      dfs(index + 1, remaining - qty * p);
      for (let k = 0; k < qty; k++) current.pop();
    }
  }

  dfs(0, target);

  results.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const costA = a.reduce((sum, p) => sum + (ALL_STANDARD_PLATES.has(p) ? 0 : 1), 0);
    const costB = b.reduce((sum, p) => sum + (ALL_STANDARD_PLATES.has(p) ? 0 : 1), 0);
    return costA - costB;
  });

  return results;
}

export function BarbellVisualizer({ plates = [], barWeight = 20, unit = 'kg', enabledPlates = [], plateLimits = {} }) {
  const totalPlateWeight = plates.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);
  const roundedPlatesWeight = Math.round(totalPlateWeight * 100) / 100;

  // 独立高交互性的空杆重 state
  const [activeBarWeight, setActiveBarWeight] = useState(barWeight);

  // 同步外部 barWeight 变更（如单位切换）到内部 state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveBarWeight(barWeight);
  }, [barWeight]);

  // 总重 (根据 parent 传入的 plates 计算出来的目标总重)
  const totalWeight = useMemo(() => {
    return roundedPlatesWeight * 2 + barWeight;
  }, [roundedPlatesWeight, barWeight]);

  // 根据当前空杆重，动态计算出所需的单侧挂重
  const targetPlateWeight = Math.max(0, (totalWeight - activeBarWeight) / 2);

  const [selectedIdx, setSelectedIdx] = useState(0);

  // 当目标单侧挂重变化时，自动重置备选配片方案的选中索引
  const prevWeightRef = useRef(targetPlateWeight);
  useEffect(() => {
    if (targetPlateWeight !== prevWeightRef.current) {
      prevWeightRef.current = targetPlateWeight;
      setSelectedIdx(0);
    }
  }, [targetPlateWeight]);

  // 循环切换空杆重
  const toggleBarWeight = () => {
    if (unit === 'lbs') {
      setActiveBarWeight(prev => {
        if (prev === 45) return 35;
        if (prev === 35) return 25;
        return 45;
      });
    } else {
      setActiveBarWeight(prev => {
        if (prev === 20) return 15;
        if (prev === 15) return 10;
        return 20;
      });
    }
  };

  // 使用 useMemo 进行纯数据备选组合推导，避免 effect 级联渲染
  const alternatives = useMemo(() => {
    const altCombos = generateAlternativePlates(targetPlateWeight, enabledPlates, plateLimits);
    const defaultKey = [...plates]
      .map(p => parseFloat(p))
      .filter(p => !isNaN(p) && p > 0)
      .sort((a, b) => b - a)
      .join(',');
    
    let finalCombos = altCombos;
    // 只有当目标单侧挂重等于 parent 传入的单侧挂重时，才尝试包含 parent 的默认组合
    if (Math.abs(targetPlateWeight - roundedPlatesWeight) < 0.01) {
      const hasDefault = altCombos.some(c => c.join(',') === defaultKey);
      if (!hasDefault && defaultKey) {
        const defaultCombo = [...plates].map(p => parseFloat(p)).filter(p => !isNaN(p) && p > 0).sort((a, b) => b - a);
        finalCombos = [defaultCombo, ...altCombos];
      }
    }
    return finalCombos.slice(0, 4);
  }, [targetPlateWeight, roundedPlatesWeight, enabledPlates, plateLimits, plates]);

  // 获取当前选择方案的杠铃片列表
  const currentPlates = alternatives[selectedIdx] || (activeBarWeight === barWeight ? plates : []);
  const sortedPlates = [...currentPlates]
    .map(p => parseFloat(p))
    .filter(p => !isNaN(p) && p > 0)
    .sort((a, b) => b - a);

  // SVG 布局尺寸
  const viewWidth = 120;
  const viewHeight = 80;
  const centerY = 40;

  // 内侧卡环位置
  const collarX = 14;
  const collarW = 3;
  const collarH = 28;
  const collarY = centerY - collarH / 2;

  // 挂片套筒位置
  const sleeveX = collarX + collarW;
  const sleeveW = 100;
  const sleeveH = 8;
  const sleeveY = centerY - sleeveH / 2;

  let currentX = sleeveX + 1;
  const plateElements = [];

  sortedPlates.forEach((w, index) => {
    const key = w.toString();
    const configs = unit === 'lbs' ? PLATE_CONFIGS_LBS : PLATE_CONFIGS_KG;
    let config = configs[key];

    if (!config) {
      const baseMax = unit === 'lbs' ? 45 : 25;
      const h = w >= (unit === 'lbs' ? 25 : 10)
        ? 72
        : Math.max(24, Math.min(72, 24 + (w / (unit === 'lbs' ? 25 : 10)) * 48));
      const wWidth = Math.max(4, Math.min(14, 4 + (w / baseMax) * 10));
      config = {
        color: '#9333EA',
        gradient: ['#D8B4FE', '#9333EA', '#581C87'],
        height: h,
        width: wWidth
      };
    }

    const gradId = `plate-grad-${key.replace('.', '_')}`;
    const { height: h, width: wWidth, border } = config;
    const y = centerY - h / 2;

    plateElements.push(
      <rect
        key={`plate-${index}-${w}`}
        x={currentX}
        y={y}
        width={wWidth}
        height={h}
        rx={1}
        fill={`url(#${gradId})`}
        stroke={border || 'rgba(0, 0, 0, 0.25)'}
        strokeWidth={0.5}
      />
    );

    currentX += wWidth + 1;
  });

  // 格式化备选方案文字描述 (例如 "20 × 1 + 5 × 1")
  const getAltLabel = (combo) => {
    if (combo.length === 0) return '空杆';
    const counts = {};
    combo.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map(([plate, count]) => `${plate} × ${count}`)
      .join(' + ');
  };

  return (
    <div className="flex flex-row items-stretch gap-4 p-3 rounded-xl bg-bg-main/30 dark:bg-bg-main-dark/30 border border-border-card/50 dark:border-border-card-dark/50 shadow-sm w-full select-none">
      {/* 左栏 60%：杠铃片 SVG 图示 */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 border-r border-border-card/25 dark:border-border-card-dark/25 pr-3">
        <div className="relative w-full flex justify-center overflow-hidden">
          <svg
            width="100%"
            height={viewHeight}
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="w-full h-auto max-h-[76px] overflow-visible"
          >
            {/* 线性金属渐变 */}
            <defs>
              <linearGradient id="shaft-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#9CA3AF" />
                <stop offset="50%" stopColor="#4B5563" />
                <stop offset="100%" stopColor="#1F2937" />
              </linearGradient>
              <linearGradient id="collar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#E5E7EB" />
                <stop offset="30%" stopColor="#9CA3AF" />
                <stop offset="70%" stopColor="#4B5563" />
                <stop offset="100%" stopColor="#1F2937" />
              </linearGradient>
              <linearGradient id="sleeve-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F9FAFB" />
                <stop offset="30%" stopColor="#E5E7EB" />
                <stop offset="70%" stopColor="#9CA3AF" />
                <stop offset="100%" stopColor="#4B5563" />
              </linearGradient>
              {/* 配片颜色渐变（每种重量仅生成一次，避免循环内重复 <defs>） */}
              {gradientDefs.map(({ gradId, config }) => (
                <linearGradient key={gradId} id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={config.gradient[0]} />
                  <stop offset="40%" stopColor={config.gradient[1]} />
                  <stop offset="100%" stopColor={config.gradient[2]} />
                </linearGradient>
              ))}
            </defs>

            {/* 左侧细手柄 */}
            <rect
              x={2}
              y={37.5}
              width={12}
              height={5}
              rx={0.5}
              fill="url(#shaft-grad)"
              stroke="rgba(0, 0, 0, 0.2)"
              strokeWidth={0.5}
            />

            {/* 挂片套筒 */}
            <rect
              x={sleeveX}
              y={sleeveY}
              width={sleeveW}
              height={sleeveH}
              rx={1}
              fill="url(#sleeve-grad)"
              stroke="rgba(0, 0, 0, 0.15)"
              strokeWidth={0.5}
            />

            {/* 杠铃卡环 */}
            <rect
              x={collarX}
              y={collarY}
              width={collarW}
              height={collarH}
              rx={0.5}
              fill="url(#collar-grad)"
              stroke="rgba(0, 0, 0, 0.25)"
              strokeWidth={0.5}
            />

            {/* 绘制杠铃片 */}
            {plateElements}

            {/* 套筒顶端阻挡盖 */}
            <rect
              x={sleeveX + sleeveW}
              y={sleeveY}
              width={2}
              height={sleeveH}
              rx={0.5}
              fill="#4B5563"
            />
          </svg>
        </div>
        
        <div className="flex items-center gap-1.5 justify-center flex-wrap mt-1.5 shrink-0">
          <span className="text-xs font-black px-1.5 py-0.5 rounded bg-bg-card dark:bg-bg-card-dark border border-border-card/50 dark:border-border-card-dark/50 text-text-secondary dark:text-text-secondary-dark font-mono">
            单侧挂重: {targetPlateWeight} {unit}
          </span>
          <button
            type="button"
            onClick={toggleBarWeight}
            className="text-xs font-black px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
          >
            空杆: {activeBarWeight} {unit} 🔄
          </button>
        </div>
      </div>

      {/* 右栏 40%：备选方案列表 */}
      <div className="w-[135px] shrink-0 flex flex-col justify-center gap-1.5">
        <span className="text-xs font-black text-text-muted dark:text-text-secondary-dark tracking-wider uppercase select-none">
          🎯 配片备选方案
        </span>
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[85px] pr-0.5">
          {alternatives.length > 0 ? (
            alternatives.map((combo, idx) => (
              <button
                key={combo.join('-') || 'empty'}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`text-xs font-bold p-1.5 rounded-lg border text-left transition-all leading-snug break-all ${
                  selectedIdx === idx
                    ? 'bg-primary/15 border-primary text-primary font-extrabold shadow-sm'
                    : 'bg-bg-card dark:bg-bg-card-dark border-border-card/50 dark:border-border-card-dark/50 text-text-secondary dark:text-text-secondary-dark hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedIdx === idx ? 'bg-primary' : 'bg-text-muted/30'}`}></span>
                  <span className="truncate">{idx === 0 ? '最佳推荐' : `方案 ${idx + 1}`}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] pl-2.5 opacity-90">
                  {getAltLabel(combo)}
                </div>
              </button>
            ))
          ) : (
            <div className="text-xs text-text-muted italic py-2">无备选方案</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BarbellVisualizer;
