export type ModelGateStatus = 'PASS' | 'REVIEW_REQUIRED' | 'BLOCKED' | 'UNKNOWN';

export type ModelLifecycleStatus = 'CANDIDATE' | 'APPROVED' | 'ACTIVE' | 'QUARANTINED';

export type ModelManifestEntry = Readonly<{
  model: string;
  version: string;
  source: string;
  license: string;
  license_file: string;
  artifact_sha256: string;
  download_date: string;
  commercial_use: ModelGateStatus;
  fine_tuning: ModelGateStatus;
  redistribution: ModelGateStatus;
  distillation: ModelGateStatus;
  adapter_policy: ModelGateStatus;
  acceptable_use_policy: ModelGateStatus;
  trademark_restrictions: ModelGateStatus;
  training_data_restrictions: ModelGateStatus;
  provenance_status: ModelGateStatus;
  FLIXO_owned_layer: string;
  fallback_models: readonly string[];
  review_status: ModelGateStatus;
  lifecycle_status: ModelLifecycleStatus;
}>;

const HEX_SHA256 = /^[a-f0-9]{64}$/iu;

export function modelIdentity(entry: Pick<ModelManifestEntry, 'model' | 'version'>): string {
  return entry.model + '@' + entry.version;
}

export function evaluateModelAdmission(entry: ModelManifestEntry): ModelGateStatus {
  const checks: readonly ModelGateStatus[] = [
    entry.commercial_use,
    entry.fine_tuning,
    entry.redistribution,
    entry.distillation,
    entry.adapter_policy,
    entry.acceptable_use_policy,
    entry.trademark_restrictions,
    entry.training_data_restrictions,
    entry.provenance_status,
    entry.review_status,
  ];

  if (!entry.model || !entry.version || !entry.source || !entry.license || !entry.license_file) return 'BLOCKED';
  if (!HEX_SHA256.test(entry.artifact_sha256)) return 'BLOCKED';
  if (checks.includes('BLOCKED')) return 'BLOCKED';
  if (checks.includes('UNKNOWN')) return 'UNKNOWN';
  if (checks.includes('REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  return 'PASS';
}

export function isProductionEligible(entry: ModelManifestEntry): boolean {
  return entry.lifecycle_status === 'ACTIVE' && evaluateModelAdmission(entry) === 'PASS';
}

export function quarantineModel(entry: ModelManifestEntry): ModelManifestEntry {
  return Object.freeze({ ...entry, lifecycle_status: 'QUARANTINED', review_status: 'REVIEW_REQUIRED' });
}

export function canFallbackTo(
  primary: ModelManifestEntry,
  fallback: ModelManifestEntry,
): boolean {
  return (
    primary.fallback_models.includes(modelIdentity(fallback)) &&
    isProductionEligible(fallback) &&
    modelIdentity(primary) !== modelIdentity(fallback)
  );
}
