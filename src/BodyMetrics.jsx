import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  fetchUserHeight,
  saveBodyMetrics,
  deleteBodyMetrics,
  fetchHistoryBodyMetrics,
  bulkInsertBodyMetrics
} from './services/bodyService';
import { getBmiInfo, getWhtrInfo } from './healthUtils';
import { Heart, Loader2, Activity, Zap, Trash2, ShieldAlert } from 'lucide-react';

const STORAGE_KEY = 'body_metrics_history';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateCN = (iso) => {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return String(iso);
};

// 样条曲线 Control Points 计算算法
const getBezierPath = (points) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) * 0.16;
    const cp1y = p1.y + (p2.y - p0.y) * 0.16;
    const cp2x = p2.x - (p3.x - p1.x) * 0.16;
    const cp2y = p2.y - (p3.y - p1.y) * 0.16;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
};

// BMI/WHtR 评估计算已从 healthUtils 导入

function BodyMetrics() {
  const [history, setHistory] = useState([]);
  const [userHeight, setUserHeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  
  // 图表参数
  const [activeMetric, setActiveMetric] = useState('weight');
  const [timeRange, setTimeRange] = useState('7'); // 7 / 14 / 30 天

  const [form, setForm] = useState({
    date: todayISO(),
    weight: '',
    waist: '',
    hr: '',
    sleep: '',
    fatigue: '5',
  });

  // 1. 加载身体指标历史数据与用户画像
  const loadData = async () => {
    await Promise.resolve();
    setLoading(true);
    setErrorMsg('');
    try {
      // 获取用户身高画像
      const height = await fetchUserHeight();
      if (height) {
        setUserHeight(height);
      }

      // 获取云端身体记录
      const dbHistory = await fetchHistoryBodyMetrics();
      setHistory(dbHistory);

      // 2. 本地 LocalStorage 历史记录迁移逻辑 (仅运行一次)
      const localHistoryStr = localStorage.getItem(STORAGE_KEY);
      if (localHistoryStr) {
        try {
          const localArr = JSON.parse(localHistoryStr) || [];
          if (localArr.length > 0) {
            // 过滤掉数据库中已存在同日期的记录
            const dbDates = new Set(dbHistory.map(h => h.date));
            const remainingToMigrate = localArr
              .filter(h => h.date && !dbDates.has(h.date))
              .map(h => ({
                date: h.date,
                weight_kg: Number(h.weight),
                waist_cm: parseFloat(h.waist) || null,
                heart_rate: parseInt(h.hr, 10) || null,
                sleep_hours: parseFloat(h.sleep) || null,
                fatigue_rating: parseInt(h.fatigue, 10) || 5,
              }));

            if (remainingToMigrate.length > 0) {
              await bulkInsertBodyMetrics(remainingToMigrate);
            }
            // 迁移成功后移除本地缓存
            localStorage.removeItem(STORAGE_KEY);
            setSaveMsg('🎉 已成功将您本地的历史身体指标迁移至云端！');
            // 重新加载以读取最新数据
            const refreshedMetrics = await fetchHistoryBodyMetrics();
            setHistory(refreshedMetrics || []);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (migrationErr) {
          console.warn('LocalStorage data migration failed:', migrationErr.message);
        }
      }
    } catch (err) {
      setErrorMsg('同步云端身体数据失败，部分功能可能受限：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  // 3. 提交保存今日身体数据 (如果当天已有记录则更新，无则新增)
  const handleSave = async (e) => {
    e.preventDefault();
    const w = parseFloat(form.weight);
    if (!w || w <= 0) {
      setSaveMsg('请填写有效的体重数值');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    setErrorMsg('');

    try {
      const entry = {
        date: form.date,
        weight_kg: w,
        waist_cm: parseFloat(form.waist) || null,
        heart_rate: parseInt(form.hr, 10) || null,
        sleep_hours: parseFloat(form.sleep) || null,
        fatigue_rating: parseInt(form.fatigue, 10) || null,
        updated_at: new Date().toISOString()
      };

      await saveBodyMetrics(entry);

      setSaveMsg('✓ 记录已成功保存');
      setForm(prev => ({ ...prev, weight: '', waist: '', hr: '', sleep: '', fatigue: '5' }));
      await loadData();
    } catch (err) {
      setSaveMsg('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 4. 删除历史记录
  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这条身体指标记录吗？')) return;
    try {
      await deleteBodyMetrics(id);
      await loadData();
    } catch (err) {
      setErrorMsg('删除失败：' + err.message);
    }
  };

  // 5. 数据计算与 SVG 折线图处理
  const recent10 = history.slice(0, 10);

  // SVG 内置虚拟尺寸规格
  const chartWidth = 400;
  const chartHeight = 180;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const xMin = paddingLeft;
  const xMax = chartWidth - paddingRight;
  const yMin = paddingTop;
  const yMax = chartHeight - paddingBottom;

  // 过滤当前时间区间内的数据
  const chartData = useMemo(() => {
    const sorted = [...history].reverse(); // 按日期从旧到新排序以便绘图
    const daysLimit = parseInt(timeRange, 10);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysLimit);
    limitDate.setHours(0, 0, 0, 0);
    return sorted.filter(item => new Date(item.date) >= limitDate);
  }, [history, timeRange]);

  // 从过滤后的数据中提取坐标点
  const points = useMemo(() => {
    const valid = chartData.filter(item => {
      if (activeMetric === 'weight') return item.weight_kg !== null && item.weight_kg !== undefined;
      if (activeMetric === 'waist') return item.waist_cm !== null && item.waist_cm !== undefined;
      if (activeMetric === 'hr') return item.heart_rate !== null && item.heart_rate !== undefined;
      if (activeMetric === 'sleep') return item.sleep_hours !== null && item.sleep_hours !== undefined;
      if (activeMetric === 'fatigue') return item.fatigue_rating !== null && item.fatigue_rating !== undefined;
      return false;
    });

    if (valid.length === 0) return [];

    const getVal = (item) => {
      if (activeMetric === 'weight') return Number(item.weight_kg);
      if (activeMetric === 'waist') return Number(item.waist_cm);
      if (activeMetric === 'hr') return Number(item.heart_rate);
      if (activeMetric === 'sleep') return Number(item.sleep_hours);
      if (activeMetric === 'fatigue') return Number(item.fatigue_rating);
      return 0;
    };

    const values = valid.map(getVal);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);

    // 计算 Y 轴上下预留边距，防止平顶线
    const range = maxVal - minVal;
    const padding = range === 0 ? 2 : range * 0.15;
    const plotMinY = minVal - padding;
    const plotMaxY = maxVal + padding;

    const count = valid.length;
    const stepX = count > 1 ? (xMax - xMin) / (count - 1) : 0;

    return valid.map((item, idx) => {
      const val = getVal(item);
      const x = count > 1 ? xMin + idx * stepX : (xMin + xMax) / 2;
      const y = maxVal === minVal
        ? (yMin + yMax) / 2
        : yMax - ((val - plotMinY) / (plotMaxY - plotMinY)) * (yMax - yMin);
      return {
        x,
        y,
        value: val,
        date: item.date,
      };
    });
  }, [chartData, activeMetric, xMin, xMax, yMin, yMax]);

  // 计算图表顶部区间统计数据
  const stats = useMemo(() => {
    if (points.length === 0) return { avg: '-', min: '-', max: '-' };
    const values = points.map(p => p.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const unitMap = { weight: 'kg', waist: 'cm', hr: 'bpm', sleep: 'h', fatigue: '分' };
    const unit = unitMap[activeMetric] || '';

    const formatVal = (v) => v.toFixed(activeMetric === 'hr' || activeMetric === 'fatigue' ? 0 : 1);
    return {
      avg: `${formatVal(avg)}${unit}`,
      min: `${formatVal(min)}${unit}`,
      max: `${formatVal(max)}${unit}`
    };
  }, [points, activeMetric]);

  // 渲染样条线路径
  const splinePath = useMemo(() => getBezierPath(points), [points]);
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    return `${splinePath} L ${points[points.length - 1].x} ${yMax} L ${points[0].x} ${yMax} Z`;
  }, [points, splinePath, yMax]);

  // SVG 悬停交互状态管理（requestAnimationFrame 节流，避免每次 mousemove 触发重渲染）
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);
  const rafRef = useRef(null);
  const latestCoordRef = useRef({ svgX: 0, hasEvent: false });

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = chartWidth / rect.width;
    latestCoordRef.current = { svgX: (e.clientX - rect.left) * scaleX, hasEvent: true };

    // 如果已有待处理的 RAF，跳过（合并到同一帧）
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!latestCoordRef.current.hasEvent) return;
      const { svgX } = latestCoordRef.current;
      latestCoordRef.current.hasEvent = false;

      // 寻觅 X 轴上最近的点
      let closestIdx = 0;
      let minDiff = Math.abs(points[0].x - svgX);
      for (let i = 1; i < points.length; i++) {
        const diff = Math.abs(points[i].x - svgX);
        if (diff < minDiff) { minDiff = diff; closestIdx = i; }
      }
      setHoveredIdx(closestIdx);
    });
  }, [points, chartWidth]);

  // 清理未完成的 RAF
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // 表单输入时的实时健康指标评估
  const liveBmi = useMemo(() => {
    return getBmiInfo(parseFloat(form.weight), userHeight);
  }, [form.weight, userHeight]);

  const liveWhtr = useMemo(() => {
    return getWhtrInfo(parseFloat(form.waist), userHeight);
  }, [form.waist, userHeight]);

  return (
    <div className="flex flex-col gap-4">
      {errorMsg && (
        <div className="mx-1 p-3 bg-bg-alert dark:bg-bg-alert-dark text-alert dark:text-alert-dark border-l-4 border-alert dark:border-alert-dark rounded-r-lg flex items-center gap-2 text-xs">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. 图表监控画布卡片 */}
      <section className="card flex flex-col gap-3">
        <div className="flex justify-between items-center pb-2 border-b border-border-card dark:border-border-card-dark select-none">
          <h3 className="card-title-standard mb-0 border-b-0 pb-0">
            <Activity size={16} className="text-primary" />历史指标监测走势
          </h3>
          <div className="flex gap-1">
            {['7', '14', '30'].map(range => (
              <button
                key={range}
                type="button"
                className={`btn btn-xs rounded font-bold transition-all px-2 ${
                  timeRange === range
                    ? 'btn-primary text-white shadow-sm'
                    : 'btn-ghost border border-border-card/40 text-text-secondary dark:text-text-secondary-dark'
                }`}
                onClick={() => setTimeRange(range)}
              >
                {range}天
              </button>
            ))}
          </div>
        </div>

        {/* 曲线类型页签选择 */}
        <div className="grid grid-cols-5 bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl p-1 gap-1 select-none">
          {[
            { key: 'weight', label: '体重', icon: '⚖️' },
            { key: 'waist', label: '腰围', icon: '📏' },
            { key: 'hr', label: '心率', icon: '💓' },
            { key: 'sleep', label: '睡眠', icon: '🛌' },
            { key: 'fatigue', label: '疲劳', icon: '⚡' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-extrabold transition-all ${
                activeMetric === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
              }`}
              onClick={() => {
                setActiveMetric(tab.key);
                setHoveredIdx(null);
              }}
            >
              <span>{tab.icon}</span>
              <span className="mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 顶部平均/最高/最低看板 */}
        <div className="grid grid-cols-3 gap-2 bg-bg-main/10 dark:bg-bg-main-dark/10 p-2 rounded-xl border border-border-card/40 dark:border-border-card-dark/40 text-center select-none text-xs">
          <div className="flex flex-col">
            <span className="text-text-secondary/70 font-semibold scale-90">区间平均</span>
            <span className="font-mono font-extrabold text-text-main dark:text-text-main-dark mt-0.5">{stats.avg}</span>
          </div>
          <div className="flex flex-col border-x border-border-card/40 dark:border-border-card-dark/40">
            <span className="text-text-secondary/70 font-semibold scale-90">最高记录</span>
            <span className="font-mono font-extrabold text-text-main dark:text-text-main-dark mt-0.5">{stats.max}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-text-secondary/70 font-semibold scale-90">最低记录</span>
            <span className="font-mono font-extrabold text-text-main dark:text-text-main-dark mt-0.5">{stats.min}</span>
          </div>
        </div>

        {/* HTML5 SVG Canvas 画图区 */}
        <div className="relative h-44 bg-bg-main/5 dark:bg-bg-main-dark/5 rounded-xl border border-border-card/30 dark:border-border-card-dark/30 overflow-hidden mt-1 select-none">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary text-xs gap-2">
              <span className="loading loading-spinner text-primary loading-sm"></span>
              <p>读取统计数据中...</p>
            </div>
          ) : points.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary/60 text-xs italic px-6 text-center">
              <span>该时段内无【{activeMetric === 'weight' ? '体重' : activeMetric === 'waist' ? '腰围' : activeMetric === 'hr' ? '静息心率' : activeMetric === 'sleep' ? '睡眠时长' : '疲劳度'}】记录，请在下方录入。</span>
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                width="100%"
                height="100%"
                className="overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  {/* 渐变渐亮填充 */}
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary, #ff6b35)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--color-primary, #ff6b35)" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* 背景水平网格参考线 */}
                <line x1={xMin} y1={yMin} x2={xMax} y2={yMin} className="stroke-border-card/20 dark:stroke-border-card-dark/20" strokeDasharray="3 3" />
                <line x1={xMin} y1={(yMin + yMax) / 2} x2={xMax} y2={(yMin + yMax) / 2} className="stroke-border-card/20 dark:stroke-border-card-dark/20" strokeDasharray="3 3" />
                <line x1={xMin} y1={yMax} x2={xMax} y2={yMax} className="stroke-border-card/20 dark:stroke-border-card-dark/20" strokeDasharray="3 3" />

                {/* X 轴日期刻度 */}
                {points.map((p, idx) => {
                  const showLabel =
                    points.length <= 7 ||
                    idx === 0 ||
                    idx === points.length - 1 ||
                    (points.length === 14 && idx % 3 === 0) ||
                    (points.length > 14 && idx % 5 === 0);
                  if (!showLabel) return null;
                  return (
                    <text
                      key={idx}
                      x={p.x}
                      y={yMax + 15}
                      textAnchor="middle"
                      className="fill-text-secondary/50 dark:fill-text-secondary-dark/50 text-[9px] font-mono font-semibold"
                    >
                      {formatDateCN(p.date)}
                    </text>
                  );
                })}

                {/* 1. 区域填充路径 */}
                {points.length >= 2 && (
                  <path d={areaPath} fill="url(#chartGradient)" />
                )}

                {/* 2. 样条折线主路径 */}
                <path
                  d={splinePath}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* 3. 散点标记 */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredIdx === idx ? 4 : 2}
                    className={`${hoveredIdx === idx ? 'fill-white stroke-primary stroke-[2]' : 'fill-primary'}`}
                  />
                ))}

                {/* 4. 悬停交互辅助线 & 高亮展示 */}
                {hoveredIdx !== null && points[hoveredIdx] && (
                  <>
                    <line
                      x1={points[hoveredIdx].x}
                      y1={yMin}
                      x2={points[hoveredIdx].x}
                      y2={yMax}
                      className="stroke-primary/40"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <circle
                      cx={points[hoveredIdx].x}
                      cy={points[hoveredIdx].y}
                      r="7"
                      className="fill-primary/20 stroke-primary/30 stroke-1 animate-ping"
                    />
                  </>
                )}
              </svg>

              {/* 5. 手势浮动交互 Tooltip */}
              {hoveredIdx !== null && points[hoveredIdx] && (() => {
                const p = points[hoveredIdx];
                const unitMap = { weight: 'kg', waist: 'cm', hr: 'bpm', sleep: 'h', fatigue: '分' };
                const unit = unitMap[activeMetric] || '';
                
                // 根据点所处横向位置防止超出侧边边界
                const isRightHalf = p.x > chartWidth * 0.55;
                const style = isRightHalf
                  ? { right: `${((chartWidth - p.x) / chartWidth) * 100}%`, marginRight: '10px' }
                  : { left: `${(p.x / chartWidth) * 100}%`, marginLeft: '10px' };

                return (
                  <div
                    className="absolute bg-bg-card/95 dark:bg-bg-card-dark/95 border border-border-card dark:border-border-card-dark rounded-xl shadow-lg px-2.5 py-1.5 pointer-events-none flex flex-col gap-0.5 z-10 transition-all duration-75 text-[10px]"
                    style={{
                      ...style,
                      top: `${Math.max(10, (p.y / chartHeight) * 100 - 25)}%`,
                    }}
                  >
                    <span className="text-text-secondary/70 font-mono font-bold leading-none">{p.date}</span>
                    <strong className="text-primary font-mono text-xs font-black mt-0.5 leading-none">
                      {p.value.toFixed(activeMetric === 'hr' || activeMetric === 'fatigue' ? 0 : 1)}
                      <span className="text-[10px] font-bold text-text-secondary ml-0.5">{unit}</span>
                    </strong>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </section>

      {/* 2. 今日身体数据录入表单 */}
      <section className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <Heart size={16} className="text-red-500" />今日数据录入
        </h3>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="section-subtitle">记录日期</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
              className="input-standard"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none">
                <label className="section-subtitle">体重 (kg)</label>
                {liveBmi && (
                  <span className={`badge badge-xs font-black px-1.5 py-0.5 scale-90 origin-right rounded ${liveBmi.badgeColor}`}>
                    {liveBmi.label}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm(prev => ({ ...prev, weight: e.target.value }))}
                className="input-standard"
                placeholder="体重 kg"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none">
                <label className="section-subtitle">腰围 (cm)</label>
                {liveWhtr && (
                  <span className={`badge badge-xs font-black px-1.5 py-0.5 scale-90 origin-right rounded ${liveWhtr.badgeColor}`}>
                    {liveWhtr.label}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.5"
                value={form.waist}
                onChange={(e) => setForm(prev => ({ ...prev, waist: e.target.value }))}
                className="input-standard"
                placeholder="腰围 cm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="section-subtitle">静息心率 (bpm)</label>
              <input
                type="number"
                step="1"
                value={form.hr}
                onChange={(e) => setForm(prev => ({ ...prev, hr: e.target.value }))}
                className="input-standard"
                placeholder="心率 bpm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="section-subtitle">睡眠时长 (h)</label>
              <input
                type="number"
                step="0.5"
                value={form.sleep}
                onChange={(e) => setForm(prev => ({ ...prev, sleep: e.target.value }))}
                className="input-standard"
                placeholder="时长 h"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            <label className="section-subtitle flex items-center gap-1">
              <Zap size={11} />主观疲劳度 (1 - 10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={form.fatigue}
              onChange={(e) => setForm(prev => ({ ...prev, fatigue: e.target.value }))}
              className="range range-primary range-xs cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-secondary/40 font-mono font-bold px-1 select-none">
              <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => setForm(prev => ({ ...prev, fatigue: '1' }))}>充沛 1</span>
              <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => setForm(prev => ({ ...prev, fatigue: '5' }))}>5</span>
              <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => setForm(prev => ({ ...prev, fatigue: '10' }))}>疲惫 10</span>
            </div>
          </div>

          {liveBmi && (
            <div className="bg-bg-main/30 dark:bg-bg-main-dark/30 rounded-xl p-2.5 border border-border-card/40 flex flex-col gap-1 select-none text-[10.5px] leading-relaxed text-text-secondary">
              <div>📈 **BMI（身体质量指数）**: <strong className="font-mono text-text-main dark:text-text-main-dark text-xs">{liveBmi.bmi}</strong>
                <span className={`ml-2 badge badge-sm font-bold scale-90 ${liveBmi.badgeColor}`}>{liveBmi.label}</span>
              </div>
              {liveWhtr && (
                <div className="mt-0.5">📏 **WHtR（腰围身高比）**: <strong className="font-mono text-text-main dark:text-text-main-dark text-xs">{liveWhtr.whtr}</strong>
                  <span className={`ml-2 badge badge-sm font-bold scale-90 ${liveWhtr.badgeColor}`}>{liveWhtr.label}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-main w-full mt-1"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            <span>{saving ? '保存中...' : '提交今日记录'}</span>
          </button>

          {saveMsg && (
            <p className={`text-xs font-extrabold text-center mt-1 ${saveMsg.startsWith('✓') || saveMsg.startsWith('🎉') ? 'text-success' : 'text-alert'}`}>
              {saveMsg}
            </p>
          )}
        </form>
      </section>

      {/* 3. 历史记录明细表 */}
      <section className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          历史指标记录明细 (最近 10 次)
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 text-text-secondary text-xs gap-2">
            <span className="loading loading-spinner text-primary loading-sm"></span>
            <p>加载详情列表...</p>
          </div>
        ) : history.length === 0 ? (
          <p className="text-center py-6 text-text-secondary dark:text-text-secondary-dark text-xs italic border border-dashed border-border-card dark:border-border-card-dark rounded-xl select-none">
            暂无历史数据。在上方录入今日身体指标即可查看。
          </p>
        ) : (
          <div className="overflow-x-auto border border-border-card/50 dark:border-border-card-dark/50 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-bg-main/30 dark:bg-bg-main-dark/30 text-text-secondary dark:text-text-secondary-dark font-bold">
                <tr className="border-b border-border-card/50 dark:border-border-card-dark/50 select-none">
                  <th className="px-2 py-2 text-left">日期</th>
                  <th className="px-2 py-2 text-right">体重</th>
                  <th className="px-2 py-2 text-right">腰围</th>
                  <th className="px-2 py-2 text-right">心率</th>
                  <th className="px-2 py-2 text-right">睡眠</th>
                  <th className="px-2 py-2 text-right">疲劳</th>
                  <th className="px-2 py-2 text-center w-8">操作</th>
                </tr>
              </thead>
              <tbody>
                {recent10.map(h => (
                  <tr key={h.id || h.date} className="border-b border-border-card/30 dark:border-border-card-dark/30 last:border-b-0 hover:bg-bg-hover/10 dark:hover:bg-bg-hover-dark/10">
                    <td className="px-2 py-2.5 font-mono text-text-main dark:text-text-main-dark font-bold">{h.date}</td>
                    <td className="px-2 py-2.5 text-right font-mono font-extrabold text-text-main dark:text-text-main-dark">{h.weight_kg}kg</td>
                    <td className="px-2 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.waist_cm ? `${h.waist_cm}cm` : '-'}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.heart_rate ? `${h.heart_rate}bpm` : '-'}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.sleep_hours ? `${h.sleep_hours}h` : '-'}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.fatigue_rating ? `${h.fatigue_rating}/10` : '-'}</td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        className="text-text-secondary hover:text-error active:scale-95 transition-all p-0.5 cursor-pointer"
                        title="删除记录"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default BodyMetrics;
