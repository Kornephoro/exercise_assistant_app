import { useTheme } from '../../theme/useTheme';

function Badge({ children, variant = 'neutral', icon = null, className = '', style, ...props }) {
  const theme = useTheme();
  const variants = {
    neutral: {
      background: theme.colors.background.subtle,
      color: theme.colors.text.secondary,
      borderColor: theme.colors.border.default,
    },
    primary: {
      background: theme.colors.brand.primarySubtle,
      color: theme.colors.brand.primaryPressed,
      borderColor: theme.colors.brand.primary,
    },
    success: {
      background: theme.colors.state.success.surface,
      color: theme.colors.state.success.foreground,
      borderColor: theme.colors.state.success.border,
    },
    warning: {
      background: theme.colors.state.warning.surface,
      color: theme.colors.state.warning.foreground,
      borderColor: theme.colors.state.warning.border,
    },
    danger: {
      background: theme.colors.state.danger.surface,
      color: theme.colors.state.danger.foreground,
      borderColor: theme.colors.state.danger.border,
    },
    info: {
      background: theme.colors.state.info.surface,
      color: theme.colors.state.info.foreground,
      borderColor: theme.colors.state.info.border,
    },
  };

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
      style={{
        ...theme.typography.chip,
        ...(variants[variant] || variants.neutral),
        borderStyle: 'solid',
        borderWidth: '1px',
        borderRadius: theme.radius.pill,
        padding: `${theme.spacing[2]} ${theme.spacing[8]}`,
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

export default Badge;

