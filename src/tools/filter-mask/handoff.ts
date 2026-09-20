import { getLiveFilter, type LiveFilterDefinition } from './registry';

export type FilterMaskParameters = Readonly<{
  intensity: number;
}>;

export type FilterMaskHandoff = Readonly<{
  canonicalId: string;
  parameters: FilterMaskParameters;
}>;

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));

export function createFilterMaskHandoff(
  filter: LiveFilterDefinition,
  parameters: Partial<FilterMaskParameters> = {},
): FilterMaskHandoff {
  return Object.freeze({
    canonicalId: filter.canonicalId,
    parameters: Object.freeze({ intensity: clampIntensity(parameters.intensity ?? 100) }),
  });
}

export function parseFilterMaskHandoff(search: string): FilterMaskHandoff | null {
  const params = new URLSearchParams(search);
  const canonicalId = params.get('canonicalId');
  if (!canonicalId || !getLiveFilter(canonicalId)) return null;

  const rawIntensity = Number(params.get('intensity') ?? 100);
  const intensity = Number.isFinite(rawIntensity) ? clampIntensity(rawIntensity) : 100;

  return createFilterMaskHandoff(getLiveFilter(canonicalId)!, { intensity });
}

export function buildFilterMaskUrl(
  locale: string,
  handoff: FilterMaskHandoff,
): string {
  const params = new URLSearchParams({
    canonicalId: handoff.canonicalId,
    intensity: String(handoff.parameters.intensity),
  });
  return `/${encodeURIComponent(locale)}/filter-mask?${params.toString()}`;
}
