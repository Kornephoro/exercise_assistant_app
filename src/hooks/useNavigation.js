import { useEffect, useCallback } from 'react';

/**
 * 构建 URL Hash
 */
function buildHash({ tab, sessionActive, sessionMinimized, previewOpen, configProgram, selectedActiveProgramId, selectedProgram }) {
  if (sessionActive && !sessionMinimized) return '#session';
  if (previewOpen) return '#preview';
  if (tab === 'plan') {
    if (configProgram) return `#plan/config/${configProgram.id}`;
    if (selectedActiveProgramId) return `#plan/active/${selectedActiveProgramId}`;
    if (selectedProgram) return `#plan/detail/${selectedProgram.id}`;
  }
  return `#${tab}`;
}

/**
 * 构建浏览器历史状态对象
 */
function buildHistoryState({ tab, configProgram, selectedActiveProgramId, selectedProgram, sessionActive, isMinimized, previewOpen, showSetCard, focusedSet }) {
  return {
    tab,
    configProgramId: configProgram?.id ?? null,
    selectedActiveProgramId: selectedActiveProgramId ?? null,
    selectedProgramId: selectedProgram?.id ?? null,
    sessionActive,
    isMinimized,
    previewOpen,
    showSetCard,
    focusedSet
  };
}

/**
 * Hash 路由导航 Hook — 从 App.jsx 中提取 ~325 行路由逻辑
 *
 * 管理：URL hash 解析、浏览器历史栈同步、popstate 监听、训练会话最小化保护
 *
 * @param {Object} ctx - 上下文状态与 setter
 * @returns {{ updateNavigationState, parseHashAndSetState, openSetCard, closeSetCard }}
 */
export function useNavigation(ctx) {
  const {
    loading,
    programs,
    sessionActive,
    sessionMinimized,
    activeTab,
    configProgram,
    selectedActiveProgramId,
    selectedProgram,
    previewOpen,
    showSetCard,
    focusedSet,
    // setters
    setActiveTab,
    setConfigProgram,
    setSelectedActiveProgramId,
    setSelectedProgram,
    setPreviewOpen,
    setShowSetCard,
    setFocusedSet,
    setSessionState
  } = ctx;

  // ============ URL Hash 解析器 ============
  const parseHashAndSetState = useCallback((hash, allPrograms) => {
    const cleanHash = hash.replace('#', '');
    const currentPrograms = allPrograms || programs;

    if (!cleanHash) {
      setActiveTab('today');
      window.history.replaceState(
        buildHistoryState({ tab: 'today', configProgram: null, selectedActiveProgramId: null, selectedProgram: null, sessionActive: false, isMinimized: false, previewOpen: false, showSetCard: false, focusedSet: null }),
        '', '#today'
      );
      return;
    }

    const parts = cleanHash.split('/');
    const mainTab = parts[0];
    const validTabs = ['today', 'plan', 'diet', 'data', 'me'];

    if (validTabs.includes(mainTab)) {
      setActiveTab(mainTab);
      let configProg = null, selActiveId = null, selProg = null;

      if (mainTab === 'plan' && parts[1]) {
        const subView = parts[1];
        const id = parts[2];
        if (subView === 'config' && id) {
          configProg = currentPrograms.find(p => p.id === id) || null;
          setConfigProgram(configProg);
        } else if (subView === 'active' && id) {
          selActiveId = id;
          setSelectedActiveProgramId(id);
        } else if (subView === 'detail' && id) {
          selProg = currentPrograms.find(p => p.id === id) || null;
          setSelectedProgram(selProg);
        }
      }

      window.history.replaceState(
        buildHistoryState({ tab: mainTab, configProgram: configProg, selectedActiveProgramId: selActiveId, selectedProgram: selProg, sessionActive: false, isMinimized: false, previewOpen: false, showSetCard: false, focusedSet: null }),
        '', hash
      );
    } else if (cleanHash === 'session') {
      setActiveTab('today');
      window.history.replaceState(
        buildHistoryState({ tab: 'today', configProgram: null, selectedActiveProgramId: null, selectedProgram: null, sessionActive: true, isMinimized: false, previewOpen: false, showSetCard: false, focusedSet: null }),
        '', '#session'
      );
    } else if (cleanHash === 'preview') {
      setActiveTab('today');
      setPreviewOpen(true);
      window.history.replaceState(
        buildHistoryState({ tab: 'today', configProgram: null, selectedActiveProgramId: null, selectedProgram: null, sessionActive: false, isMinimized: false, previewOpen: true, showSetCard: false, focusedSet: null }),
        '', '#preview'
      );
    } else {
      setActiveTab('today');
      window.history.replaceState(
        buildHistoryState({ tab: 'today', configProgram: null, selectedActiveProgramId: null, selectedProgram: null, sessionActive: false, isMinimized: false, previewOpen: false, showSetCard: false, focusedSet: null }),
        '', '#today'
      );
    }
  }, [programs, setActiveTab, setConfigProgram, setSelectedActiveProgramId, setSelectedProgram, setPreviewOpen]);

  // ============ 导航状态更新器 ============
  const updateNavigationState = useCallback((updates, replace = false) => {
    const hasUpdate = (key) => Object.prototype.hasOwnProperty.call(updates, key);
    const next = {
      tab: hasUpdate('tab') ? updates.tab : activeTab,
      configProgram: hasUpdate('configProgram') ? updates.configProgram : configProgram,
      selectedActiveProgramId: hasUpdate('selectedActiveProgramId') ? updates.selectedActiveProgramId : selectedActiveProgramId,
      selectedProgram: hasUpdate('selectedProgram') ? updates.selectedProgram : selectedProgram,
      previewOpen: hasUpdate('previewOpen') ? updates.previewOpen : previewOpen,
      sessionActive: hasUpdate('sessionActive') ? updates.sessionActive : sessionActive,
      sessionMinimized: hasUpdate('isMinimized') ? updates.isMinimized : sessionMinimized,
      showSetCard: hasUpdate('showSetCard') ? updates.showSetCard : showSetCard,
      focusedSet: hasUpdate('focusedSet') ? updates.focusedSet : focusedSet
    };

    // React 状态更新
    if (hasUpdate('tab')) {
      setActiveTab(updates.tab);
      if (updates.tab !== 'plan') {
        setConfigProgram(null);
        setSelectedActiveProgramId(null);
        setSelectedProgram(null);
        next.configProgram = null;
        next.selectedActiveProgramId = null;
        next.selectedProgram = null;
      }
    }
    if (hasUpdate('configProgram')) setConfigProgram(updates.configProgram);
    if (hasUpdate('selectedActiveProgramId')) setSelectedActiveProgramId(updates.selectedActiveProgramId);
    if (hasUpdate('selectedProgram')) setSelectedProgram(updates.selectedProgram);
    if (hasUpdate('previewOpen')) setPreviewOpen(updates.previewOpen);
    if (hasUpdate('sessionActive') || hasUpdate('isMinimized')) {
      setSessionState(prev => ({ ...prev, isActive: next.sessionActive, isMinimized: next.sessionMinimized }));
    }
    if (hasUpdate('showSetCard')) setShowSetCard(updates.showSetCard);
    if (hasUpdate('focusedSet')) setFocusedSet(updates.focusedSet);

    // 训练结束/最小化时清理组卡片
    if ((hasUpdate('sessionActive') && !next.sessionActive) || (hasUpdate('isMinimized') && next.sessionMinimized)) {
      setShowSetCard(false);
      setFocusedSet(null);
      next.showSetCard = false;
      next.focusedSet = null;
    }

    const hash = buildHash(next);
    const historyState = buildHistoryState(next);
    const isDifferent = window.location.hash !== hash ||
      historyState.showSetCard !== (window.history.state?.showSetCard ?? false) ||
      historyState.previewOpen !== (window.history.state?.previewOpen ?? false);

    if (replace) {
      window.history.replaceState(historyState, '', hash);
    } else if (isDifferent) {
      window.history.pushState(historyState, '', hash);
    }
  }, [
    activeTab, configProgram, selectedActiveProgramId, selectedProgram, previewOpen,
    sessionActive, sessionMinimized, showSetCard, focusedSet,
    setActiveTab, setConfigProgram, setSelectedActiveProgramId, setSelectedProgram,
    setPreviewOpen, setShowSetCard, setFocusedSet, setSessionState
  ]);

  // 打开/关闭组卡片
  const openSetCard = useCallback((exerciseIdx, setIdx, replace = false) => {
    updateNavigationState({ showSetCard: true, focusedSet: { exerciseIdx, setIdx } }, replace);
  }, [updateNavigationState]);

  const closeSetCard = useCallback(() => {
    if (window.history.state && window.history.state.showSetCard) {
      window.history.back();
    } else {
      updateNavigationState({ showSetCard: false, focusedSet: null });
    }
  }, [updateNavigationState]);

  // ============ Popstate 监听 ============
  useEffect(() => {
    if (loading) return;

    const handlePopState = (event) => {
      const state = event.state;
      if (!state) {
        parseHashAndSetState(window.location.hash);
        return;
      }

      // 训练会话保护：后退时最小化而非退出
      if (sessionActive && !sessionMinimized && !state.sessionActive) {
        setSessionState(prev => ({ ...prev, isMinimized: true }));
        window.history.replaceState(
          { ...state, sessionActive: true, isMinimized: true, showSetCard: false, focusedSet: null },
          '', window.location.hash
        );
        setActiveTab(state.tab || 'today');
        const resolvedConfig = state.configProgramId ? programs.find(p => p.id === state.configProgramId) : null;
        const resolvedProg = state.selectedProgramId ? programs.find(p => p.id === state.selectedProgramId) : null;
        setConfigProgram(resolvedConfig);
        setSelectedActiveProgramId(state.selectedActiveProgramId);
        setSelectedProgram(resolvedProg);
        setPreviewOpen(!!state.previewOpen);
        setShowSetCard(false);
        setFocusedSet(null);
        return;
      }

      // 正常恢复
      setActiveTab(state.tab || 'today');
      const resolvedConfig = state.configProgramId ? programs.find(p => p.id === state.configProgramId) : null;
      const resolvedProg = state.selectedProgramId ? programs.find(p => p.id === state.selectedProgramId) : null;
      setConfigProgram(resolvedConfig);
      setSelectedActiveProgramId(state.selectedActiveProgramId);
      setSelectedProgram(resolvedProg);
      setPreviewOpen(!!state.previewOpen);
      setShowSetCard(!!state.showSetCard);
      setFocusedSet(state.focusedSet || null);
      setSessionState(prev => ({ ...prev, isActive: !!state.sessionActive, isMinimized: !!state.isMinimized }));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    loading, programs,
    sessionActive, sessionMinimized,
    activeTab, configProgram, selectedActiveProgramId, selectedProgram,
    previewOpen, showSetCard, focusedSet,
    parseHashAndSetState, setActiveTab, setConfigProgram, setSelectedActiveProgramId,
    setSelectedProgram, setPreviewOpen, setShowSetCard, setFocusedSet, setSessionState
  ]);

  return { updateNavigationState, parseHashAndSetState, openSetCard, closeSetCard };
}
