import { useState, useEffect, useMemo } from 'react';
import { fetchExercisesForLibrary } from './services/programService';
import {
  Loader2, Search, ChevronDown, ChevronRight, X,
  ShieldAlert, Filter
} from 'lucide-react';

const RECORDING_METHOD_MAP = {
  standard: '常规力量',
  reps_only: '仅次数',
  duration_only: '仅时长',
  distance_only: '仅距离',
  loaded_carry: '负重行走',
  bodyweight_added: '自重附加',
  bodyweight_assisted: '自重辅助',
};

function ExerciseLibrary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPattern, setFilterPattern] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExercisesForLibrary();
      setExercises(data || []);
    } catch (err) {
      setError('加载动作库失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const movementPatterns = useMemo(() => {
    const set = new Set();
    exercises.forEach(ex => {
      if (ex.movement_pattern) set.add(ex.movement_pattern);
    });
    return Array.from(set).sort();
  }, [exercises]);

  const equipmentOptions = useMemo(() => {
    const set = new Set();
    exercises.forEach(ex => {
      (ex.equipment || []).forEach(eq => set.add(eq));
    });
    return Array.from(set).sort();
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      if (filterPattern && ex.movement_pattern !== filterPattern) return false;
      if (filterEquipment && !(ex.equipment || []).includes(filterEquipment)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (ex.name || '').toLowerCase();
        const nameCn = (ex.name_cn || '').toLowerCase();
        const pattern = ex.movement_pattern || '';
        const primary = (ex.primary_muscles || []).join(' ');
        const equip = (ex.equipment || []).join(' ');
        if (!name.includes(q) && !nameCn.includes(q) && !pattern.includes(q) && !primary.includes(q) && !equip.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [exercises, searchQuery, filterPattern, filterEquipment]);

  const groupedExercises = useMemo(() => {
    const groups = {};
    filteredExercises.forEach(ex => {
      const pattern = ex.movement_pattern || '未分类';
      if (!groups[pattern]) groups[pattern] = [];
      groups[pattern].push(ex);
    });
    return groups;
  }, [filteredExercises]);

  const getCnName = (ex) => ex.name_cn || ex.name || '';

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary dark:text-text-secondary-dark gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm font-semibold">加载动作库...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-sm border-l-4">
          <ShieldAlert size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="input input-bordered flex items-center gap-2 flex-1 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary px-3 h-10 transition-colors">
          <Search size={16} className="text-text-secondary/50 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent text-sm font-semibold text-text-main dark:text-text-main-dark focus:outline-none"
            placeholder="搜索动作..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle p-0 cursor-pointer"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <select
          className="select-standard !h-9 !text-xs !rounded-lg flex-1"
          value={filterPattern}
          onChange={(e) => setFilterPattern(e.target.value)}
        >
          <option value="">全部动作模式</option>
          {movementPatterns.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          className="select-standard !h-9 !text-xs !rounded-lg flex-1"
          value={filterEquipment}
          onChange={(e) => setFilterEquipment(e.target.value)}
        >
          <option value="">全部器械</option>
          {equipmentOptions.map(eq => (
            <option key={eq} value={eq}>{eq}</option>
          ))}
        </select>
      </div>

      {(filterPattern || filterEquipment) && (
        <div className="flex items-center gap-2 text-xs">
          <Filter size={12} className="text-text-secondary" />
          <span className="text-text-secondary dark:text-text-secondary-dark">
            共 {filteredExercises.length} 个动作
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-primary cursor-pointer"
            onClick={() => { setFilterPattern(''); setFilterEquipment(''); }}
          >
            清除筛选
          </button>
        </div>
      )}

      {filteredExercises.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center gap-3 min-h-[200px] opacity-70">
          <Search size={36} className="text-text-secondary/40 dark:text-text-secondary-dark/40" />
          <p className="text-sm font-bold text-text-main dark:text-text-main-dark">
            {searchQuery || filterPattern || filterEquipment ? '未找到匹配的动作' : '动作库为空'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(groupedExercises).map(([pattern, exs]) => (
            <div key={pattern} className="flex flex-col gap-2">
              <h4 className="section-subtitle px-1 select-none">
                {pattern}
              </h4>
              <div className="flex flex-col gap-2">
                {exs.map(ex => {
                  const isExpanded = expandedId === ex.id;
                  return (
                    <div
                      key={ex.id}
                      className="card !p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                      onClick={() => toggleExpand(ex.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-text-main dark:text-text-main-dark truncate">
                              {getCnName(ex)}
                            </span>
                            {(ex.equipment || []).length > 0 && (
                              <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark whitespace-nowrap">
                                [{(ex.equipment || []).join(', ')}]
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(ex.primary_muscles || []).slice(0, 4).map(m => (
                              <span key={m} className="badge badge-primary badge-xs font-semibold text-[10px]">
                                {m}
                              </span>
                            ))}
                            {(ex.primary_muscles || []).length > 4 && (
                              <span className="badge badge-ghost badge-xs text-[10px]">
                                +{ex.primary_muscles.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="badge badge-ghost badge-sm text-xs font-semibold">
                            {RECORDING_METHOD_MAP[ex.recording_method] || ex.recording_method}
                          </span>
                          {isExpanded
                            ? <ChevronDown size={16} className="text-text-secondary/40" />
                            : <ChevronRight size={16} className="text-text-secondary/40" />
                          }
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border-card/50 dark:border-border-card-dark/50 animate-fadeIn">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <span className="font-bold text-text-secondary dark:text-text-secondary-dark">英文标识</span>
                              <p className="font-mono font-semibold text-text-main dark:text-text-main-dark mt-0.5">{ex.name}</p>
                            </div>
                            <div>
                              <span className="font-bold text-text-secondary dark:text-text-secondary-dark">记录方式</span>
                              <p className="font-semibold text-text-main dark:text-text-main-dark mt-0.5">
                                {RECORDING_METHOD_MAP[ex.recording_method] || ex.recording_method}
                              </p>
                            </div>
                            <div>
                              <span className="font-bold text-text-secondary dark:text-text-secondary-dark">动作模式</span>
                              <p className="font-semibold text-text-main dark:text-text-main-dark mt-0.5">{ex.movement_pattern || '-'}</p>
                            </div>
                            <div>
                              <span className="font-bold text-text-secondary dark:text-text-secondary-dark">器械</span>
                              <p className="font-semibold text-text-main dark:text-text-main-dark mt-0.5">
                                {(ex.equipment || []).join(', ') || '-'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <span className="font-bold text-text-secondary dark:text-text-secondary-dark">主肌群</span>
                              <p className="font-semibold text-text-main dark:text-text-main-dark mt-0.5">
                                {(ex.primary_muscles || []).join(', ') || '-'}
                              </p>
                            </div>
                            {(ex.secondary_muscles || []).length > 0 && (
                              <div className="col-span-2">
                                <span className="font-bold text-text-secondary dark:text-text-secondary-dark">辅助肌群</span>
                                <p className="font-semibold text-text-main dark:text-text-main-dark mt-0.5">
                                  {ex.secondary_muscles.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExerciseLibrary;
