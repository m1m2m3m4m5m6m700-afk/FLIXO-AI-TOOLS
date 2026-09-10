import { cloneElement, isValidElement, type ReactNode } from 'react';
import { translateValue } from '../lib/i18n/tool-ui-runtime-completeness';

type Props = Readonly<{ locale: string; toolId: string; children: ReactNode }>;

const LOCALIZED_ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const;

function localizeNode(node: ReactNode, locale: string, toolId: string): ReactNode {
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
 * React-owned tool surfaces remain declarative. Localization is applied while
 * the React tree is constructed; no post-render DOM mutation or body observer
 * is used. Tool-specific copy remains authoritative and unmapped values pass
 * through unchanged.
 */
export function AutoLocalizedToolSurface({ locale, toolId, children }: Props) {
  return <>{localizeNode(children, locale, toolId)}</>;
}
