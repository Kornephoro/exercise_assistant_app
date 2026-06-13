import { useState } from 'react';

const DEFAULT_T1_CHAIN = [
  { sets: 3, reps: 5, amrap: true },
  { sets: 4, reps: 3, amrap: false },
  { sets: 5, reps: 2, amrap: false }
];

const DEFAULT_T2_CHAIN = [
  { sets: 3, reps: 10, amrap: false },
  { sets: 3, reps: 8, amrap: false },
  { sets: 4, reps: 6, amrap: false }
];

/**
 * 进阶链编辑器 — 从 ProgramConfigScreen GzclpConfig 中提取
 */
function ProgressionChainEditor({ chain, onChange, tierLabel }) {
  const [open, setOpen] = useState(false);
  const tierColor = tierLabel === 'T1' ? 'text-tier-t1' : 'text-tier-t2';

  const update = (i, patch) => {
    const next = chain.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange(next);
  };
  const remove = (i) => {
    if (chain.length <= 1) return;
    onChange(chain.filter((_, idx) => idx !== i));
  };
  const add = () => {
    const last = chain[chain.length - 1];
    onChange([...chain, { sets: last?.sets ?? 3, reps: Math.max(1, (last?.reps ?? 10) - 2), amrap: last?.amrap ?? false }]);
  };
  const reset = () => {
    const defaults = tierLabel === 'T1' ? DEFAULT_T1_CHAIN : DEFAULT_T2_CHAIN;
    onChange(defaults.map(s => ({ ...s })));
  };

  const label = chain.map(s => `${s.sets}×${s.reps}${s.amrap ? '+' : ''}`).join(' → ');

  return (
    <div className="text-xs border border-border-card/50 dark:border-border-card-dark/50 rounded-md p-2 bg-bg-main/30 dark:bg-bg-main-dark/30 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 min-w-0 text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark transition-colors flex-1 text-left">
          <span className={`${tierColor} font-bold shrink-0`}>{tierLabel} 进阶链</span>
          <span className="text-[10px] font-mono text-text-secondary/80 dark:text-text-secondary-dark/80 truncate">({label})</span>
          <span className="text-[10px] ml-auto shrink-0">{open ? '▲' : '▼'}</span>
        </button>
        <button type="button" onClick={reset} className="text-[10px] text-text-secondary dark:text-text-secondary-dark hover:text-primary transition-colors shrink-0 px-1" title="恢复为默认 chain">
          ↺ 默认
        </button>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-border-card/40 dark:border-border-card-dark/40 space-y-1.5">
          {chain.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-bg-main/40 dark:bg-bg-main-dark/40 p-1.5 rounded-md border border-border-card/30 dark:border-border-card-dark/30">
              <div className="flex items-center gap-1">
                <input
                  type="number" value={s.sets || ''} min={1} max={20}
                  onChange={(e) => update(i, { sets: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  onBlur={() => { const v = parseInt(s.sets, 10); if (!v || v < 1) update(i, { sets: 3 }); }}
                  className="h-7 w-9 rounded border border-border-card dark:border-border-card-dark bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0 text-text-main dark:text-text-main-dark" />
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark shrink-0">组</span>
              </div>
              <span className="text-[10px] text-text-secondary/50 dark:text-text-secondary-dark/50 shrink-0">×</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" value={s.reps || ''} min={1} max={50}
                  onChange={(e) => update(i, { reps: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  onBlur={() => { const v = parseInt(s.reps, 10); if (!v || v < 1) update(i, { reps: 5 }); }}
                  className="h-7 w-9 rounded border border-border-card dark:border-border-card-dark bg-bg-card dark:bg-bg-card-dark text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary px-0 text-text-main dark:text-text-main-dark" />
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark shrink-0">次/组</span>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-text-secondary dark:text-text-secondary-dark cursor-pointer ml-1">
                <input type="checkbox" checked={!!s.amrap} onChange={(e) => update(i, { amrap: e.target.checked })} className="checkbox checkbox-xs checkbox-primary" />
                AMRAP
              </label>
              <button type="button" onClick={() => remove(i)} disabled={chain.length <= 1}
                className="text-[10px] text-error hover:underline ml-auto font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">删除</button>
            </div>
          ))}
          <button type="button" onClick={add} className="w-full py-1 border border-dashed border-border-card/60 dark:border-border-card-dark/60 rounded-md text-center text-xs text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark hover:bg-bg-main/30 font-bold cursor-pointer">
            + 新增阶段
          </button>
        </div>
      )}
    </div>
  );
}

export default ProgressionChainEditor;
