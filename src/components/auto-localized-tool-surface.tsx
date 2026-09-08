import type { ReactNode } from 'react';

type Props = Readonly<{ locale: string; toolId: string; children: ReactNode }>;

/**
 * React-owned tool surfaces must remain declarative. Locale and tool semantics
 * are supplied by the route/tool component; global i18n handles legacy copy.
 * This boundary intentionally performs no post-render DOM mutation.
 */
export function AutoLocalizedToolSurface({ children }: Props) {
  return children;
}
