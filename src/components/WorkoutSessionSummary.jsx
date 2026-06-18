import { useState, useMemo } from 'react';
import { Activity, Calendar, ChevronDown, Clock, Dumbbell, ListChecks, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { buildWorkoutSessions, formatDateTime, formatDuration, formatSetMeta, formatSetResult } from '../utils/workoutSummary';

const TIER_STYLES = {
  T1: {
    badge: 'bg-tier-t1/10 text-tier-t1 dark:text-tier-t1-dark border-tier-t1/20 dark:border-tier-t1-dark/20',
    edge: 'border-l-tier-t1 dark:border-l-tier-t1-dark'
  },
  T2: {
    badge: 'bg-tier-t2/10 text-tier-t2 dark:text-tier-t2-dark border-tier-t2/20 dark:border-tier-t2-dark/20',
    edge: 'border-l-tier-t2 dark:border-l-tier-t2-dark'
  },
  T3: {
    badge: 'bg-tier-t3/10 text-tier-t3 dark:text-tier-t3-dark border-tier-t3/20 dark:border-tier-t3-dark/20',
    edge: 'border-l-tier-t3 dark:border-l-tier-t3-dark'
  }
};

const formatVolume = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '--';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}t`;
  return `${n.toFixed(1)}kg`;
};

const getExerciseWeightLabel = (exercise) => {
  const weights = (exercise.sets || [])
    .map(set => Number(set.weight_kg))
    .filter(weight => Number.isFinite(weight) && weight > 0);
  if (weights.length === 0 && exercise.weight_kg !== null && exercise.weight_kg !== undefined) {
    const weight = Number(exercise.weight_kg);
    return Number.isFinite(weight) ? `${weight.toFixed(1)}kg` : '--';
  }
  if (weights.length === 0) return '--';
  const unique = Array.from(new Set(weights.map(weight => weight.toFixed(1))));
  return unique.length === 1 ? `${unique[0]}kg` : `${unique[0]}-${unique[unique.length - 1]}kg`;
};

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-card/50 dark:border-border-card-dark/50 bg-bg-main/20 dark:bg-bg-main-dark/20 px-3 py-2 min-w-0">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark">
        <Icon size={12} />
        {label}
      </span>
      <span className="text-sm font-extrabold text-text-main dark:text-text-main-dark truncate">{value}</span>
    </div>
  );
}

function ExerciseSummary({ exercise, getExerciseCNName }) {
  const tier = exercise.tier || 'T1';
  const style = TIER_STYLES[tier] || TIER_STYLES.T1;
  const sets = exercise.sets || [];

  return (
    <section className={`rounded-xl border border-border-card dark:border-border-card-dark border-l-4 ${style.edge} bg-bg-main/10 dark:bg-bg-main-dark/20 p-3 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-extrabold text-text-main dark:text-text-main-dark truncate">
            {getExerciseCNName(exercise.exercise)}
          </h4>
          <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
            负重 {getExerciseWeightLabel(exercise)} · 容量 {formatVolume(exercise.volumeKg)}
          </p>
        </div>
        <span className={`badge badge-sm font-bold px-2 h-5 rounded border shrink-0 ${style.badge}`}>
          {tier}
        </span>
      </div>

      {sets.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {sets.map((set, index) => {
            const setMeta = formatSetMeta(set);
            const rawNotes = set.notes || '';
            const setNotes = rawNotes.replace(/\[训练心得:\s*([\s\S]*?)\]\n?/, '').trim();
            return (
              <div key={set.id || `${exercise.id}-${set.set_number}-${index}`} className="flex flex-col gap-1 w-full">
                <div
                  className="grid grid-cols-[52px_1fr_auto] items-center gap-2 rounded-lg bg-bg-card/70 dark:bg-bg-card-dark/70 border border-border-card/45 dark:border-border-card-dark/45 px-2.5 py-2"
                >
                  <span className={`text-[11px] font-bold ${set.is_warmup ? 'text-text-secondary dark:text-text-secondary-dark' : 'text-primary'}`}>
                    {set.is_warmup ? `热身${set.set_number}` : `第${set.set_number}组`}
                  </span>
                  <span className="text-sm font-bold text-text-main dark:text-text-main-dark truncate">
                    {formatSetResult(set)}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 min-w-0">
                    {setMeta && (
                      <span className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark truncate max-w-[104px]">
                        {setMeta}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold shrink-0 ${set.completed === false ? 'text-text-secondary dark:text-text-secondary-dark' : 'text-success'}`}>
                      {set.completed === false ? '未完成' : '完成'}
                    </span>
                  </div>
                </div>
                {setNotes && (
                  <div className="text-[10px] text-text-secondary/80 bg-bg-main/30 dark:bg-bg-main-dark/30 px-2.5 py-1.5 rounded-lg border border-border-card/30 flex items-start gap-1 select-none leading-relaxed ml-2">
                    <span className="shrink-0 text-primary">📝 备注:</span>
                    <span className="whitespace-pre-wrap">{setNotes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg bg-bg-card/70 dark:bg-bg-card-dark/70 border border-border-card/45 dark:border-border-card-dark/45 px-3 py-2 text-sm text-text-secondary dark:text-text-secondary-dark">
          摘要记录：末组 {exercise.actual_last_set_reps ?? '--'}，详细组数据缺失
        </div>
      )}
    </section>
  );
}

function ExerciseOverview({ exercise, getExerciseCNName }) {
  const tier = exercise.tier || 'T1';
  const style = TIER_STYLES[tier] || TIER_STYLES.T1;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border-card/45 dark:border-border-card-dark/45 bg-bg-main/10 dark:bg-bg-main-dark/20 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`badge badge-sm font-bold px-2 h-5 rounded border shrink-0 ${style.badge}`}>
          {tier}
        </span>
        <span className="text-sm font-extrabold text-text-main dark:text-text-main-dark truncate">
          {getExerciseCNName(exercise.exercise)}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-xs">
        <span className="font-bold text-text-main dark:text-text-main-dark">{formatVolume(exercise.volumeKg)}</span>
        <span className="text-text-secondary dark:text-text-secondary-dark">{exercise.effectiveSetCount || exercise.sets?.length || 1}组</span>
      </div>
    </div>
  );
}

function SessionSummaryCard({ session, getExerciseCNName, title, compact = false, onDelete = null }) {
  const [expanded, setExpanded] = useState(!compact);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const detailId = `session-detail-${session.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const sessionNotes = useMemo(() => {
    let notes = '';
    session.exercises.forEach(ex => {
      ex.sets?.forEach(set => {
        const rawNotes = set.notes || '';
        if (rawNotes) {
          const match = rawNotes.match(/\[训练心得:\s*([\s\S]*?)\]/);
          if (match) {
            notes = match[1];
          }
        }
      });
    });
    return notes.trim();
  }, [session]);

  const handleDelete = async (event) => {
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    // 确认删除
    setDeleting(true);
    try {
      if (onDelete) await onDelete(session);
    } catch {
      // 删除失败不关闭确认态，让用户重试
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = (event) => {
    event.stopPropagation();
    setConfirming(false);
  };

  return (
    <div
      className={`card flex flex-col gap-4 ${compact ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}`}
      role={compact ? 'button' : undefined}
      tabIndex={compact ? 0 : undefined}
      aria-expanded={compact ? expanded : undefined}
      aria-controls={compact ? detailId : undefined}
      onClick={compact ? () => setExpanded(prev => !prev) : undefined}
      onKeyDown={compact ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setExpanded(prev => !prev);
        }
      } : undefined}
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-text-main dark:text-text-main-dark">
              {title || '训练总结'}
            </h3>
            <p className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mt-1">
              {session.trainingDay ? `${session.trainingDay} · ` : ''}{formatDateTime(session.startedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="badge badge-primary badge-outline font-bold">
              {session.exerciseCount} 动作
            </span>
            {compact && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-text-secondary dark:text-text-secondary-dark">
                {expanded ? '收起' : '详情'}
                <ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </span>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`btn btn-xs rounded-lg font-bold transition-all ${
                  confirming
                    ? 'btn-error text-white'
                    : 'btn-ghost text-text-secondary hover:text-error hover:bg-error/10'
                }`}
                title={confirming ? '确认删除' : '删除此训练记录'}
              >
                {deleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : confirming ? (
                  <AlertTriangle size={12} />
                ) : (
                  <Trash2 size={12} />
                )}
                <span>{confirming ? '确认' : ''}</span>
              </button>
            )}
            {confirming && onDelete && (
              <button
                type="button"
                onClick={handleCancelDelete}
                className="btn btn-xs btn-ghost rounded-lg text-text-secondary font-bold"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Activity} label="本次容量" value={formatVolume(session.totalVolumeKg)} />
        <Stat icon={Clock} label="训练时间" value={formatDuration(session.durationSeconds)} />
        <Stat icon={Calendar} label="训练日期" value={formatDateTime(session.startedAt).split(' ')[0]} />
        <Stat icon={ListChecks} label="完成组数" value={`${session.totalSets} 组`} />
      </div>

      {sessionNotes && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex gap-2 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed select-none">
          <span className="text-primary font-bold shrink-0">🧠 训练心得:</span>
          <span className="whitespace-pre-wrap">{sessionNotes}</span>
        </div>
      )}

      {compact && (
        <div className="flex flex-col gap-2">
          {session.exercises.map((exercise) => (
            <ExerciseOverview
              key={exercise.id || `${session.key}-overview-${exercise.exercise}-${exercise.tier}`}
              exercise={exercise}
              getExerciseCNName={getExerciseCNName}
            />
          ))}
        </div>
      )}

      <div
        id={detailId}
        className={`flex flex-col gap-3 ${compact && !expanded ? 'hidden' : ''}`}
        onClick={compact ? (event) => event.stopPropagation() : undefined}
      >
        <div className="flex items-center gap-2 text-sm font-bold text-text-main dark:text-text-main-dark">
          <Dumbbell size={16} className="text-primary" />
          <span>动作明细</span>
        </div>

        <div className="flex flex-col gap-3">
          {session.exercises.map((exercise) => (
            <ExerciseSummary
              key={exercise.id || `${session.key}-${exercise.exercise}-${exercise.tier}`}
              exercise={exercise}
              getExerciseCNName={getExerciseCNName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkoutSessionSummary({ workouts, getExerciseCNName, title, latestOnly = false, compact = false, onDeleteSession = null }) {
  // onDeleteSession: 可选回调 (session) => Promise<void>，传入后每个会话卡片右上角显示删除按钮
  const sessions = buildWorkoutSessions(workouts);
  const visibleSessions = latestOnly ? sessions.slice(0, 1) : sessions;

  if (visibleSessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {visibleSessions.map((session, index) => (
        <SessionSummaryCard
          key={session.key}
          session={session}
          getExerciseCNName={getExerciseCNName}
          compact={compact}
          onDelete={onDeleteSession}
          title={latestOnly || visibleSessions.length === 1 ? title : `${title || '训练总结'} · 第 ${visibleSessions.length - index} 次`}
        />
      ))}
    </div>
  );
}

export default WorkoutSessionSummary;
