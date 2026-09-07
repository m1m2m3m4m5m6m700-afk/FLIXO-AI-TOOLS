import type { ComponentType, LazyExoticComponent } from 'react';
import type { CanonicalLocale } from '../../lib/i18n/config.ts';

export interface ReadyToolComponentProps {
  locale?: CanonicalLocale;
}

export type ReadyToolComponent = ComponentType<ReadyToolComponentProps>;
export type ToolComponent = ReadyToolComponent | LazyExoticComponent<ReadyToolComponent>;

export type ToolConfig = {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly description: string;
  readonly category: 'Images' | 'AI' | 'Other';
  readonly isReady: boolean;
  readonly aliases?: readonly string[];
  readonly component: ToolComponent;
};

export type ToolFamily = 'image' | 'pdf' | 'audio' | 'video' | 'ai' | 'other';
