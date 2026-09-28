import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ModelGateStatus, ModelLifecycleStatus, ModelManifestEntry } from './model-governance.ts';
import { evaluateModelAdmission, isProductionEligible, modelIdentity } from './model-governance.ts';
import type { ModelSelection } from './model-router.ts';

type ManifestDocument = {
  schema_version: string;
  status: string;
  authority: string;
  entries: ModelManifestEntry[];
};

const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/MODEL_LICENSE_MANIFEST.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestDocument;

function assertManifestShape(): void {
  if (
    manifest.schema_version !== '1.0.0'
    || manifest.status !== 'ACTIVE'
    || manifest.authority !== 'FLIXO_CONTROL_PLANE'
    || !Array.isArray(manifest.entries)
  ) {
    throw new Error('MODEL_MANIFEST_INVALID');
  }
}

assertManifestShape();

export function listRegisteredModels(): readonly ModelManifestEntry[] {
  return manifest.entries;
}

export function findRegisteredModel(model: string): ModelManifestEntry | null {
  const matches = manifest.entries.filter((entry) => entry.model === model);
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

export type ModelAdmission = Readonly<{
  identity: string;
  status: ModelGateStatus;
  lifecycle: ModelLifecycleStatus | 'UNREGISTERED';
  eligible: boolean;
}>;

export function admitModelSelection(selection: Pick<ModelSelection, 'model'>): ModelAdmission {
  const entry = findRegisteredModel(selection.model);
  if (!entry) {
    return Object.freeze({
      identity: selection.model,
      status: 'BLOCKED',
      lifecycle: 'UNREGISTERED',
      eligible: false,
    });
  }
  const status = evaluateModelAdmission(entry);
  const eligible = status === 'PASS' && isProductionEligible(entry);
  return Object.freeze({
    identity: modelIdentity(entry),
    status,
    lifecycle: entry.lifecycle_status,
    eligible,
  });
}

export function assertModelSelectionAdmitted(selection: Pick<ModelSelection, 'model'>): ModelAdmission {
  const admission = admitModelSelection(selection);
  if (!admission.eligible) {
    throw new Error(`MODEL_NOT_ADMITTED:${admission.identity}:${admission.status}`);
  }
  return admission;
}
