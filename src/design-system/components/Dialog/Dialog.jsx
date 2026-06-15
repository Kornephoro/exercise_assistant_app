import { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';
import Button from '../Button/Button';

function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer = null,
  closeLabel = '关闭',
  closeOnBackdrop = true,
  className = '',
  style,
}) {
  const theme = useTheme();
  const titleId = useId();
  const descriptionId = useId();

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: theme.colors.background.overlay }}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={`w-full max-w-sm ${className}`}
        style={{
          background: theme.colors.background.elevated,
          color: theme.colors.text.primary,
          border: `1px solid ${theme.colors.border.default}`,
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadows.elevated,
          padding: theme.spacing[20],
          ...style,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 id={titleId} style={{ ...theme.typography.sectionTitle, margin: 0 }}>{title}</h2>}
            {description && (
              <p id={descriptionId} style={{ ...theme.typography.secondary, color: theme.colors.text.secondary, margin: `${theme.spacing[4]} 0 0` }}>
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel} style={{ minWidth: '44px', padding: theme.spacing[8] }}>
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        {children && <div style={{ marginTop: theme.spacing[16] }}>{children}</div>}
        {footer && <div className="flex justify-end gap-2" style={{ marginTop: theme.spacing[20] }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Dialog;
