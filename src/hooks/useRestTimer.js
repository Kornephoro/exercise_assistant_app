import { useState, useEffect, useRef } from 'react';

const DEFAULT_REST_SECONDS = 90;

/**
 * 组间休息计时 Hook — 从 App.jsx 中提取 ~80 行计时逻辑
 *
 * @param {Object} options
 * @param {() => { exerciseIdx: number, setIdx: number } | null} options.getFocusedSet - 当前聚焦的组
 * @param {Array} options.exercises - 今日训练动作列表
 * @param {Object} options.setsData - 各组数据
 * @param {(exIdx: number, setIdx: number) => void} options.openSetCard - 打开组卡片的回调
 * @returns {{ restTimer, setRestTimer }}
 */
export function useRestTimer({ getFocusedSet, getExercises, getSetsData, openSetCard }) {
  const [restTimer, setRestTimer] = useState({
    active: false,
    total: DEFAULT_REST_SECONDS,
    remaining: DEFAULT_REST_SECONDS,
    endTime: null,
    isMinimized: false
  });

  const restTimerRef = useRef(null);
  const timerStateRef = useRef({ focusedSet: null, exercises: [], setsData: {} });

  // 每帧同步最新数据到 ref，避免 effect 闭包陈旧
  useEffect(() => {
    timerStateRef.current = {
      focusedSet: getFocusedSet?.(),
      exercises: getExercises?.() || [],
      setsData: getSetsData?.() || {}
    };
  });

  // 寻找下一组
  const getNextSet = (currentExIdx, currentSetIdx, exercises, setsData) => {
    const currentSets = setsData[currentExIdx] || [];
    const nextInEx = currentSets.findIndex((s, idx) => idx > currentSetIdx && !s.completed && !s.skipped);
    if (nextInEx !== -1) return { exerciseIdx: currentExIdx, setIdx: nextInEx };
    for (let exIdx = currentExIdx + 1; exIdx < exercises.length; exIdx++) {
      const sets = setsData[exIdx] || [];
      const firstUncompleted = sets.findIndex(s => !s.completed && !s.skipped);
      if (firstUncompleted !== -1) return { exerciseIdx: exIdx, setIdx: firstUncompleted };
    }
    return null;
  };

  // 休息结束提示音
  const playRestEndSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Failed to play rest audio:", e);
    }
  };

  // 计时主循环
  useEffect(() => {
    if (restTimer.active && restTimer.endTime) {
      restTimerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.round((restTimer.endTime - now) / 1000));

        setRestTimer(prev => {
          if (diff <= 0) {
            clearInterval(restTimerRef.current);
            playRestEndSound();

            const currentFocused = timerStateRef.current.focusedSet;
            const currentExercises = timerStateRef.current.exercises;
            const currentSetsData = timerStateRef.current.setsData;
            if (currentFocused && currentExercises && currentSetsData) {
              const { exerciseIdx, setIdx } = currentFocused;
              const next = getNextSet(exerciseIdx, setIdx, currentExercises, currentSetsData);
              if (next) {
                openSetCard?.(next.exerciseIdx, next.setIdx);
              }
            }
            return { ...prev, active: false, remaining: 0, isMinimized: false };
          }
          return { ...prev, remaining: diff };
        });
      }, 200);
    }
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [restTimer.active, restTimer.endTime, openSetCard]);

  return { restTimer, setRestTimer };
}
