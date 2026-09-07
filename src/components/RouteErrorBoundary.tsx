import type { ErrorComponentProps, NotFoundComponentProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Component } from 'react';

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FLIXO] route render failure:', message);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main role="alert" aria-live="assertive">
          <h1>Something went wrong</h1>
          <p>Please reload the page and try again.</p>
        </main>
      );
    }

    return this.props.children;
  }
}

export function ErrorComponent({ error }: ErrorComponentProps): ReactNode {
  return (
    <main role="alert" aria-live="assertive">
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : 'The page could not be rendered.'}</p>
    </main>
  );
}

export function NotFoundComponent(_props: NotFoundComponentProps): ReactNode {
  return (
    <main>
      <h1>Page not found</h1>
      <p>The requested FLIXO route does not exist.</p>
    </main>
  );
}
