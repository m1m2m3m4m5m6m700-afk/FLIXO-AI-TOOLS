"use client";

import { TimelineBarPropsSchema } from "@/lib/ui-contracts";
import type { TimelineEvent } from "@/lib/schemas/project";

export interface TimelineBarProps {
  events: TimelineEvent[];
  durationSec: number;
  fps: number;
  currentTimeSec: number;
  onSeek: (timeSec: number) => void;
}

export function TimelineBar(props: TimelineBarProps) {
  const parsed = TimelineBarPropsSchema.parse(props);
  const maxFrameIndex = parsed.durationSec > 0
    ? Math.max(0, Math.ceil(parsed.durationSec * parsed.fps) - 1)
    : 0;
  const maxTimeSec = maxFrameIndex / parsed.fps;
  const frameIndex = Math.min(
    maxFrameIndex,
    Math.max(0, Math.round(parsed.currentTimeSec * parsed.fps)),
  );

  return (
    <section className="timeline" aria-label="Project timeline">
      <div className="timeline-header">
        <div>
          <div className="kicker">TIMELINE</div>
          <div className="title">Frame {frameIndex} · {parsed.events.length} state events</div>
        </div>
        <div className="timeline-meta">
          {frameIndex} / {maxFrameIndex} · {parsed.currentTimeSec.toFixed(3)}s
        </div>
      </div>

      <div className="playback-bar">
        <input
          data-testid="frame-scrubber"
          aria-label="Frame-accurate timeline scrubber"
          type="range"
          min={0}
          max={maxTimeSec}
          step={1 / parsed.fps}
          value={Math.min(maxTimeSec, parsed.currentTimeSec)}
          onChange={(event) => parsed.onSeek(Number(event.target.value))}
        />
      </div>

      <div className="timeline-track">
        {parsed.events.length === 0 ? (
          <div className="empty-state">No state mutations yet.</div>
        ) : (
          parsed.events.map((event) => (
            <article key={event.id} className="timeline-event">
              <div className="timeline-event-header">
                <strong>{event.actionType}</strong>
                <span className="timeline-meta">t={event.timestamp}s</span>
              </div>
              <div className="timeline-meta">{event.description}</div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}