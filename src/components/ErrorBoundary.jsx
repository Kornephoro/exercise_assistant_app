import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * 全局 Error Boundary — 捕获子组件树中任何未处理的渲染异常，
 * 展示友好的降级 UI 并提供"重试"按钮，避免白屏
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染异常:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // 开发模式下显示错误详情，生产模式只显示通用提示
      const isDev = import.meta.env?.DEV;
      const message = this.state.error?.message || '未知错误';

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-main dark:bg-bg-main-dark p-6">
          <div className="card max-w-sm w-full text-center flex flex-col items-center gap-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-error" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-text-main dark:text-text-main-dark">
                页面发生异常
              </h2>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                应用遇到了一个意外错误，请尝试刷新页面。
              </p>
              {isDev && (
                <p className="text-xs font-mono text-error mt-2 bg-error/5 p-2 rounded-lg break-all">
                  {message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn-main gap-2"
            >
              <RotateCcw size={16} />
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
