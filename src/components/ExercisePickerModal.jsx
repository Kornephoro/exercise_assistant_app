import { Search, X } from 'lucide-react';

/**
 * 共享动作选择器模态框 — 消除 PlanScreen 与 ProgramConfigScreen 中 ~100 行的重复实现
 *
 * 调用方负责：过滤逻辑、列表数据、点击处理。本组件仅负责 UI 渲染。
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} props.search
 * @param {(v: string) => void} props.onSearchChange
 * @param {string} [props.searchPlaceholder]
 * @param {React.ReactNode} [props.children] — 搜索框下方的自定义筛选区（如筛选标签/开关）
 * @param {React.ReactNode} [props.headerExtra] — 标题右侧的额外按钮
 * @param {Array} props.exercises — 已过滤的动作列表
 * @param {(ex: Object) => React.ReactNode} props.renderItem — 单个动作行渲染
 * @param {string} [props.emptyMessage]
 * @param {string} [props.className] — 可选的 z-index 覆盖
 */
function ExercisePickerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = '搜索动作名称...',
  children,
  headerExtra,
  exercises = [],
  renderItem,
  emptyMessage = '无匹配动作',
  className = 'z-[90]'
}) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${className} flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn`}>
      <div className="bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark w-full max-w-sm rounded-2xl shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 border-b border-border-card dark:border-border-card-dark flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text-main dark:text-text-main-dark">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerExtra}
            <button type="button" onClick={onClose}
              className="w-6 h-6 rounded-lg hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-secondary hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer">
              ×
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border-card dark:border-border-card-dark space-y-2">
          <div className="relative">
            <input type="text" placeholder={searchPlaceholder}
              className="input input-bordered input-sm w-full pl-8 bg-bg-main/20 dark:bg-bg-main-dark/20 border-border-card dark:border-border-card-dark focus-within:border-primary text-xs h-8"
              value={search} onChange={(e) => onSearchChange(e.target.value)} autoFocus />
            <Search size={12} className="absolute left-2.5 top-2.5 text-text-secondary/50" />
            {search && (
              <button type="button" onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-main text-xs cursor-pointer">
                ×
              </button>
            )}
          </div>
          {children}
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-bg-main/5 dark:bg-bg-main-dark/5 min-h-[120px]">
          {exercises.length === 0 ? (
            <p className="text-center py-6 text-xs text-text-secondary/50 select-none">{emptyMessage}</p>
          ) : (
            exercises.map(ex => renderItem(ex))
          )}
        </div>
      </div>
    </div>
  );
}

export default ExercisePickerModal;
