import { useTheme } from '../../theme/useTheme';

function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  ariaLabel = '选项切换',
  className = '',
  style,
}) {
  const theme = useTheme();
  const height = size === 'sm' ? '36px' : '40px';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 ${className}`}
      style={{
        width: fullWidth ? '100%' : 'fit-content',
        padding: theme.spacing[4],
        background: theme.colors.background.subtle,
        border: `1px solid ${theme.colors.border.default}`,
        borderRadius: theme.radius.md,
        ...style,
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            disabled={option.disabled}
            onClick={() => onChange?.(option.value)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap disabled:cursor-not-allowed"
            style={{
              ...theme.typography.chip,
              minHeight: height,
              padding: `${theme.spacing[6]} ${theme.spacing[10]}`,
              border: 0,
              borderRadius: theme.radius.sm,
              background: isActive ? theme.colors.brand.primary : 'transparent',
              color: isActive ? theme.colors.brand.onPrimary : theme.colors.text.secondary,
              boxShadow: isActive ? theme.shadows.card : 'none',
              opacity: option.disabled ? 0.5 : 1,
              transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
            }}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;

