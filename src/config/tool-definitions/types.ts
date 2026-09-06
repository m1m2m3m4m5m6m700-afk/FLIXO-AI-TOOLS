import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolComponent = ComponentType | LazyExoticComponent<ComponentType>;

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
