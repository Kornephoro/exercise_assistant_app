import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { calcE1RM, FORMULA_LABEL, MAIN_LIFTS, pickLatestByLift } from './oneRmUtils';
import { Loader2, Trash2, TrendingUp, Sparkles } from 'lucide-react';

const LIFT_COLORS = {
  squat: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  bench: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  deadlift: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
  press: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' },
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateCN = (iso) => {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  return String(iso);
};

function OneRMStrength({ onLatestChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  const [form, setForm] = useState({
    date: todayISO(),
    exercise: 'squat',
    weight: '',
    reps: '',
  });

  const latest = useMemo(() => pickLatestByLift(records), [records]);

  const liveE1rm = useMemo(() => {
    const w = parseFloat(form.weight);
    const r = parseInt(form.reps, 10);
    if (!w || !r) return null;
    return calcE1RM(w, r);
  }, [form.weight, form.reps]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('one_rm_records')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRecords(data || []);
    } catch (e) {
      setError('加载 1RM 记录失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (onLatestChange) onLatestChange(latest);
  }, [latest, onLatestChange]);

  const handleSave = async (e) => {
    e?.preventDefault();
    const w = parseFloat(form.weight);
    const r = parseInt(form.reps, 10);
    if (!w || w <= 0 || !r || r <= 0) {
      setError('请填写有效的重量和次数');
      setSaveMsg('');
      return;
    }
    const result = calcE1RM(w, r);
    if (!result.valid) {
      setError('次数过高（≥36）或重量无效，无法可靠推算 1RM');
      setSaveMsg('');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMsg('');
    try {
      const { error: err } = await supabase.from('one_rm_records').insert([{
        exercise: form.exercise,
        date: form.date,
        weight_kg: w,
        reps: r,
        e1rm_kg: result.e1rm,
        formula: result.formula,
        source: 'manual',
      }]);
      if (err) throw err;
      setSaveMsg('✓ 1RM 记录已保存');
      setForm(prev => ({ ...prev, weight: '', reps: '' }));
      await load();
    } catch (e) {
      setError('保存失败：' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这条 1RM 记录？')) return;
    try {
      const { error: err } = await supabase.from('one_rm_records').delete().eq('id', id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError('删除失败：' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark text-base border-l-4 px-3 py-2">
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="alert-box !border-success bg-green-500/10 !text-success text-base border-l-4 px-3 py-2">
          {saveMsg}
        </div>
      )}

      {/* 上：手动录入卡 + 4 主项概览 */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <section className="card md:col-span-2 flex flex-col gap-3">
          <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
            <Sparkles size={16} className="text-primary" />手动录入测试
          </h3>

          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">日期</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">动作</label>
              <select
                value={form.exercise}
                onChange={(e) => setForm(prev => ({ ...prev, exercise: e.target.value }))}
                className="select select-bordered w-full h-11 text-base font-bold bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
              >
                {MAIN_LIFTS.map(l => (
                  <option key={l.key} value={l.key}>{l.cn} ({l.key})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary dark:text-text-secondary-dark">重量 (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.weight}
                  onChange={(e) => setForm(prev => ({ ...prev, weight: e.target.value }))}
                  className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                  placeholder="100"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary dark:text-text-secondary-dark">次数</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="30"
                  value={form.reps}
                  onChange={(e) => setForm(prev => ({ ...prev, reps: e.target.value }))}
                  className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                  placeholder="5"
                  required
                />
              </div>
            </div>

            {liveE1rm && (
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-2 font-mono">
                💡 推算 1RM ≈ <span className="font-bold text-primary text-base">{liveE1rm.e1rm} kg</span>
                <span className="text-xs ml-1">（{FORMULA_LABEL[liveE1rm.formula]}）</span>
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-lg w-full mt-1 font-bold gap-1.5 shadow-md"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              <span>{saving ? '保存中...' : '保存 1RM 记录'}</span>
            </button>
          </form>
        </section>

        <section className="card md:col-span-5 flex flex-col gap-3">
          <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
            <TrendingUp size={16} className="text-primary" />力量水平概览
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-text-secondary dark:text-text-secondary-dark gap-2 text-base">
              <Loader2 className="animate-spin" size={18} />读取中...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 flex-1">
              {MAIN_LIFTS.map(lift => {
                const data = latest[lift.key];
                const c = LIFT_COLORS[lift.key];
                return (
                  <div
                    key={lift.key}
                    className={`border-2 rounded-2xl p-4 text-center flex flex-col justify-center ${c.bg} ${c.border}`}
                  >
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-bold">{lift.cn} 1RM</span>
                    <span className={`text-2xl font-black font-mono mt-1.5 ${c.text}`}>
                      {data ? `${data.weight} kg` : '--'}
                    </span>
                    {data && (
                      <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1 font-mono">
                        {formatDateCN(data.date)}
                        {data.source === 'manual' ? ' · 专测' : ' · 打卡推算'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-sm text-text-secondary dark:text-text-secondary-dark bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-2.5 leading-relaxed select-none">
            📊 上述 1RM 由手动测试 + 训练打卡自动推算，将在「GZCLP 主项进阶参数」中作为初始重量计算的参考。
          </p>
        </section>
      </div>

      {/* 下：1RM 历史记录 */}
      <section className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark select-none">
          1RM 历史记录明细
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-text-secondary dark:text-text-secondary-dark gap-2 text-sm">
            <Loader2 className="animate-spin" size={16} />读取中...
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-6 text-text-secondary dark:text-text-secondary-dark text-sm italic border border-dashed border-border-card dark:border-border-card-dark rounded-lg">
            暂无 1RM 记录。在上方手动录入，或完成训练打卡后自动写入。
          </div>
        ) : (
          <div className="overflow-x-auto border border-border-card/50 dark:border-border-card-dark/50 rounded-lg max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-bg-main/40 dark:bg-bg-main-dark/40 text-text-secondary dark:text-text-secondary-dark sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold">日期</th>
                  <th className="px-3 py-2.5 text-left font-bold">动作</th>
                  <th className="px-3 py-2.5 text-right font-bold">估算 1RM</th>
                  <th className="px-3 py-2.5 text-right font-bold">实测重量</th>
                  <th className="px-3 py-2.5 text-right font-bold">实测次数</th>
                  <th className="px-3 py-2.5 text-left font-bold">公式</th>
                  <th className="px-3 py-2.5 text-center font-bold">来源</th>
                  <th className="px-3 py-2.5 text-center font-bold w-10">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const lift = MAIN_LIFTS.find(l => l.key === r.exercise);
                  const c = LIFT_COLORS[r.exercise] || LIFT_COLORS.squat;
                  const isManual = r.source === 'manual';
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-border-card/30 dark:border-border-card-dark/30 last:border-b-0 transition-colors ${
                        isManual ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-bg-main/30 dark:hover:bg-bg-main-dark/30'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold text-text-main dark:text-text-main-dark">{r.date}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        <span className={c.text}>{lift?.cn || r.exercise}</span>
                        {isManual && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                            专测
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${c.text}`}>{r.e1rm_kg}kg</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{r.weight_kg}kg</td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{r.reps}次</td>
                      <td className="px-3 py-2.5 text-left text-text-secondary dark:text-text-secondary-dark text-xs">
                        {FORMULA_LABEL[r.formula] || r.formula || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-text-secondary dark:text-text-secondary-dark">
                        {isManual ? '手动' : '自动'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="text-text-secondary dark:text-text-secondary-dark hover:text-alert dark:hover:text-alert transition-colors p-0.5 active:scale-90"
                          title="删除此记录"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default OneRMStrength;
