import { ReactNode } from 'react';
import { CommandPalette } from './command-palette';

export function FlixoUxShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}
