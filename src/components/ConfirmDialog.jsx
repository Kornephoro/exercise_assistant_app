import { AlertTriangle } from 'lucide-react';

/**
 * 自定义确认对话框 — 替代浏览器原生 window.confirm
 * 用于破坏性操作（放弃训练、跳过动作等），保持 UI 一致性
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {string} props.title
 * @param {string} props.message
 * @param {string} [props.confirmLabel='确认']
 * @param {string} [props.cancelLabel='取消']
 * @param {'error'|'warning'} [props.variant='error']
 */
function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'error'
}) {
  if (!isOpen) return null;

  const confirmBtnClass = variant === 'error'
    ? 'btn bg-error text-error-content hover:bg-error/90'
    : 'btn bg-warning text-warning-content hover:bg-warning/90';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4 animate-fadeIn">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            variant === 'error' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
          }`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-extrabold text-text-main dark:text-text-main-dark">{title}</h3>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel}
            className="btn-sec flex-1 h-10 text-xs">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm}
            className={`${confirmBtnClass} flex-1 h-10 text-xs font-bold`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
