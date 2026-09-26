export type OutputReview = Readonly<{
  passed: boolean;
  advisory: true;
  score: number;
  reasons: readonly string[];
}>;

export function reviewOutputBasics(
  inputBlob: Blob,
  outputBlob: Blob,
  options: Readonly<{ preserveSubject: boolean; requireVisibleChange: boolean }> = {
    preserveSubject: false,
    requireVisibleChange: false,
  },
): OutputReview {
  const reasons: string[] = [];
  if (outputBlob.size <= 0) reasons.push('OUTPUT_EMPTY');
  if (!outputBlob.type) reasons.push('OUTPUT_MIME_MISSING');

  const ratio = outputBlob.size / Math.max(1, inputBlob.size);
  if (outputBlob.size > 0 && ratio < 0.001 && !options.requireVisibleChange) {
    reasons.push('OUTPUT_SIZE_SUSPICIOUSLY_SMALL');
  }

  const score = Math.max(0, Math.min(1,
    (outputBlob.size > 0 ? 0.5 : 0)
    + (outputBlob.type ? 0.2 : 0)
    + (ratio >= 0.001 || options.requireVisibleChange ? 0.2 : 0)
    + (options.preserveSubject ? 0.1 : 0.1),
  ));

  return Object.freeze({
    passed: reasons.length === 0,
    advisory: true,
    score,
    reasons: Object.freeze(reasons),
  });
}
