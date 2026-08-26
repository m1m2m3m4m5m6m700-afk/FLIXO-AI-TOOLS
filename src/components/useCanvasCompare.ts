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
  const compareButtonRef = useRef<HTMLButtonElement | null>(null);

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
    const button = compareButtonRef.current;
    if (!button) return;

    const handlePointerDown = (event: PointerEvent) => {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Safe fallback when pointer capture is unavailable.
      }
      startCompare();
    };
    const handleMouseDown = () => startCompare();
    const handlePointerUp = (event: PointerEvent) => {
      try {
        if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      } catch {
        // Safe fallback when pointer capture is unavailable.
      }
      endCompare();
    };
    const handleMouseUp = () => endCompare();
    const handlePointerCancel = () => endCompare();

    button.addEventListener('pointerdown', handlePointerDown);
    button.addEventListener('mousedown', handleMouseDown);
    button.addEventListener('pointerup', handlePointerUp);
    button.addEventListener('mouseup', handleMouseUp);
    button.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      button.removeEventListener('pointerdown', handlePointerDown);
      button.removeEventListener('mousedown', handleMouseDown);
      button.removeEventListener('pointerup', handlePointerUp);
      button.removeEventListener('mouseup', handleMouseUp);
      button.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [endCompare, startCompare]);

  useEffect(() => {
    const handleBlur = () => endCompare();
    const handleVisibilityChange = () => {
      if (document.hidden) endCompare();
    };
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endCompare();
    };
    const handleGlobalMouseUp = () => endCompare();
    const handleGlobalPointerUp = () => endCompare();

    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (isComparingRef.current) {
        isComparingRef.current = false;
        onEndRef.current?.();
      }
    };
  }, [endCompare]);

  const handlePointerDownFallback = useCallback((_event: React.PointerEvent<HTMLButtonElement>) => {
    startCompare();
  }, [startCompare]);

  const handlePointerUpFallback = useCallback((_event: React.PointerEvent<HTMLButtonElement>) => {
    endCompare();
  }, [endCompare]);

  const handleMouseDownFallback = useCallback((_event: React.MouseEvent<HTMLButtonElement>) => {
    startCompare();
  }, [startCompare]);

  const handleMouseUpFallback = useCallback((_event: React.MouseEvent<HTMLButtonElement>) => {
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
      ref: compareButtonRef,
      onPointerDown: handlePointerDownFallback,
      onPointerUp: handlePointerUpFallback,
      onPointerCancel: handlePointerUpFallback,
      onMouseDown: handleMouseDownFallback,
      onMouseUp: handleMouseUpFallback,
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
    },
  };
};
