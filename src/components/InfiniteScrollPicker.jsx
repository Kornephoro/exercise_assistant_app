import { useEffect, useMemo, useRef } from 'react';

/**
 * 水平循环滚动对齐选择器 — 从 ProgramConfigScreen 和 TrainSession 中消除重复
 * 通过 9 倍重复数组实现无限循环滚动错觉
 */
function InfiniteScrollPicker({ options, value, onChange, label }) {
  const containerRef = useRef(null);
  const isTeleportingRef = useRef(false);
  const lastSelectedValueRef = useRef(value);

  const repeatCount = 9;
  const repeatedOptions = useMemo(() => {
    let arr = [];
    for (let i = 0; i < repeatCount; i++) {
      arr = arr.concat(options);
    }
    return arr;
  }, [options]);

  const scrollToValue = (val, smooth = false) => {
    const container = containerRef.current;
    if (!container) return;
    const L = options.length;
    const itemIndex = options.indexOf(val);
    if (itemIndex === -1) return;
    const targetIndex = 4 * L + itemIndex;
    const children = container.children;
    const targetChild = children[targetIndex];
    if (targetChild) {
      const itemOffsetLeft = targetChild.offsetLeft;
      const itemWidth = targetChild.offsetWidth;
      const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;
      container.scrollTo({ left: newScrollLeft, behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    let timer;
    const align = () => {
      scrollToValue(value, false);
      lastSelectedValueRef.current = value;
    };
    align();
    timer = setTimeout(align, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value !== lastSelectedValueRef.current) {
      scrollToValue(value, false);
      lastSelectedValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = () => {
    if (isTeleportingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let minDistance = Infinity;
    let closestIndex = -1;

    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      const childCenter = childRect.left + childRect.width / 2;
      const distance = Math.abs(childCenter - containerCenter);
      if (distance < minDistance) { minDistance = distance; closestIndex = i; }
    }

    if (closestIndex !== -1) {
      const val = options[closestIndex % options.length];
      if (val !== undefined && val !== value) {
        lastSelectedValueRef.current = val;
        onChange(val);
      }

      const L = options.length;
      const activeCopy = Math.floor(closestIndex / L);
      if (activeCopy < 3 || activeCopy > 5) {
        const targetIndex = 4 * L + (closestIndex % L);
        const targetChild = children[targetIndex];
        if (targetChild) {
          const itemOffsetLeft = targetChild.offsetLeft;
          const itemWidth = targetChild.offsetWidth;
          const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;
          isTeleportingRef.current = true;
          container.scrollLeft = newScrollLeft;
          requestAnimationFrame(() => {
            setTimeout(() => { isTeleportingRef.current = false; }, 50);
          });
        }
      }
    }
  };

  const handleItemClick = (index, val) => {
    const container = containerRef.current;
    if (!container) return;
    const children = container.children;
    const targetChild = children[index];
    if (targetChild) {
      const itemOffsetLeft = targetChild.offsetLeft;
      const itemWidth = targetChild.offsetWidth;
      const newScrollLeft = itemOffsetLeft - container.clientWidth / 2 + itemWidth / 2;
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
      lastSelectedValueRef.current = val;
      onChange(val);
    }
  };

  const scrollbarHideStyle = `
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  return (
    <div className="flex flex-col gap-1 w-full">
      <style>{scrollbarHideStyle}</style>
      <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark font-bold pl-1">{label}</span>
      <div className="relative w-full flex items-center bg-bg-main/20 dark:bg-bg-main-dark/20 border border-border-card dark:border-border-card-dark rounded-xl h-12 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-primary/30 pointer-events-none z-10" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-card/40 to-transparent dark:from-bg-card-dark/40 pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-card/40 to-transparent dark:from-bg-card-dark/40 pointer-events-none z-10" />
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="scrollbar-none w-full h-full flex items-center gap-2 overflow-x-auto snap-x snap-mandatory"
          style={{ paddingLeft: 'calc(50% - 20px)', paddingRight: 'calc(50% - 20px)' }}
        >
          {repeatedOptions.map((opt, i) => {
            const isActive = opt === value;
            return (
              <button
                key={i} type="button"
                onClick={() => handleItemClick(i, opt)}
                className={`snap-center shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono text-sm transition-all cursor-pointer border-0 ${
                  isActive
                    ? 'bg-primary text-white scale-110 shadow-md ring-2 ring-primary/20'
                    : 'text-text-secondary hover:text-text-main dark:text-text-secondary-dark dark:hover:text-text-main-dark hover:bg-bg-hover dark:hover:bg-bg-hover-dark bg-transparent'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default InfiniteScrollPicker;
