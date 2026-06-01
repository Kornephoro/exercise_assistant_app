import React, { useState, useEffect, useRef } from 'react';
import { X, Dumbbell } from 'lucide-react';

/**
 * 悬浮球组件 - 在打卡会话最小化时在屏幕右下角悬浮，支持鼠标与触屏拖拽、碰撞视口边界、展示当前组打卡进度
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

  return (
    <div
      className="floating-ball"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${BALL_SIZE}px`,
        height: `${BALL_SIZE}px`,
        position: 'fixed',
        zIndex: 9999,
        touchAction: 'none'
      }}
      onMouseDown={(e) => {
        // 仅响应鼠标左键
        if (e.button === 0) {
          startDrag(e.clientX, e.clientY);
        }
      }}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) {
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
      onClick={handleBallClick}
    >
      {/* 迷你小叉号关闭按钮 */}
      <button
        type="button"
        className="floating-ball-close"
        onClick={handleDiscard}
        title="放弃当前训练"
      >
        <X size={10} />
      </button>

      {/* 核心内容区 */}
      <div className="floating-ball-inner">
        <Dumbbell size={16} className="floating-ball-icon" />
        <span className="floating-ball-progress">{progress}</span>
      </div>
    </div>
  );
}

export default FloatingBall;
