export type FailureClass =
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

export interface FailureEvent {
  id: string;
  contract: string;
  status: 'FAIL';
  message: string;
  route?: string;
  locale?: string;
  source?: string;
  durationMs?: number;
}

export interface ClassifiedFailure extends FailureEvent {
  classification: FailureClass;
  rootCauseId: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

const patterns: Array<{ re: RegExp; classification: FailureClass; rootCauseId: string; confidence: ClassifiedFailure['confidence'] }> = [
  { re: /TypeScript|TS\d+/i, classification: 'TYPE_ERROR', rootCauseId: 'RC-TYPE-001', confidence: 'HIGH' },
  { re: /build failed|vite build|production build/i, classification: 'BUILD_ERROR', rootCauseId: 'RC-BUILD-001', confidence: 'HIGH' },
  { re: /canonical/i, classification: 'CANONICAL_MISMATCH', rootCauseId: 'RC-G4-SEO-001', confidence: 'MEDIUM' },
  { re: /hreflang|alternate/i, classification: 'HREFLANG_MISMATCH', rootCauseId: 'RC-G4-SEO-002', confidence: 'MEDIUM' },
  { re: /title/i, classification: 'LOCALIZED_TITLE_MISMATCH', rootCauseId: 'RC-G4-SEO-003', confidence: 'MEDIUM' },
  { re: /description/i, classification: 'LOCALIZED_DESCRIPTION_MISMATCH', rootCauseId: 'RC-G4-SEO-004', confidence: 'MEDIUM' },
  { re: /english|fallback|leakage/i, classification: 'ENGLISH_UI_LEAKAGE', rootCauseId: 'RC-G4-I18N-001', confidence: 'HIGH' },
  { re: /duplicate .*main|duplicate landmark/i, classification: 'A11Y_DUPLICATE_LANDMARK', rootCauseId: 'RC-G4-A11Y-001', confidence: 'HIGH' },
  { re: /accessible name|unnamed/i, classification: 'A11Y_MISSING_NAME', rootCauseId: 'RC-G4-A11Y-002', confidence: 'HIGH' },
  { re: /TimeoutError.*locator\.setInputFiles|locator\.setInputFiles.*Timeout/i, classification: 'RUNTIME_EXCEPTION', rootCauseId: 'RC-G3-RUNTIME-001', confidence: 'HIGH' },
  { re: /console|uncaught|exception/i, classification: 'RUNTIME_EXCEPTION', rootCauseId: 'RC-G4-RUNTIME-001', confidence: 'MEDIUM' },
  { re: /network|request failed|ECONN/i, classification: 'NETWORK_ERROR', rootCauseId: 'RC-INFRA-002', confidence: 'MEDIUM' },
  { re: /signature|magic bytes|mime/i, classification: 'FILE_SIGNATURE_ERROR', rootCauseId: 'RC-G2-SIGNATURE-001', confidence: 'HIGH' },
  { re: /corrupt|integrity|sha/i, classification: 'ARTIFACT_INTEGRITY_ERROR', rootCauseId: 'RC-G3-INTEGRITY-001', confidence: 'HIGH' },
  { re: /deployment|rate limit|api-deployments-free-per-day/i, classification: 'INFRASTRUCTURE_ERROR', rootCauseId: 'RC-INFRA-001', confidence: 'HIGH' },
];

export function classifyFailure(event: FailureEvent): ClassifiedFailure {
  const match = patterns.find((pattern) => pattern.re.test(event.message));
  if (match) return { ...event, ...match };
  return { ...event, classification: 'UNKNOWN', rootCauseId: 'RC-UNKNOWN-001', confidence: 'LOW' };
}
