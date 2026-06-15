import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';
import { ThemeContext } from './useTheme';

const VALID_MODES = new Set(['light', 'dark', 'system']);

function getSystemMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeToSystemMode(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function toCssVariables(theme) {
  return {
    '--fitcore-color-primary': theme.colors.brand.primary,
    '--fitcore-bg-page': theme.colors.background.page,
    '--fitcore-bg-surface': theme.colors.background.surface,
    '--fitcore-bg-card': theme.colors.background.card,
    '--fitcore-text-primary': theme.colors.text.primary,
    '--fitcore-text-secondary': theme.colors.text.secondary,
    '--fitcore-border': theme.colors.border.default,
    '--fitcore-radius-card': theme.radius.lg,
    '--fitcore-shadow-card': theme.shadows.card,
  };
}

function ThemeProvider({ children, mode = 'system' }) {
  const normalizedMode = VALID_MODES.has(mode) ? mode : 'system';
  const systemMode = useSyncExternalStore(subscribeToSystemMode, getSystemMode, () => 'light');
  const resolvedMode = normalizedMode === 'system' ? systemMode : normalizedMode;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.setAttribute('data-fitcore-theme', resolvedMode);
    Object.entries(toCssVariables(theme)).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }, [resolvedMode, theme]);

  const value = useMemo(() => ({
    ...theme,
    mode: normalizedMode,
    resolvedMode,
    isDark: resolvedMode === 'dark',
  }), [normalizedMode, resolvedMode, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
