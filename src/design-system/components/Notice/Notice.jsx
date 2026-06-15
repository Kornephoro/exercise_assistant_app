import { AlertCircle, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';

const ICONS = {
  primary: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  danger: AlertCircle,
  info: Info,
};

function Notice({
  title,
  children,
  variant = 'info',
  icon = null,
  action = null,
  className = '',
  style,
  ...props
}) {
  const theme = useTheme();
  const tones = {
    primary: {
      foreground: theme.colors.brand.primaryPressed,
      surface: theme.colors.brand.primarySubtle,
      border: theme.colors.brand.primary,
    },
    ...theme.colors.state,
  };
  const tone = tones[variant] || tones.info;
  const Icon = ICONS[variant] || Info;

  return (
    <aside
      className={`flex items-start gap-3 ${className}`}
      style={{
        background: tone.surface,
        color: tone.foreground,
        border: `1px solid ${tone.border}`,
        borderLeftWidth: '4px',
        borderRadius: theme.radius.md,
        padding: theme.spacing[16],
        ...style,
      }}
      {...props}
    >
      <span className="shrink-0 mt-0.5" aria-hidden="true">{icon || <Icon size={18} />}</span>
      <div className="min-w-0 flex-1">
        {title && <div style={{ ...theme.typography.chip, color: tone.foreground }}>{title}</div>}
        <div style={{ ...theme.typography.secondary, color: theme.colors.text.secondary, marginTop: title ? theme.spacing[2] : 0 }}>
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </aside>
  );
}

export default Notice;

