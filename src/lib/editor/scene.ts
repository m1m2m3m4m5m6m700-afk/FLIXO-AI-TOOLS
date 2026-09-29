import type { Document } from './document';
import { validateDocument } from './document/validator';

export type AgentTrace = Readonly<{
  intent?: string;
  visualGoal?: unknown;
  plan?: unknown;
  operations?: readonly unknown[];
  verification?: unknown;
  refinements?: readonly unknown[];
}>;

export type FlixoScene = Readonly<{
  format: 'flixo-scene';
  version: 1;
  document: Document;
  agentTrace?: AgentTrace;
}>;

export const serializeScene = (scene: FlixoScene): string => {
  validateDocument(scene.document);
  return JSON.stringify(scene);
};

export const parseScene = (serialized: string): FlixoScene => {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('FLIXO_SCENE_INVALID'); }
  if (!value || typeof value !== 'object') throw new Error('FLIXO_SCENE_INVALID');
  const scene = value as Partial<FlixoScene>;
  if (scene.format !== 'flixo-scene' || scene.version !== 1 || !scene.document) throw new Error('FLIXO_SCENE_SCHEMA_INVALID');
  validateDocument(scene.document as Document);
  return scene as FlixoScene;
};
