import { useState } from 'react';
import { Sun, Moon, Settings, BookOpen, RotateCcw, Info, ChevronRight, Dumbbell } from 'lucide-react';

function MyPage({ themeMode, onThemeModeChange, onReOnboard, onOpenLibrary }) {
  const [nickname] = useState(() => localStorage.getItem('user_nickname') || '');
  const [daysSince] = useState(() => {
    const completedAt = localStorage.getItem('onboarding_completed_at');
    if (completedAt) {
      const start = new Date(completedAt);
      const now = new Date();
      return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }
    return 0;
  });

  const avatarChar = nickname ? nickname.charAt(0).toUpperCase() : '?';
  const displayName = nickname || '未设置昵称';

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* 头部标题与描述 */}
      <div>
        <h2 className="page-header">我的</h2>
        <p className="page-header-desc">管理您的个人画像、系统配色及应用设置。</p>
      </div>

      {/* 用户卡片 */}
      <div className="card flex flex-row items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white text-2xl font-black shadow-md shrink-0">
          {avatarChar}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xl font-extrabold text-text-main dark:text-text-main-dark truncate">
            {displayName}
          </span>
          <span className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
            {daysSince > 0
              ? `已训练 ${daysSince} 天`
              : '完成训练画像开启旅程'}
          </span>
        </div>
      </div>

      {/* 偏好设置 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <Settings size={16} className="text-primary" />偏好设置
        </h3>

        {/* 主题切换 */}
        <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
          <div className="flex items-center gap-3 min-w-0 mb-1 select-none">
            {themeMode === 'dark' ? <Moon size={18} className="text-primary" /> : <Sun size={18} className="text-primary" />}
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">主题配色</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                {themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色模式' : '浅色模式'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 bg-bg-main/40 dark:bg-bg-main-dark/40 border border-border-card/50 dark:border-border-card-dark/50 rounded-lg p-0.5 gap-0.5 select-none">
            {[
              { key: 'light', label: '浅色' },
              { key: 'dark', label: '深色' },
              { key: 'system', label: '跟随系统' }
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => onThemeModeChange(item.key)}
                className={`py-1.5 rounded text-xs font-bold transition-all ${
                  themeMode === item.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 重新进入训练画像 */}
        <button
          type="button"
          onClick={onReOnboard}
          className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 w-full text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <RotateCcw size={18} className="text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">重新进入训练画像</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                重新设置每周可训练天数等偏好
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary/40 shrink-0" />
        </button>
      </div>

      {/* 训练库 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <BookOpen size={16} className="text-primary" />训练
        </h3>

        <button
          type="button"
          onClick={onOpenLibrary}
          className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50 w-full text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Dumbbell size={18} className="text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">动作库</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                浏览所有可用的训练动作
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary/40 shrink-0" />
        </button>
      </div>

      {/* 关于 */}
      <div className="card flex flex-col gap-3">
        <h3 className="card-title-standard">
          <Info size={16} className="text-primary" />关于
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card/50 dark:border-border-card-dark/50">
          <div className="flex items-center gap-3 min-w-0">
            <Info size={18} className="text-text-secondary dark:text-text-secondary-dark shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-text-main dark:text-text-main-dark">版本</span>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 font-mono">
                v1.0.0 MVP
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary dark:text-text-secondary-dark text-center py-2 opacity-60">
        💪 训练助手 · 让坚持更简单
      </p>
    </div>
  );
}

export default MyPage;
