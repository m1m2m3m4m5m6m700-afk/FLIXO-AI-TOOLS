import type { Document } from './document';

export type FlixoScene = Readonly<{
  format: 'flixo-scene';
  version: 1;
  document: Document;
  agentTrace?: Readonly<{
    intent?: string;
    visualGoal?: unknown;
    plan?: unknown;
    verification?: unknown;
  }>;
}>;

export const serializeScene = (scene: FlixoScene): string => JSON.stringify(scene);
export const parseScene = (serialized: string): FlixoScene => {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== 'object') throw new Error('FLIXO_SCENE_INVALID');
  const scene = value as Partial<FlixoScene>;
  if (scene.format !== 'flixo-scene' || scene.version !== 1 || !scene.document) throw new Error('FLIXO_SCENE_SCHEMA_INVALID');
  return scene as FlixoScene;
};
