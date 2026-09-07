import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getToolUiCopy } from '@/data/tool-ui-i18n';

export function ErrorComponent({ reset }: { reset?: () => void }) {
  const copy = getToolUiCopy();
  return (
    <main role="alert" aria-live="assertive">
      <h1>{copy.notFound}</h1>
      {reset ? <button type="button" onClick={reset}>{copy.reset}</button> : null}
      <a href="/">{copy.home}</a>
    </main>
  );
}

export function NotFoundComponent() {
  const copy = getToolUiCopy();
  return (
    <main role="status" aria-live="polite">
      <h1>{copy.notFound}</h1>
      <a href="/">{copy.home}</a>
    </main>
  );
}

type RouteErrorBoundaryProps = { children: ReactNode };
type RouteErrorBoundaryState = { error: Error | null };

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  public state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[route-error-boundary]', error, errorInfo);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    return this.state.error ? <ErrorComponent reset={this.reset} /> : this.props.children;
  }
}
