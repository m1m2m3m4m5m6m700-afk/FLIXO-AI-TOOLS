export type ContractStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_APPLICABLE';

export type ContractScope = {
  toolId?: string;
  route?: string;
  locale?: string;
  file?: string;
};

export type ContractEvidence = {
  source?: string;
  line?: number;
  artifact?: string;
};

export type ContractResult = {
  gate: string;
  contract: string;
  status: ContractStatus;
  rootCauseId?: string;
  scope: ContractScope;
  expected?: unknown;
  actual?: unknown;
  assertion?: string;
  evidence?: ContractEvidence;
  blockedBy?: string[];
};

export const CONTRACT_IDS = {
  G1_REGISTRY_001: 'G1-REGISTRY-001',
  G1_READY_001: 'G1-READY-001',
  G1_ROUTER_001: 'G1-ROUTER-001',
  G1_ROUTE_001: 'G1-ROUTE-001',
  G1_SITEMAP_001: 'G1-SITEMAP-001',
  G1_SEO_001: 'G1-SEO-001',
  G1_CANONICAL_001: 'G1-CANONICAL-001',
  G1_INDEXING_001: 'G1-INDEXING-001',

  G2_EXTENSION_001: 'G2-EXTENSION-001',
  G2_MIME_001: 'G2-MIME-001',
  G2_MAGIC_BYTES_001: 'G2-MAGIC-BYTES-001',
  G2_SIGNATURE_001: 'G2-SIGNATURE-001',
  G2_PATH_001: 'G2-PATH-001',
  G2_CONTAINMENT_001: 'G2-CONTAINMENT-001',
  G2_UNSAFE_INPUT_001: 'G2-UNSAFE-INPUT-001',

  G3_OUTPUT_001: 'G3-OUTPUT-001',
  G3_TYPE_001: 'G3-TYPE-001',
  G3_SIGNATURE_001: 'G3-SIGNATURE-001',
  G3_INTEGRITY_001: 'G3-INTEGRITY-001',
  G3_SHA_001: 'G3-SHA-001',
  G3_DOWNLOAD_001: 'G3-DOWNLOAD-001',
  G3_CORRUPTION_001: 'G3-CORRUPTION-001',

  G4_ROUTE_001: 'G4-ROUTE-001',
  G4_HTTP_001: 'G4-HTTP-001',
  G4_DOCUMENT_001: 'G4-DOCUMENT-001',
  G4_LANG_001: 'G4-LANG-001',
  G4_DIR_001: 'G4-DIR-001',
  G4_TITLE_001: 'G4-TITLE-001',
  G4_DESCRIPTION_001: 'G4-DESCRIPTION-001',
  G4_H1_001: 'G4-H1-001',
  G4_CANONICAL_001: 'G4-CANONICAL-001',
  G4_HREFLANG_001: 'G4-HREFLANG-001',
  G4_ROBOTS_001: 'G4-ROBOTS-001',
  G4_STRUCTURED_DATA_001: 'G4-STRUCTURED-DATA-001',
  G4_TRANSLATION_001: 'G4-TRANSLATION-001',
  G4_ENGLISH_LEAKAGE_001: 'G4-ENGLISH-LEAKAGE-001',
  G4_A11Y_001: 'G4-A11Y-001',
  G4_RUNTIME_001: 'G4-RUNTIME-001',
  G4_CONSOLE_001: 'G4-CONSOLE-001',
  G4_NETWORK_001: 'G4-NETWORK-001',
  G4_INTERACTION_001: 'G4-INTERACTION-001',
  G4_OUTPUT_001: 'G4-OUTPUT-001',
} as const;

export type ContractId = (typeof CONTRACT_IDS)[keyof typeof CONTRACT_IDS];

export const CONTRACT_VERSIONS: Readonly<Record<ContractId, 1>> = Object.fromEntries(
  Object.values(CONTRACT_IDS).map((id) => [id, 1]),
) as Record<ContractId, 1>;

export const CONTRACT_ID_LIST: readonly ContractId[] = Object.values(CONTRACT_IDS);
