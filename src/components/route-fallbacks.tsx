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
