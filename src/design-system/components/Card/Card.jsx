import { useTheme } from '../../theme/useTheme';

function Card({
  as: Component = 'section',
  children,
  variant = 'surface',
  padding = 'default',
  interactive = false,
  className = '',
  style,
  ...props
}) {
  const theme = useTheme();
  const backgrounds = {
    surface: theme.colors.background.surface,
    subtle: theme.colors.background.subtle,
    tinted: theme.colors.background.tint,
    elevated: theme.colors.background.elevated,
  };
  const paddings = {
    none: theme.spacing[0],
    compact: theme.spacing.cardPaddingCompact,
    default: theme.spacing.cardPadding,
  };

  return (
    <Component
      className={`${interactive ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}
      style={{
        background: backgrounds[variant] || backgrounds.surface,
        color: theme.colors.text.primary,
        border: `1px solid ${theme.colors.border.default}`,
        borderRadius: theme.radius.lg,
        boxShadow: variant === 'elevated' ? theme.shadows.elevated : theme.shadows.card,
        padding: paddings[padding] || paddings.default,
        transition: `transform ${theme.motion.duration.fast} ${theme.motion.easing.enter}, background ${theme.motion.duration.normal} ${theme.motion.easing.standard}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

function CardHeader({ children, className = '', style, ...props }) {
  const theme = useTheme();
  return (
    <div
      className={`flex items-start justify-between gap-3 ${className}`}
      style={{ marginBottom: theme.spacing[12], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

function CardTitle({ as: Component = 'h3', children, className = '', style, ...props }) {
  const theme = useTheme();
  return (
    <Component
      className={className}
      style={{ ...theme.typography.sectionTitle, color: theme.colors.text.primary, margin: 0, ...style }}
      {...props}
    >
      {children}
    </Component>
  );
}

function CardContent({ children, className = '', style, ...props }) {
  const theme = useTheme();
  return (
    <div className={className} style={{ color: theme.colors.text.secondary, ...style }} {...props}>
      {children}
    </div>
  );
}

export { Card, CardContent, CardHeader, CardTitle };
export default Card;

