import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Undo2, Redo2, Eye } from 'lucide-react';
import { useCanvasCompare } from './useCanvasCompare';

export interface FloatingCanvasOverlayLabels {
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  undo: string;
  redo: string;
  compareHold: string;
  compareLabel: string;
  fullscreenEnter: string;
  fullscreenExit: string;
}

export interface FloatingCanvasOverlayProps {
  zoomLevel: number;
  labels: FloatingCanvasOverlayLabels;
  canUndo?: boolean;
  canRedo?: boolean;
  isFullscreen?: boolean;
  isMobileSheetOpen?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCompareStart?: () => void;
  onCompareEnd?: () => void;
  onToggleFullscreen?: () => void;
}

export const FloatingCanvasOverlay: React.FC<FloatingCanvasOverlayProps> = ({
  zoomLevel,
  labels,
  canUndo = false,
  canRedo = false,
  isFullscreen = false,
  isMobileSheetOpen = false,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onUndo,
  onRedo,
  onCompareStart,
  onCompareEnd,
  onToggleFullscreen,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { isComparing, bind } = useCanvasCompare({ onCompareStart, onCompareEnd });

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
      className={`absolute left-1/2 z-20 flex -translate-x-1/2 select-none items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-zinc-950/85 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all duration-300 ${
        isMobileSheetOpen ? 'bottom-20 md:bottom-4' : 'bottom-4'
      }`}
    >
      <div className="flex items-center rounded-xl border border-white/[0.05] bg-black/40 p-0.5">
        <button type="button" onClick={onZoomOut} data-testid="button-canvas-zoom-out" aria-label={labels.zoomOut} className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onResetZoom} data-testid="button-canvas-zoom-reset" aria-label={labels.zoomReset} className="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400 transition-all hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
          {Math.round(zoomLevel * 100)}%
        </button>
        <button type="button" onClick={onZoomIn} data-testid="button-canvas-zoom-in" aria-label={labels.zoomIn} className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-white/[0.08]" aria-hidden="true" />

      <div className="flex items-center gap-0.5">
        <button type="button" onClick={onUndo} disabled={!canUndo} data-testid="button-canvas-undo" aria-label={`${labels.undo} Canvas`} className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 disabled:opacity-30 disabled:hover:text-zinc-400">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} data-testid="button-canvas-redo" aria-label={`${labels.redo} Canvas`} className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 disabled:opacity-30 disabled:hover:text-zinc-400">
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-white/[0.08]" aria-hidden="true" />

      <button type="button" {...bind} data-testid="button-canvas-compare" aria-label={labels.compareHold} aria-pressed={isComparing} className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 touch-none ${isComparing ? 'scale-95 border-violet-500/50 bg-violet-600/30 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-white/[0.05] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white'}`}>
        <Eye className={`h-3.5 w-3.5 ${isComparing ? 'text-violet-300' : 'text-violet-400'}`} />
        <span className="hidden font-mono text-[10px] sm:inline">{labels.compareLabel}</span>
      </button>

      {onToggleFullscreen ? (
        <button type="button" onClick={onToggleFullscreen} data-testid="button-canvas-fullscreen" aria-label={isFullscreen ? labels.fullscreenExit : labels.fullscreenEnter} className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </motion.div>
  );
};