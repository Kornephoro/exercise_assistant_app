/**
 * 训练相关纯工具函数
 */

/**
 * 寻找下一组未完成且未跳过的训练组
 * @param {number} currentExIdx - 当前动作索引
 * @param {number} currentSetIdx - 当前组索引
 * @param {Array} exercises - 动作列表
 * @param {Object} setsData - 各组数据 { [exIdx]: [{completed, skipped}, ...] }
 * @returns {{ exerciseIdx: number, setIdx: number } | null}
 */
export function getNextSet(currentExIdx, currentSetIdx, exercises, setsData) {
  const currentSets = setsData[currentExIdx] || [];
  const nextInEx = currentSets.findIndex(
    (s, idx) => idx > currentSetIdx && !s.completed && !s.skipped
  );
  if (nextInEx !== -1) return { exerciseIdx: currentExIdx, setIdx: nextInEx };

  for (let exIdx = currentExIdx + 1; exIdx < exercises.length; exIdx++) {
    const sets = setsData[exIdx] || [];
    const firstUncompleted = sets.findIndex(s => !s.completed && !s.skipped);
    if (firstUncompleted !== -1) return { exerciseIdx: exIdx, setIdx: firstUncompleted };
  }
  return null;
}
