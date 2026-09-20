import { useState, useEffect, useCallback } from 'react';

export interface UseFullscreenSyncOptions {
  targetRef?: React.RefObject<HTMLElement | null>;
  onError?: (error: unknown) => void;
}

export const useFullscreenSync = (options: UseFullscreenSyncOptions = {}) => {
  const { targetRef, onError } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenChange = useCallback(() => {
    const activeElement = document.fullscreenElement;
    if (!targetRef?.current) {
      setIsFullscreen(Boolean(activeElement));
    } else {
      setIsFullscreen(activeElement === targetRef.current);
    }
  }, [targetRef]);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const element = targetRef?.current ?? document.documentElement;
        await element.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      onError?.(error);
    }
  }, [targetRef, onError]);

  return { isFullscreen, toggleFullscreen };
};
