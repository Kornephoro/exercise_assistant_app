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
  const currentEx = exercises[currentExIdx];

  // 1. 如果当前动作是超级组的一部分，先在当前超级组内交替寻找下一组
  if (currentEx && currentEx.superset_id) {
    const supersetExs = exercises
      .map((ex, idx) => ({ ex, idx }))
      .filter(e => e.ex.superset_id === currentEx.superset_id);

    // 生成当前超级组所有动作组次的交替扁平序列
    const supersetSeq = [];
    const maxSets = Math.max(...supersetExs.map(e => (setsData[e.idx] || []).length));
    
    for (let round = 0; round < maxSets; round++) {
      supersetExs.forEach(e => {
        const sets = setsData[e.idx] || [];
        if (round < sets.length) {
          supersetSeq.push({
            exerciseIdx: e.idx,
            setIdx: round,
            setObj: sets[round]
          });
        }
      });
    }

    // 找到当前组在扁平序列中的索引
    const curSeqIdx = supersetSeq.findIndex(
      s => s.exerciseIdx === currentExIdx && s.setIdx === currentSetIdx
    );

    if (curSeqIdx !== -1) {
      // 从当前位置往后找第一个未完成且未跳过的组
      for (let i = curSeqIdx + 1; i < supersetSeq.length; i++) {
        const item = supersetSeq[i];
        if (!item.setObj.completed && !item.setObj.skipped) {
          return { exerciseIdx: item.exerciseIdx, setIdx: item.setIdx };
        }
      }
    }
  }

  // 2. 如果当前动作不是超级组，或者当前超级组内所有后续组均已完成/跳过，
  // 按照线性顺序寻找下一个动作（跳过已处理过的属于相同超级组的动作）
  const processedSupersets = new Set();
  if (currentEx && currentEx.superset_id) {
    processedSupersets.add(currentEx.superset_id);
  }

  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const ex = exercises[exIdx];
    if (ex.superset_id && processedSupersets.has(ex.superset_id)) {
      continue;
    }
    
    let currentGroupMaxIdx = currentExIdx;
    if (currentEx && currentEx.superset_id) {
      const groupIndices = exercises
        .map((e, idx) => ({ e, idx }))
        .filter(e => e.e.superset_id === currentEx.superset_id)
        .map(e => e.idx);
      currentGroupMaxIdx = Math.max(...groupIndices);
    }

    if (exIdx <= currentGroupMaxIdx) {
      if (ex.superset_id) processedSupersets.add(ex.superset_id);
      continue;
    }

    // 检查这个动作
    if (ex.superset_id) {
      processedSupersets.add(ex.superset_id);
      const ssExs = exercises
        .map((e, idx) => ({ e, idx }))
        .filter(e => e.e.superset_id === ex.superset_id);

      const ssSeq = [];
      const maxSets = Math.max(...ssExs.map(e => (setsData[e.idx] || []).length));
      for (let round = 0; round < maxSets; round++) {
        ssExs.forEach(e => {
          const sets = setsData[e.idx] || [];
          if (round < sets.length) {
            ssSeq.push({ exerciseIdx: e.idx, setIdx: round, setObj: sets[round] });
          }
        });
      }

      const found = ssSeq.find(item => !item.setObj.completed && !item.setObj.skipped);
      if (found) {
        return { exerciseIdx: found.exerciseIdx, setIdx: found.setIdx };
      }
    } else {
      const sets = setsData[exIdx] || [];
      const firstUncompleted = sets.findIndex(s => !s.completed && !s.skipped);
      if (firstUncompleted !== -1) {
        return { exerciseIdx: exIdx, setIdx: firstUncompleted };
      }
    }
  }

  return null;
}
