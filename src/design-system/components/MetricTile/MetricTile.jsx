import { useTheme } from '../../theme/useTheme';

function MetricTile({
  label,
  value,
  unit,
  trend = null,
  status = null,
  icon = null,
  compact = false,
  className = '',
  style,
  ...props
}) {
  const theme = useTheme();
  const trendColor = trend?.direction === 'down'
    ? theme.colors.state.warning.foreground
    : theme.colors.state.success.foreground;

  return (
    <div
      className={`flex flex-col min-w-0 ${className}`}
      style={{
        background: theme.colors.background.card,
        border: `1px solid ${theme.colors.border.default}`,
        borderRadius: theme.radius.md,
        padding: compact ? theme.spacing[10] : theme.spacing[12],
        color: theme.colors.text.primary,
        ...style,
      }}
      {...props}
    >
      <div className="flex items-center justify-between gap-2" style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
        <span>{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-1 mt-1" style={theme.typography.tabularNumbers}>
        <strong style={{ ...(compact ? theme.typography.metricSmall : theme.typography.metric), fontFamily: theme.typography.fontFamily.numeric }}>
          {value ?? '--'}
        </strong>
        {unit && <span style={{ ...theme.typography.caption, color: theme.colors.text.tertiary }}>{unit}</span>}
      </div>
      {(trend || status) && (
        <div className="flex items-center justify-between gap-2 mt-1" style={theme.typography.caption}>
          <span style={{ color: trend ? trendColor : theme.colors.text.tertiary }}>{trend?.label}</span>
          <span style={{ color: theme.colors.text.secondary }}>{status}</span>
        </div>
      )}
    </div>
  );
}

export default MetricTile;

