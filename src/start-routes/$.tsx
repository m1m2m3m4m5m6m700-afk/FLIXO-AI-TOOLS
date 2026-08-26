import { createFileRoute } from '@tanstack/react-router';
import { StartAppBridge } from '../start-app-bridge';

export const Route = createFileRoute('/$')({
  component: StartAppBridge,
});
