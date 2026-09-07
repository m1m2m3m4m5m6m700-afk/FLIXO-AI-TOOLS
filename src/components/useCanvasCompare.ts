import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseCanvasCompareProps {
  onCompareStart?: () => void;
  onCompareEnd?: () => void;
}

export const useCanvasCompare = ({ onCompareStart, onCompareEnd }: UseCanvasCompareProps = {}) => {
  const [isComparing, setIsComparing] = useState(false);
  const isComparingRef = useRef(false);
  const onStartRef = useRef(onCompareStart);
  const onEndRef = useRef(onCompareEnd);

  useEffect(() => {
    onStartRef.current = onCompareStart;
    onEndRef.current = onCompareEnd;
  });

  const startCompare = useCallback(() => {
    if (isComparingRef.current) return;
    isComparingRef.current = true;
    setIsComparing(true);
    onStartRef.current?.();
  }, []);

  const endCompare = useCallback(() => {
    if (!isComparingRef.current) return;
    isComparingRef.current = false;
    setIsComparing(false);
    onEndRef.current?.();
  }, []);

  useEffect(() => {
    const handleBlur = () => endCompare();
    const handleVisibilityChange = () => {
      if (document.hidden) endCompare();
    };
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endCompare();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (isComparingRef.current) {
        isComparingRef.current = false;
        onEndRef.current?.();
      }
    };
  }, [endCompare]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if ('setPointerCapture' in event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Safe fallback for test environments and legacy implementations.
      }
    }
    startCompare();
  }, [startCompare]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if ('hasPointerCapture' in event.currentTarget && typeof event.currentTarget.hasPointerCapture === 'function') {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Safe fallback.
      }
    }
    endCompare();
  }, [endCompare]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      startCompare();
    }
  }, [startCompare]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      endCompare();
    }
  }, [endCompare]);

  return {
    isComparing,
    endCompare,
    bind: {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
    },
  };
};
