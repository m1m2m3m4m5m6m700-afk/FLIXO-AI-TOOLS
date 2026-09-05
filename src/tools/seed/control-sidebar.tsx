import type { HTMLAttributes, ReactNode } from 'react';

export function ControlSidebar({ children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <aside {...props} className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950/90 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl ${props.className ?? ''}`}>
      {children}
    </aside>
  );
}
