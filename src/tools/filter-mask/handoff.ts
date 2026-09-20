import { getLiveFilter, type LiveFilterDefinition } from './registry';

export type FilterMaskParameters = Readonly<{
  intensity: number;
  zoom: number;
  mirror: boolean;
  aspectRatio: '9:16' | '4:5' | '1:1' | '16:9';
}>;

export type FilterMaskHandoff = Readonly<{
  canonicalId: string;
  parameters: FilterMaskParameters;
}>;

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));
const clampZoom = (value: number): number => Math.min(2, Math.max(1, Math.round(value * 10) / 10));
const ASPECT_RATIOS = ['9:16', '4:5', '1:1', '16:9'] as const;
const normalizeAspectRatio = (value: string | undefined): FilterMaskParameters['aspectRatio'] =>
  ASPECT_RATIOS.includes(value as FilterMaskParameters['aspectRatio']) ? value as FilterMaskParameters['aspectRatio'] : '9:16';

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
      aspectRatio: normalizeAspectRatio(parameters.aspectRatio),
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
  const aspectRatio = normalizeAspectRatio(params.get('aspectRatio') ?? undefined);

  return createFilterMaskHandoff(getLiveFilter(canonicalId)!, { intensity, zoom, mirror, aspectRatio });
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
    aspectRatio: handoff.parameters.aspectRatio,
  });
  return `/${encodeURIComponent(locale)}/filter-mask?${params.toString()}`;
}
