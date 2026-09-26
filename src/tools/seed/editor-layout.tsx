import type { HTMLAttributes, ReactNode } from 'react';

export function EditorLayout({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={`mx-auto flex min-h-[760px] w-full max-w-[1500px] flex-col gap-3 p-2 sm:p-3 lg:p-4 ${props.className ?? ''}`}>
      {children}
    </div>
  );
}
