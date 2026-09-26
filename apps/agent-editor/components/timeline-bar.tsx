"use client";

import { TimelineBarPropsSchema } from "@/lib/ui-contracts";
import type { TimelineEvent } from "@/lib/schemas/project";

export interface TimelineBarProps {
  events: TimelineEvent[];
}

export function TimelineBar(props: TimelineBarProps) {
  const parsed = TimelineBarPropsSchema.parse(props);
  return (
    <section className="timeline" aria-label="Project timeline">
      <div className="timeline-header">
        <div className="kicker">TIMELINE</div>
        <div className="title">State events · {parsed.events.length}</div>
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
