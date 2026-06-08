const SESSION_BUCKET_MS = 60 * 1000;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getWorkoutTime = (workout) => {
  const time = new Date(workout?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getLegacySessionKey = (workout) => {
  const time = getWorkoutTime(workout);
  if (!time) return 'legacy:unknown';
  return `legacy:${Math.floor(time / SESSION_BUCKET_MS)}`;
};

const getWorkoutFingerprint = (workout) => [
  workout.training_day || '',
  workout.tier || '',
  workout.exercise || '',
  workout.weight_kg ?? '',
  workout.planned_reps ?? '',
  workout.actual_last_set_reps ?? ''
].join('|');

const dedupeLegacyWorkouts = (workouts) => {
  const byFingerprint = new Map();
  workouts.forEach((workout) => {
    const key = getWorkoutFingerprint(workout);
    const existing = byFingerprint.get(key);
    if (!existing || getWorkoutTime(workout) > getWorkoutTime(existing)) {
      byFingerprint.set(key, workout);
    }
  });
  return Array.from(byFingerprint.values());
};

export const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(toNumber(seconds)));
  if (!safeSeconds) return '--';
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) return `${hours}小时${String(minutes).padStart(2, '0')}分`;
  if (minutes > 0) return `${minutes}分${String(secs).padStart(2, '0')}秒`;
  return `${secs}秒`;
};

export const formatDateTime = (dateLike) => {
  if (!dateLike) return '--';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatSetResult = (set) => {
  const weight = set.weight_kg;
  const reps = set.actual_reps ?? set.planned_reps;
  const duration = set.duration_seconds;
  const distance = set.distance_meters;

  if (duration !== null && duration !== undefined) return `${toNumber(duration)}秒`;
  if (distance !== null && distance !== undefined && weight !== null && weight !== undefined) {
    return `${toNumber(weight).toFixed(1)}kg × ${toNumber(distance)}m`;
  }
  if (distance !== null && distance !== undefined) return `${toNumber(distance)}m`;
  if (weight !== null && weight !== undefined && reps !== null && reps !== undefined) {
    return `${toNumber(weight).toFixed(1)}kg × ${toNumber(reps)}`;
  }
  if (reps !== null && reps !== undefined) return `${toNumber(reps)}次`;
  return set.completed ? '已完成' : '未记录';
};

export const getSetVolume = (set) => {
  if (set.is_warmup || set.completed === false) return 0;
  const weight = toNumber(set.weight_kg);
  const reps = toNumber(set.actual_reps ?? set.planned_reps);
  return weight > 0 && reps > 0 ? weight * reps : 0;
};

export const buildWorkoutSessions = (workouts = []) => {
  const grouped = new Map();

  workouts.forEach((workout) => {
    const key = workout.session_id
      ? `session:${workout.session_id}`
      : getLegacySessionKey(workout);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        sessionId: workout.session_id || null,
        workouts: [],
        startedAt: workout.created_at || null,
        durationSeconds: workout.session_duration_seconds || null,
        isLegacy: !workout.session_id
      });
    }

    const session = grouped.get(key);
    session.workouts.push(workout);

    if (getWorkoutTime(workout) < getWorkoutTime({ created_at: session.startedAt })) {
      session.startedAt = workout.created_at;
    }
    if (!session.durationSeconds && workout.session_duration_seconds) {
      session.durationSeconds = workout.session_duration_seconds;
    }
  });

  return Array.from(grouped.values()).map((session) => {
    const workoutsForSession = session.isLegacy
      ? dedupeLegacyWorkouts(session.workouts)
      : session.workouts;

    const exercises = workoutsForSession
      .slice()
      .sort((a, b) => getWorkoutTime(a) - getWorkoutTime(b) || (a.id || 0) - (b.id || 0))
      .map((workout) => {
        const sets = (workout.sets || [])
          .slice()
          .sort((a, b) => (a.set_number || 0) - (b.set_number || 0) || (a.id || 0) - (b.id || 0));

        return {
          ...workout,
          sets,
          effectiveSetCount: sets.filter(s => !s.is_warmup && s.completed !== false).length,
          volumeKg: sets.length > 0
            ? sets.reduce((sum, set) => sum + getSetVolume(set), 0)
            : toNumber(workout.weight_kg) * toNumber(workout.actual_last_set_reps)
        };
      });

    const totalVolumeKg = exercises.reduce((sum, ex) => sum + ex.volumeKg, 0);
    const totalSets = exercises.reduce((sum, ex) => sum + (
      ex.sets.length > 0
        ? ex.sets.filter(set => set.completed !== false).length
        : 1
    ), 0);

    return {
      ...session,
      workouts: workoutsForSession,
      exercises,
      totalVolumeKg,
      totalSets,
      exerciseCount: exercises.length,
      trainingDay: exercises[0]?.training_day || '',
      latestAt: exercises.reduce((latest, ex) => {
        const time = getWorkoutTime(ex);
        return time > getWorkoutTime({ created_at: latest }) ? ex.created_at : latest;
      }, session.startedAt)
    };
  }).sort((a, b) => getWorkoutTime({ created_at: b.latestAt }) - getWorkoutTime({ created_at: a.latestAt }));
};
