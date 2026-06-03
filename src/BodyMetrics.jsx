import { useState, useEffect } from 'react';
import { Heart, Save, Loader2, Activity, Zap } from 'lucide-react';

const STORAGE_KEY = 'body_metrics_history';
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function BodyMetrics() {
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({
    date: todayISO(),
    weight: '',
    waist: '',
    hr: '',
    sleep: '',
    fatigue: '5',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const w = parseFloat(form.weight);
    if (!w || w <= 0) {
      setSaveMsg('请填写有效的体重');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const entry = {
        date: form.date,
        weight: w,
        waist: parseFloat(form.waist) || null,
        hr: parseInt(form.hr, 10) || null,
        sleep: parseFloat(form.sleep) || null,
        fatigue: parseInt(form.fatigue, 10) || null,
        created_at: new Date().toISOString(),
      };
      const newHistory = [...history.filter(h => h.date !== form.date), entry].sort((a, b) => b.date.localeCompare(a.date));
      saveHistory(newHistory);
      setHistory(newHistory);
      setSaveMsg('✓ 已保存');
      setForm(prev => ({ ...prev, weight: '', waist: '', hr: '', sleep: '', fatigue: '5' }));
    } catch (err) {
      setSaveMsg('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const recent7 = history.slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Heart size={16} className="text-red-500" />今日身体记录
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">体重 (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm(prev => ({ ...prev, weight: e.target.value }))}
                className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                placeholder="75.0"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">腰围 (cm)</label>
              <input
                type="number"
                step="0.5"
                value={form.waist}
                onChange={(e) => setForm(prev => ({ ...prev, waist: e.target.value }))}
                className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                placeholder="80"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">静息心率</label>
              <input
                type="number"
                step="1"
                value={form.hr}
                onChange={(e) => setForm(prev => ({ ...prev, hr: e.target.value }))}
                className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                placeholder="65"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">睡眠 (h)</label>
              <input
                type="number"
                step="0.5"
                value={form.sleep}
                onChange={(e) => setForm(prev => ({ ...prev, sleep: e.target.value }))}
                className="input input-bordered w-full h-11 text-base font-mono bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary"
                placeholder="7.5"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary dark:text-text-secondary-dark flex items-center gap-1">
              <Zap size={12} />疲劳度 (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={form.fatigue}
              onChange={(e) => setForm(prev => ({ ...prev, fatigue: e.target.value }))}
              className="range range-primary"
            />
            <div className="flex justify-between text-xs text-text-secondary/40 font-mono px-1">
              <span>充沛 1</span><span>5</span><span>疲惫 10</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary btn-lg w-full font-bold gap-1.5 shadow-md mt-1"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>{saving ? '保存中...' : '保存今日记录'}</span>
          </button>

          {saveMsg && (
            <p className={`text-sm font-bold text-center ${saveMsg.startsWith('✓') ? 'text-success' : 'text-alert'}`}>
              {saveMsg}
            </p>
          )}
        </form>
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-text-main dark:text-text-main-dark pb-2 border-b border-border-card dark:border-border-card-dark flex items-center gap-2 select-none">
          <Activity size={16} className="text-primary" />近 7 天趋势
        </h3>

        {recent7.length === 0 ? (
          <p className="text-center py-4 text-text-secondary dark:text-text-secondary-dark text-sm italic border border-dashed border-border-card dark:border-border-card-dark rounded-lg">
            暂无数据
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-secondary dark:text-text-secondary-dark">
                <tr className="border-b border-border-card/50 dark:border-border-card-dark/50">
                  <th className="px-2 py-2 text-left font-bold">日期</th>
                  <th className="px-2 py-2 text-right font-bold">体重</th>
                  <th className="px-2 py-2 text-right font-bold">腰围</th>
                  <th className="px-2 py-2 text-right font-bold">心率</th>
                  <th className="px-2 py-2 text-right font-bold">睡眠</th>
                  <th className="px-2 py-2 text-right font-bold">疲劳</th>
                </tr>
              </thead>
              <tbody>
                {recent7.map(h => (
                  <tr key={h.date} className="border-b border-border-card/30 dark:border-border-card-dark/30 last:border-b-0">
                    <td className="px-2 py-2 font-mono text-text-main dark:text-text-main-dark">{h.date}</td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-text-main dark:text-text-main-dark">{h.weight}kg</td>
                    <td className="px-2 py-2 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.waist ? `${h.waist}cm` : '-'}</td>
                    <td className="px-2 py-2 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.hr || '-'}</td>
                    <td className="px-2 py-2 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.sleep ? `${h.sleep}h` : '-'}</td>
                    <td className="px-2 py-2 text-right font-mono text-text-secondary dark:text-text-secondary-dark">{h.fatigue || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-text-secondary dark:text-text-secondary-dark italic text-center opacity-60">
          💡 数据存储在本地浏览器，换设备或清缓存会丢失
        </p>
      </section>
    </div>
  );
}

export default BodyMetrics;
