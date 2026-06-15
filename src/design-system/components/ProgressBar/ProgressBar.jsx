import { useTheme } from '../../theme/useTheme';

function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  tone = 'primary',
  className = '',
  style,
  ...props
}) {
  const theme = useTheme();
  const safeMax = max > 0 ? max : 100;
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percentage = (safeValue / safeMax) * 100;
  const toneColors = {
    primary: theme.colors.brand.primary,
    success: theme.colors.state.success.foreground,
    warning: theme.colors.state.warning.foreground,
    danger: theme.colors.state.danger.foreground,
    info: theme.colors.state.info.foreground,
    protein: theme.colors.nutrition.protein,
    carbohydrate: theme.colors.nutrition.carbohydrate,
    fat: theme.colors.nutrition.fat,
  };

  return (
    <div className={className} style={style} {...props}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-3 mb-1.5" style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
          <span>{label}</span>
          <span style={theme.typography.tabularNumbers}>{valueLabel ?? `${Math.round(percentage)}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        style={{ height: theme.spacing[6], background: theme.colors.background.subtle, borderRadius: theme.radius.pill, overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: toneColors[tone] || toneColors.primary,
            borderRadius: theme.radius.pill,
            transition: `width ${theme.motion.duration.progress} ${theme.motion.easing.enter}`,
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;

