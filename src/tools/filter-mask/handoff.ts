import { getLiveFilter, type LiveFilterDefinition } from './registry';

export type FilterMaskParameters = Readonly<{
  intensity: number;
  zoom: number;
  mirror: boolean;
}>;

export type FilterMaskHandoff = Readonly<{
  canonicalId: string;
  parameters: FilterMaskParameters;
}>;

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));
const clampZoom = (value: number): number => Math.min(2, Math.max(1, Math.round(value * 10) / 10));

export function createFilterMaskHandoff(
  filter: LiveFilterDefinition,
  parameters: Partial<FilterMaskParameters> = {},
): FilterMaskHandoff {
  return Object.freeze({
    canonicalId: filter.canonicalId,
    parameters: Object.freeze({
      intensity: clampIntensity(parameters.intensity ?? 100),
      zoom: clampZoom(parameters.zoom ?? 1),
      mirror: parameters.mirror ?? true,
    }),
  });
}

export function parseFilterMaskHandoff(search: string): FilterMaskHandoff | null {
  const params = new URLSearchParams(search);
  const canonicalId = params.get('canonicalId');
  if (!canonicalId || !getLiveFilter(canonicalId)) return null;

  const rawIntensity = Number(params.get('intensity') ?? 100);
  const rawZoom = Number(params.get('zoom') ?? 1);
  const intensity = Number.isFinite(rawIntensity) ? clampIntensity(rawIntensity) : 100;
  const zoom = Number.isFinite(rawZoom) ? clampZoom(rawZoom) : 1;
  const mirror = params.get('mirror') !== 'false';

  return createFilterMaskHandoff(getLiveFilter(canonicalId)!, { intensity, zoom, mirror });
}

export function buildFilterMaskUrl(
  locale: string,
  handoff: FilterMaskHandoff,
): string {
  const params = new URLSearchParams({
    canonicalId: handoff.canonicalId,
    intensity: String(handoff.parameters.intensity),
    zoom: String(handoff.parameters.zoom),
    mirror: String(handoff.parameters.mirror),
  });
  return `/${encodeURIComponent(locale)}/filter-mask?${params.toString()}`;
}
