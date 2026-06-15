import { Loader2 } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';

const SIZE_STYLES = {
  sm: { minHeight: '44px', padding: '8px 12px' },
  md: { minHeight: '44px', padding: '10px 16px' },
  lg: { minHeight: '48px', padding: '12px 20px' },
};

function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  style,
  type = 'button',
  ...props
}) {
  const theme = useTheme();
  const variants = {
    primary: {
      background: theme.colors.brand.primary,
      color: theme.colors.brand.onPrimary,
      borderColor: theme.colors.brand.primary,
      boxShadow: theme.shadows.glow,
    },
    secondary: {
      background: theme.colors.background.surface,
      color: theme.colors.text.primary,
      borderColor: theme.colors.border.default,
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.text.secondary,
      borderColor: 'transparent',
      boxShadow: 'none',
    },
    danger: {
      background: theme.colors.state.danger.foreground,
      color: theme.colors.text.inverse,
      borderColor: theme.colors.state.danger.foreground,
      boxShadow: 'none',
    },
  };
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 select-none cursor-pointer active:scale-[0.98] disabled:cursor-not-allowed ${className}`}
      style={{
        ...theme.typography.button,
        ...sizeStyle,
        ...variants[variant],
        width: fullWidth ? '100%' : undefined,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderRadius: theme.radius.md,
        fontFamily: theme.typography.fontFamily.sans,
        opacity: disabled || loading ? 0.52 : 1,
        transition: `transform ${theme.motion.duration.instant} ${theme.motion.easing.standard}, opacity ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
        ...style,
      }}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
}

export default Button;
