import { useState } from 'react';

/**
 * 热身组配置编辑器 — 从 ProgramConfigScreen GzclpConfig 中提取
 */
function WarmupSetsEditor({ enabled, onEnabledChange, sets, onSetsChange }) {
  const [open, setOpen] = useState(false);

  const update = (i, patch) => {
    const next = sets.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onSetsChange(next);
  };
  const remove = (i) => { onSetsChange(sets.filter((_, idx) => idx !== i)); };
  const add = () => { onSetsChange([...sets, { pct: 50, reps: 5 }]); };
  const applyDefault = () => { onSetsChange([{ pct: 50, reps: 5 }, { pct: 75, reps: 3 }]); };

  const label = sets && sets.length > 0
    ? sets.map(s => `${s.pct}%×${s.reps}下`).join(' → ')
    : '使用默认两组热身比例 (50%×5, 75%×3)';

  return (
    <div className="text-xs border border-border-card/50 dark:border-border-card-dark/50 rounded-md p-2 bg-bg-main/30 dark:bg-bg-main-dark/30 shadow-xs mt-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 font-bold text-text-main dark:text-text-main-dark cursor-pointer select-none">
          <input type="checkbox" checked={!!enabled} onChange={(e) => onEnabledChange(e.target.checked)} className="checkbox checkbox-xs checkbox-primary" />
          <span>配置热身组</span>
        </label>
        {enabled && (
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={() => setOpen(!open)} className="text-[10px] text-text-secondary dark:text-text-secondary-dark hover:text-text-main transition-colors font-bold cursor-pointer">
              配置详情 ({sets ? sets.length : 0}组) {open ? '▲' : '▼'}
            </button>
            <button type="button" onClick={applyDefault} className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer" title="一键应用默认热身组">
              ⚡ 默认热身组
            </button>
          </div>
        )}
      </div>
      {enabled && <div className="mt-1 text-[10px] text-text-secondary font-mono leading-tight">当前：{label}</div>}
      {enabled && open && (
        <div className="mt-2 pt-2 border-t border-border-card/40 dark:border-border-card-dark/40 space-y-1.5">
          {(sets || []).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-bg-main/40 dark:bg-bg-main-dark/40 p-1.5 rounded-md border border-border-card/30 dark:border-border-card-dark/30">
              <span className="text-[10px] text-text-secondary font-semibold shrink-0">第 {i+1} 组</span>
              <div className="flex items-center gap-1">
                <input type="number" value={s.pct || ''} min={1} max={200}
                  onChange={(e) => update(i, { pct: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  onBlur={() => { if (!s.pct || s.pct < 1) update(i, { pct: 50 }); }}
                  className="h-7 w-12 rounded border border-input bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0 text-text-main dark:text-text-main-dark" />
                <span className="text-[10px] text-text-secondary shrink-0">% 重量</span>
              </div>
              <span className="text-[10px] text-text-secondary/50 shrink-0">×</span>
              <div className="flex items-center gap-1">
                <input type="number" value={s.reps || ''} min={1} max={100}
                  onChange={(e) => update(i, { reps: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  onBlur={() => { if (!s.reps || s.reps < 1) update(i, { reps: 5 }); }}
                  className="h-7 w-10 rounded border border-input bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0 text-text-main dark:text-text-main-dark" />
                <span className="text-[10px] text-text-secondary shrink-0">次</span>
              </div>
              <button type="button" onClick={() => remove(i)} className="text-[10px] text-error hover:underline ml-auto font-bold cursor-pointer">删除</button>
            </div>
          ))}
          <button type="button" onClick={add} className="w-full py-1 border border-dashed border-border-card/60 dark:border-border-card-dark/60 rounded-md text-center text-xs text-text-secondary hover:text-text-main hover:bg-bg-main/30 font-bold cursor-pointer">
            + 新增热身组
          </button>
        </div>
      )}
    </div>
  );
}

export default WarmupSetsEditor;
