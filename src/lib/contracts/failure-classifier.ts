import type { ContractResult } from './ci-contracts.ts';

export type FailureCategory =
  | 'TYPE_ERROR'
  | 'BUILD_ERROR'
  | 'REGISTRY_DRIFT'
  | 'ROUTER_DRIFT'
  | 'ROUTE_RESOLUTION_ERROR'
  | 'SEO_METADATA_MISMATCH'
  | 'LOCALIZED_TITLE_MISMATCH'
  | 'LOCALIZED_DESCRIPTION_MISMATCH'
  | 'ENGLISH_UI_LEAKAGE'
  | 'CANONICAL_MISMATCH'
  | 'HREFLANG_MISMATCH'
  | 'A11Y_DUPLICATE_LANDMARK'
  | 'A11Y_MISSING_NAME'
  | 'RUNTIME_EXCEPTION'
  | 'CONSOLE_ERROR'
  | 'NETWORK_ERROR'
  | 'ARTIFACT_INTEGRITY_ERROR'
  | 'FILE_SIGNATURE_ERROR'
  | 'DEPLOYMENT_ERROR'
  | 'INFRASTRUCTURE_ERROR'
  | 'FLAKY_TEST'
  | 'UNKNOWN';

export type RootCauseId =
  | 'RC-TYPE-001'
  | 'RC-BUILD-001'
  | 'RC-G1-REGISTRY-001'
  | 'RC-G1-ROUTER-001'
  | 'RC-G1-ROUTE-001'
  | 'RC-G4-SEO-001'
  | 'RC-G4-I18N-001'
  | 'RC-G4-A11Y-001'
  | 'RC-G4-RUNTIME-001'
  | 'RC-G3-INTEGRITY-001'
  | 'RC-G2-SIGNATURE-001'
  | 'RC-INFRA-001'
  | 'RC-UNKNOWN-001';

export type FailureClassification = {
  category: FailureCategory;
  rootCauseId: RootCauseId;
  deterministic: boolean;
  contract: ContractResult;
};

const textOf = (result: ContractResult): string =>
  [result.contract, result.assertion, result.expected, result.actual, result.evidence?.source]
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join(' ')
    .toLowerCase();

export function classifyContractFailure(result: ContractResult): FailureClassification {
  if (result.status !== 'FAIL') {
    throw new Error(`Failure classifier requires FAIL result: ${result.contract}`);
  }

  const text = textOf(result);
  let category: FailureCategory = 'UNKNOWN';
  let rootCauseId: RootCauseId = 'RC-UNKNOWN-001';
  let deterministic = true;

  if (/type|typescript|tsc/.test(text)) {
    category = 'TYPE_ERROR'; rootCauseId = 'RC-TYPE-001';
  } else if (/build|vite|bundl/.test(text)) {
    category = 'BUILD_ERROR'; rootCauseId = 'RC-BUILD-001';
  } else if (/router/.test(text)) {
    category = 'ROUTER_DRIFT'; rootCauseId = 'RC-G1-ROUTER-001';
  } else if (/registry/.test(text)) {
    category = 'REGISTRY_DRIFT'; rootCauseId = 'RC-G1-REGISTRY-001';
  } else if (/route.?resolution|resolver/.test(text)) {
    category = 'ROUTE_RESOLUTION_ERROR'; rootCauseId = 'RC-G1-ROUTE-001';
  } else if (/title/.test(text) && /localized|locale|translation/.test(text)) {
    category = 'LOCALIZED_TITLE_MISMATCH'; rootCauseId = 'RC-G4-I18N-001';
  } else if (/description/.test(text) && /localized|locale|translation/.test(text)) {
    category = 'LOCALIZED_DESCRIPTION_MISMATCH'; rootCauseId = 'RC-G4-I18N-001';
  } else if (/english.*leak|leak.*english/.test(text)) {
    category = 'ENGLISH_UI_LEAKAGE'; rootCauseId = 'RC-G4-I18N-001';
  } else if (/canonical/.test(text)) {
    category = 'CANONICAL_MISMATCH'; rootCauseId = 'RC-G4-SEO-001';
  } else if (/hreflang/.test(text)) {
    category = 'HREFLANG_MISMATCH'; rootCauseId = 'RC-G4-SEO-001';
  } else if (/seo|metadata/.test(text)) {
    category = 'SEO_METADATA_MISMATCH'; rootCauseId = 'RC-G4-SEO-001';
  } else if (/duplicate.*(main|landmark)|duplicate landmark/.test(text)) {
    category = 'A11Y_DUPLICATE_LANDMARK'; rootCauseId = 'RC-G4-A11Y-001';
  } else if (/accessible name|missing name|aria-label|aria-labelledby/.test(text)) {
    category = 'A11Y_MISSING_NAME'; rootCauseId = 'RC-G4-A11Y-001';
  } else if (/console/.test(text)) {
    category = 'CONSOLE_ERROR'; rootCauseId = 'RC-G4-RUNTIME-001';
  } else if (/network|fetch failed|request failed/.test(text)) {
    category = 'NETWORK_ERROR'; rootCauseId = 'RC-G4-RUNTIME-001';
  } else if (/signature|magic byte|mime/.test(text)) {
    category = 'FILE_SIGNATURE_ERROR'; rootCauseId = 'RC-G2-SIGNATURE-001';
  } else if (/artifact|sha|integrity|corrupt/.test(text)) {
    category = 'ARTIFACT_INTEGRITY_ERROR'; rootCauseId = 'RC-G3-INTEGRITY-001';
  } else if (/deployment|vercel|rate.?limit/.test(text)) {
    category = /rate.?limit/.test(text) ? 'INFRASTRUCTURE_ERROR' : 'DEPLOYMENT_ERROR';
    rootCauseId = 'RC-INFRA-001';
    deterministic = /rate.?limit/.test(text);
  } else if (/flaky|intermittent|timeout/.test(text)) {
    category = 'FLAKY_TEST'; rootCauseId = 'RC-G4-RUNTIME-001'; deterministic = false;
  } else if (/runtime|exception|uncaught/.test(text)) {
    category = 'RUNTIME_EXCEPTION'; rootCauseId = 'RC-G4-RUNTIME-001';
  }

  return { category, rootCauseId, deterministic, contract: result };
}
