import type { HTMLAttributes, ReactNode } from 'react';

export function HeaderBar({ children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <header {...props} className={`flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-950/85 px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4 ${props.className ?? ''}`}>
      {children}
    </header>
  );
}
