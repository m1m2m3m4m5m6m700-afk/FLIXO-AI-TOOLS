import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolConfig = {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly description: string;
  readonly category: 'Images' | 'AI' | 'Other';
  readonly isReady: boolean;
  readonly aliases?: readonly string[];
  readonly component: LazyExoticComponent<ComponentType>;
};

export type ToolFamily = 'image' | 'pdf' | 'audio' | 'video' | 'ai' | 'other';
