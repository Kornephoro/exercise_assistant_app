import { useTheme } from '../../theme/useTheme';

function BottomNavigation({
  items,
  value,
  onChange,
  fixed = true,
  ariaLabel = '主导航',
  className = '',
  style,
}) {
  const theme = useTheme();

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex items-stretch ${fixed ? 'fixed bottom-0 left-1/2 -translate-x-1/2 z-50' : ''} ${className}`}
      style={{
        width: '100%',
        maxWidth: '480px',
        minHeight: '72px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: theme.colors.background.surface,
        borderTop: `1px solid ${theme.colors.border.default}`,
        boxShadow: theme.shadows.elevated,
        ...style,
      }}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            disabled={item.disabled}
            onClick={() => onChange?.(item.value)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              border: 0,
              color: isActive ? theme.colors.brand.primary : theme.colors.text.tertiary,
              opacity: item.disabled ? 0.5 : 1,
              ...theme.typography.caption,
              fontWeight: isActive ? 700 : 400,
            }}
          >
            {Icon && <Icon size={22} aria-hidden="true" style={{ filter: isActive ? `drop-shadow(${theme.shadows.glow})` : 'none' }} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNavigation;

