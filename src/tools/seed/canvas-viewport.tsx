import type { HTMLAttributes, ReactNode } from 'react';

export function CanvasViewport({ children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section {...props} className={`relative flex min-h-[560px] min-w-0 items-center justify-center overflow-hidden rounded-2xl border bg-zinc-950 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.24)] transition ${props.className ?? ''}`}>
      {children}
    </section>
  );
}
