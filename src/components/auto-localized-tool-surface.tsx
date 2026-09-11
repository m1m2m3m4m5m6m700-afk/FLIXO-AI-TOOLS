import { cloneElement, isValidElement, useEffect, type ReactNode } from 'react';
import { translateValue } from '../lib/i18n/tool-ui-runtime-completeness';
import { installScopedRuntimeObserver, localizeScopedRoot } from '../lib/i18n/scoped-runtime-observer';
import type { Locale } from '../lib/i18n';

type Props = Readonly<{ locale: Locale; toolId: string; children: ReactNode }>;

const LOCALIZED_ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const;

function localizeNode(node: ReactNode, locale: Locale, toolId: string): ReactNode {
  if (typeof node === 'string') return translateValue(locale, node, toolId);
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, locale, toolId));
  if (!isValidElement(node)) return node;

  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  const nextProps: Record<string, unknown> = { ...props };

  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const value = props[attribute];
    if (typeof value === 'string') nextProps[attribute] = translateValue(locale, value, toolId);
  }

  if (props.children !== undefined) {
    nextProps.children = localizeNode(props.children, locale, toolId);
  }

  return cloneElement(node, nextProps);
}

/**
 * Tool surfaces use declarative localization for reachable React nodes and a
 * scoped compatibility observer for legacy/lazy tool components whose rendered
 * DOM cannot be traversed before React resolves the component. The observer is
 * confined to declared tool roots and never observes document.body.
 */
export function AutoLocalizedToolSurface({ locale, toolId, children }: Props) {
  useEffect(() => {
    const stop = installScopedRuntimeObserver((root, currentLocale) => {
      localizeScopedRoot(root, currentLocale, toolId);
    });
    return stop;
  }, [toolId]);

  return <>{localizeNode(children, locale, toolId)}</>;
}
