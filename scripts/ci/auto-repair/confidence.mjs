export function confidenceGate({ selected, features, changedFiles = 0, changedLines = 0, maxFiles = 8, maxLines = 300 }) {
  const deterministic = Boolean(selected) && (selected?.id === 'prepared-source-change' ? selected.deterministicProof === true : features.length === 1);
  const bounded = changedFiles <= maxFiles && changedLines <= maxLines;
  const score = selected ? (selected?.id === 'prepared-source-change' ? Number(selected.confidence ?? 0) : Math.max(0, selected.confidence - (features.length - 1) * 20)) : 0;
  return { score, deterministic, bounded, allowed: Boolean(selected?.mutate) && score >= 90 && deterministic && bounded };
}
