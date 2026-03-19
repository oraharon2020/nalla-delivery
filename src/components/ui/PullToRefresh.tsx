'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const THRESHOLD = 80;

  const isAtTop = useCallback(() => {
    return window.scrollY <= 0;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || !isAtTop() || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Diminishing pull effect
        const distance = Math.min(diff * 0.5, 120);
        setPullDistance(distance);
        setPulling(true);

        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);

        if (onRefresh) {
          await onRefresh();
        } else {
          window.location.reload();
        }

        setRefreshing(false);
      }

      setPulling(false);
      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, refreshing, isAtTop, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      {/* Pull indicator */}
      <div
        className="fixed left-0 right-0 z-50 flex items-center justify-center overflow-hidden transition-opacity"
        style={{
          top: 0,
          height: `${pullDistance}px`,
          opacity: pulling || refreshing ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full border-3 border-blue-500 ${
              refreshing ? 'animate-spin border-t-transparent' : ''
            }`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              borderTopColor: refreshing ? 'transparent' : undefined,
              opacity: progress,
            }}
          >
            {!refreshing && (
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full text-blue-500 p-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M12 4v8m0 0l-3-3m3 3l3-3"
                  style={{
                    transform: progress >= 1 ? 'rotate(180deg)' : undefined,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s',
                  }}
                />
              </svg>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {refreshing ? 'מרענן...' : progress >= 1 ? 'שחרר לרענון' : 'משוך לרענון'}
          </span>
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: pulling || refreshing ? `translateY(${pullDistance}px)` : undefined,
          transition: pulling ? undefined : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
