import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * 悬浮球组件 - 在打卡会话最小化时在屏幕右下角悬浮，支持鼠标与触屏拖拽、碰撞视口边界、展示当前组打卡进度
 * 完全采用 Tailwind CSS + DaisyUI 组件进行重构，并遵循系统高级设计规范与微光发光特效
 * 
 * @param {Object} props
 * @param {string} props.progress 组打卡进度（例如 "T2 1/3"）
 * @param {Function} props.onRestore 点击球体恢复全屏打卡界面的回调
 * @param {Function} props.onCancel 点击小叉号终止训练界面的回调
 */
function FloatingBall({ progress, onRestore, onCancel }) {
  // 悬浮球的宽高度
  const BALL_SIZE = 64;
  
  // 悬浮球的位置 (x, y)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // 抓取按压状态 - 用于触发物理缩放反馈
  const [isMouseDown, setIsMouseDown] = useState(false);
  
  // 拖动相关的 Ref 状态
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const ballStart = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false); // 用于区分点击和拖动

  // 初始化悬浮球位置到右下角 (避开底部 Tab 导航)
  useEffect(() => {
    const initX = window.innerWidth - BALL_SIZE - 20;
    const initY = window.innerHeight - BALL_SIZE - 120;
    setPosition({
      x: Math.max(10, initX),
      y: Math.max(10, initY)
    });
  }, []);

  // 视口大小改变时，修正悬浮球位置防止出界
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const maxX = window.innerWidth - BALL_SIZE - 10;
        const maxY = window.innerHeight - BALL_SIZE - 10;
        return {
          x: Math.max(10, Math.min(prev.x, maxX)),
          y: Math.max(10, Math.min(prev.y, maxY))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 开始拖拽
  const startDrag = (clientX, clientY) => {
    isDragging.current = true;
    wasDragged.current = false;
    dragStart.current = { x: clientX, y: clientY };
    ballStart.current = { ...position };
  };

  // 拖拽移动中
  const moveDrag = (clientX, clientY) => {
    if (!isDragging.current) return;
    
    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;
    
    // 如果移动距离超过 5 像素，标记为拖拽行为，防止触发 click 事件
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      wasDragged.current = true;
    }

    let nextX = ballStart.current.x + deltaX;
    let nextY = ballStart.current.y + deltaY;

    // 视口边界碰撞检测，预留安全间距 (10px)
    const maxX = window.innerWidth - BALL_SIZE - 10;
    const maxY = window.innerHeight - BALL_SIZE - 10;

    nextX = Math.max(10, Math.min(nextX, maxX));
    nextY = Math.max(10, Math.min(nextY, maxY));

    setPosition({ x: nextX, y: nextY });
  };

  // 结束拖拽
  const endDrag = () => {
    isDragging.current = false;
    setIsMouseDown(false);
  };

  // 绑定全局鼠标和触控移动/抬起事件，防止手势滑出悬浮球导致中断
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging.current) {
        moveDrag(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      endDrag();
    };

    const handleTouchMove = (e) => {
      if (isDragging.current && e.touches && e.touches[0]) {
        // 阻止移动端页面弹性滚动
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      endDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [position]); // 依赖当前 position

  // 处理点击球体
  const handleBallClick = () => {
    // 如果刚才有明显的拖拽行为，则不触发还原全屏
    if (wasDragged.current) return;
    onRestore();
  };

  // 处理丢弃打卡
  const handleDiscard = (e) => {
    e.stopPropagation(); // 阻止冒泡到球体点击事件
    if (window.confirm("确定放弃本次训练？所有当前已记录的组进度将被丢弃且无法找回。")) {
      onCancel();
    }
  };

  // 核心内容区解析：从 progress 中解析 Tier（如 T1）和 组进度（如 1/3）
  const match = progress ? progress.match(/^(T\d+)\s+(.+)$/) : null;
  const tier = match ? match[1] : 'T1';
  const setProgress = match ? match[2] : progress;
  
  // 自动计算打卡组数百分比
  let percentage = 0;
  if (setProgress && setProgress.includes('/')) {
    const parts = setProgress.split('/');
    const currentSet = parseInt(parts[0], 10);
    const totalSet = parseInt(parts[1], 10);
    if (!isNaN(currentSet) && !isNaN(totalSet) && totalSet > 0) {
      percentage = Math.min(100, Math.max(0, (currentSet / totalSet) * 100));
    }
  }

  return (
    <div
      className={`fixed z-[9999] touch-none select-none rounded-full bg-bg-card/90 dark:bg-bg-card-dark/95 border border-border-card dark:border-border-card-dark floating-glow transition-transform duration-200 cursor-grab active:cursor-grabbing ${
        isMouseDown ? 'scale-110' : 'scale-100'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${BALL_SIZE}px`,
        height: `${BALL_SIZE}px`,
      }}
      onMouseDown={(e) => {
        // 仅响应鼠标左键
        if (e.button === 0) {
          setIsMouseDown(true);
          startDrag(e.clientX, e.clientY);
        }
      }}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) {
          setIsMouseDown(true);
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
      onClick={handleBallClick}
    >
      {/* 迷你小叉号关闭按钮 - 稍微放大增加热区但视觉精巧 */}
      <button
        type="button"
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark text-text-secondary dark:text-text-secondary-dark flex items-center justify-center hover:text-alert dark:hover:text-alert-dark shadow-sm hover:scale-105 active:scale-90 transition-transform cursor-pointer z-10 select-none"
        onClick={handleDiscard}
        title="放弃当前训练"
      >
        <X size={9} strokeWidth={3} />
      </button>

      {/* 核心内容区 - DaisyUI radial-progress 环形发光进度环 */}
      <div
        className="radial-progress text-primary transition-all duration-300 select-none relative flex items-center justify-center"
        style={{
          "--value": percentage,
          "--size": `${BALL_SIZE}px`,
          "--thickness": "3.5px",
        }}
        role="progressbar"
      >
        {/* 内部小圆盘 */}
        <div className="absolute inset-[3.5px] rounded-full bg-bg-card dark:bg-bg-card-dark flex flex-col items-center justify-center gap-0.5 select-none">
          <span className="text-[10px] font-bold text-primary tracking-wider select-none">{tier}</span>
          <span className="text-[11px] font-mono font-semibold text-text-main dark:text-text-main-dark select-none">{setProgress}</span>
        </div>
      </div>
    </div>
  );
}

export default FloatingBall;
