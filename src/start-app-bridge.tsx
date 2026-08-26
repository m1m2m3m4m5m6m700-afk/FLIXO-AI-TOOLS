import { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './command-palette.css';
import './tools/seed/seed-premium.css';

export function StartAppBridge() {
  const [router] = useState(getRouter);

  return (
    <FlixoUxShell>
      <RouterProvider router={router} />
    </FlixoUxShell>
  );
}
