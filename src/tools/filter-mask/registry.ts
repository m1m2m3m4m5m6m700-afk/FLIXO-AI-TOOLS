export type LiveFilterDefinition = Readonly<{canonicalId:string;version:1;family:'color'|'mood'|'cinematic'|'mono'|'retro';label:string;cssFilter:string;supportsLive:true}>;
export const LIVE_FILTER_REGISTRY:readonly LiveFilterDefinition[] = Object.freeze([
  { canonicalId: 'effect.original', version: 1, family: 'color', label: 'Original', cssFilter: 'none', supportsLive: true },
  { canonicalId: 'effect.bright', version: 1, family: 'mood', label: 'Bright', cssFilter: 'brightness(0.98) saturate(0.85) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.soft_light', version: 1, family: 'cinematic', label: 'Soft Light', cssFilter: 'brightness(1.02) saturate(0.98) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.clean', version: 1, family: 'mono', label: 'Clean', cssFilter: 'brightness(1.06) saturate(1.1099999999999999) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.vivid', version: 1, family: 'retro', label: 'Vivid', cssFilter: 'brightness(1.0999999999999999) saturate(1.24) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.pop', version: 1, family: 'color', label: 'Pop', cssFilter: 'brightness(0.94) saturate(1.37) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.punch', version: 1, family: 'mood', label: 'Punch', cssFilter: 'brightness(0.98) saturate(1.5) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.warm', version: 1, family: 'cinematic', label: 'Warm', cssFilter: 'brightness(1.02) saturate(0.72) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.sunset', version: 1, family: 'mono', label: 'Sunset', cssFilter: 'brightness(1.06) saturate(0.85) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.golden_hour', version: 1, family: 'retro', label: 'Golden Hour', cssFilter: 'brightness(1.0999999999999999) saturate(0.98) contrast(1.1) hue-rotate(28deg)', supportsLive: true },
  { canonicalId: 'effect.cool', version: 1, family: 'color', label: 'Cool', cssFilter: 'brightness(0.94) saturate(1.1099999999999999) contrast(1.18) hue-rotate(35deg)', supportsLive: true },
  { canonicalId: 'effect.ice', version: 1, family: 'mood', label: 'Ice', cssFilter: 'brightness(0.98) saturate(1.24) contrast(1.26) hue-rotate(42deg)', supportsLive: true },
  { canonicalId: 'effect.ocean', version: 1, family: 'cinematic', label: 'Ocean', cssFilter: 'brightness(1.02) saturate(1.37) contrast(0.86) hue-rotate(-35deg)', supportsLive: true },
  { canonicalId: 'effect.forest', version: 1, family: 'mono', label: 'Forest', cssFilter: 'brightness(1.06) saturate(1.5) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.olive', version: 1, family: 'retro', label: 'Olive', cssFilter: 'brightness(1.0999999999999999) saturate(0.72) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.rose', version: 1, family: 'color', label: 'Rose', cssFilter: 'brightness(0.94) saturate(0.85) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.blush', version: 1, family: 'mood', label: 'Blush', cssFilter: 'brightness(0.98) saturate(0.98) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.lavender', version: 1, family: 'cinematic', label: 'Lavender', cssFilter: 'brightness(1.02) saturate(1.1099999999999999) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.neon', version: 1, family: 'mono', label: 'Neon', cssFilter: 'brightness(1.06) saturate(1.24) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.candy', version: 1, family: 'retro', label: 'Candy', cssFilter: 'brightness(1.0999999999999999) saturate(1.37) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.pastel', version: 1, family: 'color', label: 'Pastel', cssFilter: 'brightness(0.94) saturate(1.5) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.dream', version: 1, family: 'mood', label: 'Dream', cssFilter: 'brightness(0.98) saturate(0.72) contrast(1.1) hue-rotate(28deg)', supportsLive: true },
  { canonicalId: 'effect.haze', version: 1, family: 'cinematic', label: 'Haze', cssFilter: 'brightness(1.02) saturate(0.85) contrast(1.18) hue-rotate(35deg)', supportsLive: true },
  { canonicalId: 'effect.film', version: 1, family: 'mono', label: 'Film', cssFilter: 'brightness(1.06) saturate(0.98) contrast(1.26) hue-rotate(42deg)', supportsLive: true },
  { canonicalId: 'effect.cinema', version: 1, family: 'retro', label: 'Cinema', cssFilter: 'brightness(1.0999999999999999) saturate(1.1099999999999999) contrast(0.86) hue-rotate(-35deg)', supportsLive: true },
  { canonicalId: 'effect.noir', version: 1, family: 'color', label: 'Noir', cssFilter: 'brightness(0.94) saturate(1.24) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.silver', version: 1, family: 'mood', label: 'Silver', cssFilter: 'brightness(0.98) saturate(1.37) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.mono_soft', version: 1, family: 'cinematic', label: 'Mono Soft', cssFilter: 'brightness(1.02) saturate(1.5) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.mono_crush', version: 1, family: 'mono', label: 'Mono Crush', cssFilter: 'brightness(1.06) saturate(0.72) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.fade', version: 1, family: 'retro', label: 'Fade', cssFilter: 'brightness(1.0999999999999999) saturate(0.85) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.vintage', version: 1, family: 'color', label: 'Vintage', cssFilter: 'brightness(0.94) saturate(0.98) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.70s', version: 1, family: 'mood', label: '70s', cssFilter: 'brightness(0.98) saturate(1.1099999999999999) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.80s', version: 1, family: 'cinematic', label: '80s', cssFilter: 'brightness(1.02) saturate(1.24) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.90s', version: 1, family: 'mono', label: '90s', cssFilter: 'brightness(1.06) saturate(1.37) contrast(1.1) hue-rotate(28deg)', supportsLive: true },
  { canonicalId: 'effect.polaroid', version: 1, family: 'retro', label: 'Polaroid', cssFilter: 'brightness(1.0999999999999999) saturate(1.5) contrast(1.18) hue-rotate(35deg)', supportsLive: true },
  { canonicalId: 'effect.faded_film', version: 1, family: 'color', label: 'Faded Film', cssFilter: 'brightness(0.94) saturate(0.72) contrast(1.26) hue-rotate(42deg)', supportsLive: true },
  { canonicalId: 'effect.copper', version: 1, family: 'mood', label: 'Copper', cssFilter: 'brightness(0.98) saturate(0.85) contrast(0.86) hue-rotate(-35deg)', supportsLive: true },
  { canonicalId: 'effect.amber', version: 1, family: 'cinematic', label: 'Amber', cssFilter: 'brightness(1.02) saturate(0.98) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.teal', version: 1, family: 'mono', label: 'Teal', cssFilter: 'brightness(1.06) saturate(1.1099999999999999) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.teal_orange', version: 1, family: 'retro', label: 'Teal Orange', cssFilter: 'brightness(1.0999999999999999) saturate(1.24) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.drama', version: 1, family: 'color', label: 'Drama', cssFilter: 'brightness(0.94) saturate(1.37) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.blockbuster', version: 1, family: 'mood', label: 'Blockbuster', cssFilter: 'brightness(0.98) saturate(1.5) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.matte', version: 1, family: 'cinematic', label: 'Matte', cssFilter: 'brightness(1.02) saturate(0.72) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.crisp', version: 1, family: 'mono', label: 'Crisp', cssFilter: 'brightness(1.06) saturate(0.85) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.studio', version: 1, family: 'retro', label: 'Studio', cssFilter: 'brightness(1.0999999999999999) saturate(0.98) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.portrait', version: 1, family: 'color', label: 'Portrait', cssFilter: 'brightness(0.94) saturate(1.1099999999999999) contrast(1.1) hue-rotate(28deg)', supportsLive: true },
  { canonicalId: 'effect.glow', version: 1, family: 'mood', label: 'Glow', cssFilter: 'brightness(0.98) saturate(1.24) contrast(1.18) hue-rotate(35deg)', supportsLive: true },
  { canonicalId: 'effect.soft_glow', version: 1, family: 'cinematic', label: 'Soft Glow', cssFilter: 'brightness(1.02) saturate(1.37) contrast(1.26) hue-rotate(42deg)', supportsLive: true },
  { canonicalId: 'effect.sun', version: 1, family: 'mono', label: 'Sun', cssFilter: 'brightness(1.06) saturate(1.5) contrast(0.86) hue-rotate(-35deg)', supportsLive: true },
  { canonicalId: 'effect.cloud', version: 1, family: 'retro', label: 'Cloud', cssFilter: 'brightness(1.0999999999999999) saturate(0.72) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.moon', version: 1, family: 'color', label: 'Moon', cssFilter: 'brightness(0.94) saturate(0.85) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.midnight', version: 1, family: 'mood', label: 'Midnight', cssFilter: 'brightness(0.98) saturate(0.98) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.storm', version: 1, family: 'cinematic', label: 'Storm', cssFilter: 'brightness(1.02) saturate(1.1099999999999999) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.urban', version: 1, family: 'mono', label: 'Urban', cssFilter: 'brightness(1.06) saturate(1.24) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.street', version: 1, family: 'retro', label: 'Street', cssFilter: 'brightness(1.0999999999999999) saturate(1.37) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.editorial', version: 1, family: 'color', label: 'Editorial', cssFilter: 'brightness(0.94) saturate(1.5) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.minimal', version: 1, family: 'mood', label: 'Minimal', cssFilter: 'brightness(0.98) saturate(0.72) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.natural', version: 1, family: 'cinematic', label: 'Natural', cssFilter: 'brightness(1.02) saturate(0.85) contrast(1.1) hue-rotate(28deg)', supportsLive: true },
  { canonicalId: 'effect.fresh', version: 1, family: 'mono', label: 'Fresh', cssFilter: 'brightness(1.06) saturate(0.98) contrast(1.18) hue-rotate(35deg)', supportsLive: true },
  { canonicalId: 'effect.leaf', version: 1, family: 'retro', label: 'Leaf', cssFilter: 'brightness(1.0999999999999999) saturate(1.1099999999999999) contrast(1.26) hue-rotate(42deg)', supportsLive: true },
  { canonicalId: 'effect.sky', version: 1, family: 'color', label: 'Sky', cssFilter: 'brightness(0.94) saturate(1.24) contrast(0.86) hue-rotate(-35deg)', supportsLive: true },
  { canonicalId: 'effect.chrome', version: 1, family: 'mood', label: 'Chrome', cssFilter: 'brightness(0.98) saturate(1.37) contrast(0.94) hue-rotate(-28deg)', supportsLive: true },
  { canonicalId: 'effect.graphite', version: 1, family: 'cinematic', label: 'Graphite', cssFilter: 'brightness(1.02) saturate(1.5) contrast(1.02) hue-rotate(-21deg)', supportsLive: true },
  { canonicalId: 'effect.ink', version: 1, family: 'mono', label: 'Ink', cssFilter: 'brightness(1.06) saturate(0.72) contrast(1.1) hue-rotate(-14deg)', supportsLive: true },
  { canonicalId: 'effect.peach', version: 1, family: 'retro', label: 'Peach', cssFilter: 'brightness(1.0999999999999999) saturate(0.85) contrast(1.18) hue-rotate(-7deg)', supportsLive: true },
  { canonicalId: 'effect.mint', version: 1, family: 'color', label: 'Mint', cssFilter: 'brightness(0.94) saturate(0.98) contrast(1.26) hue-rotate(0deg)', supportsLive: true },
  { canonicalId: 'effect.violet', version: 1, family: 'mood', label: 'Violet', cssFilter: 'brightness(0.98) saturate(1.1099999999999999) contrast(0.86) hue-rotate(7deg)', supportsLive: true },
  { canonicalId: 'effect.sapphire', version: 1, family: 'cinematic', label: 'Sapphire', cssFilter: 'brightness(1.02) saturate(1.24) contrast(0.94) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.crimson', version: 1, family: 'mono', label: 'Crimson', cssFilter: 'brightness(1.06) saturate(1.37) contrast(1.02) hue-rotate(21deg)', supportsLive: true },
  { canonicalId: 'effect.aurora', version: 1, family: 'color', label: 'Aurora', cssFilter: 'brightness(1.08) saturate(1.45) contrast(1.08) hue-rotate(52deg)', supportsLive: true },
  { canonicalId: 'effect.ember', version: 1, family: 'mood', label: 'Ember', cssFilter: 'brightness(0.96) saturate(1.62) contrast(1.14) hue-rotate(74deg)', supportsLive: true },
  { canonicalId: 'effect.coral', version: 1, family: 'cinematic', label: 'Coral', cssFilter: 'brightness(1.04) saturate(1.32) contrast(1.06) hue-rotate(92deg)', supportsLive: true },
  { canonicalId: 'effect.dune', version: 1, family: 'retro', label: 'Dune', cssFilter: 'brightness(1.10) saturate(0.82) contrast(0.98) hue-rotate(108deg)', supportsLive: true },
  { canonicalId: 'effect.sand', version: 1, family: 'color', label: 'Sand', cssFilter: 'brightness(1.05) saturate(0.68) contrast(1.02) hue-rotate(126deg)', supportsLive: true },
  { canonicalId: 'effect.ocean_deep', version: 1, family: 'mood', label: 'Ocean Deep', cssFilter: 'brightness(0.92) saturate(1.42) contrast(1.24) hue-rotate(144deg)', supportsLive: true },
  { canonicalId: 'effect.glacier', version: 1, family: 'cinematic', label: 'Glacier', cssFilter: 'brightness(1.10) saturate(1.08) contrast(1.16) hue-rotate(162deg)', supportsLive: true },
  { canonicalId: 'effect.sage', version: 1, family: 'mono', label: 'Sage', cssFilter: 'brightness(1.03) saturate(0.76) contrast(1.08) hue-rotate(180deg)', supportsLive: true },
  { canonicalId: 'effect.moss', version: 1, family: 'retro', label: 'Moss', cssFilter: 'brightness(0.98) saturate(1.18) contrast(1.12) hue-rotate(198deg)', supportsLive: true },
  { canonicalId: 'effect.plum', version: 1, family: 'color', label: 'Plum', cssFilter: 'brightness(0.95) saturate(1.36) contrast(1.20) hue-rotate(216deg)', supportsLive: true },
  { canonicalId: 'effect.berry', version: 1, family: 'mood', label: 'Berry', cssFilter: 'brightness(1.00) saturate(1.58) contrast(1.10) hue-rotate(234deg)', supportsLive: true },
  { canonicalId: 'effect.ruby', version: 1, family: 'cinematic', label: 'Ruby', cssFilter: 'brightness(0.97) saturate(1.66) contrast(1.18) hue-rotate(252deg)', supportsLive: true },
  { canonicalId: 'effect.opal', version: 1, family: 'mono', label: 'Opal', cssFilter: 'brightness(1.12) saturate(0.66) contrast(0.98) hue-rotate(270deg)', supportsLive: true },
  { canonicalId: 'effect.pearl', version: 1, family: 'retro', label: 'Pearl', cssFilter: 'brightness(1.14) saturate(0.58) contrast(0.92) hue-rotate(288deg)', supportsLive: true },
  { canonicalId: 'effect.obsidian', version: 1, family: 'color', label: 'Obsidian', cssFilter: 'brightness(0.86) saturate(0.92) contrast(1.38) hue-rotate(306deg)', supportsLive: true },
  { canonicalId: 'effect.tungsten', version: 1, family: 'mood', label: 'Tungsten', cssFilter: 'brightness(0.91) saturate(0.84) contrast(1.30) hue-rotate(324deg)', supportsLive: true },
  { canonicalId: 'effect.sepia', version: 1, family: 'cinematic', label: 'Sepia', cssFilter: 'brightness(1.02) saturate(0.56) contrast(1.12) sepia(0.62)', supportsLive: true },
  { canonicalId: 'effect.cyan', version: 1, family: 'mono', label: 'Cyan', cssFilter: 'brightness(1.04) saturate(1.40) contrast(1.06) hue-rotate(342deg)', supportsLive: true },
  { canonicalId: 'effect.magenta', version: 1, family: 'retro', label: 'Magenta', cssFilter: 'brightness(1.01) saturate(1.60) contrast(1.12) hue-rotate(354deg)', supportsLive: true },
  { canonicalId: 'effect.infrared', version: 1, family: 'color', label: 'Infrared', cssFilter: 'brightness(1.08) saturate(1.72) contrast(1.28) hue-rotate(14deg)', supportsLive: true },
  { canonicalId: 'effect.dusk', version: 1, family: 'mood', label: 'Dusk', cssFilter: 'brightness(0.90) saturate(1.06) contrast(1.22) hue-rotate(38deg)', supportsLive: true },
  { canonicalId: 'effect.dawn', version: 1, family: 'cinematic', label: 'Dawn', cssFilter: 'brightness(1.12) saturate(1.08) contrast(1.04) hue-rotate(62deg)', supportsLive: true },
  { canonicalId: 'effect.haze_gold', version: 1, family: 'mono', label: 'Haze Gold', cssFilter: 'brightness(1.08) saturate(0.76) contrast(1.02) sepia(0.18) hue-rotate(86deg)', supportsLive: true },
  { canonicalId: 'effect.studio_cool', version: 1, family: 'retro', label: 'Studio Cool', cssFilter: 'brightness(1.04) saturate(0.92) contrast(1.18) hue-rotate(110deg)', supportsLive: true },
  { canonicalId: 'effect.studio_warm', version: 1, family: 'color', label: 'Studio Warm', cssFilter: 'brightness(1.06) saturate(1.20) contrast(1.10) sepia(0.12) hue-rotate(134deg)', supportsLive: true },
  { canonicalId: 'effect.analog', version: 1, family: 'mood', label: 'Analog', cssFilter: 'brightness(0.96) saturate(0.88) contrast(1.18) sepia(0.22) hue-rotate(158deg)', supportsLive: true },
  { canonicalId: 'effect.bleach', version: 1, family: 'cinematic', label: 'Bleach', cssFilter: 'brightness(1.10) saturate(0.54) contrast(1.34) hue-rotate(182deg)', supportsLive: true },
  { canonicalId: 'effect.cross_process', version: 1, family: 'mono', label: 'Cross Process', cssFilter: 'brightness(1.02) saturate(1.50) contrast(1.28) hue-rotate(206deg)', supportsLive: true },
  { canonicalId: 'effect.pastel_dream', version: 1, family: 'retro', label: 'Pastel Dream', cssFilter: 'brightness(1.10) saturate(0.74) contrast(0.88) hue-rotate(230deg)', supportsLive: true },
  { canonicalId: 'effect.night_drive', version: 1, family: 'color', label: 'Night Drive', cssFilter: 'brightness(0.80) saturate(1.32) contrast(1.30) hue-rotate(254deg)', supportsLive: true },
  { canonicalId: 'effect.city_lights', version: 1, family: 'mood', label: 'City Lights', cssFilter: 'brightness(1.00) saturate(1.55) contrast(1.24) hue-rotate(278deg)', supportsLive: true },
  { canonicalId: 'effect.sun_kissed', version: 1, family: 'cinematic', label: 'Sun Kissed', cssFilter: 'brightness(1.12) saturate(1.22) contrast(1.06) sepia(0.10) hue-rotate(302deg)', supportsLive: true },
]);
const IDS=new Set(LIVE_FILTER_REGISTRY.map((filter)=>filter.canonicalId));
if(IDS.size!==LIVE_FILTER_REGISTRY.length) throw new Error('Duplicate live filter canonicalId.');
if(LIVE_FILTER_REGISTRY.length<100) throw new Error('Filter Mask requires at least 100 live filters.');
export const getLiveFilter=(canonicalId:string)=>LIVE_FILTER_REGISTRY.find((filter)=>filter.canonicalId===canonicalId);

export type LiveFilterFamily = LiveFilterDefinition['family'];

export const LIVE_FILTER_FAMILIES: readonly LiveFilterFamily[] = Object.freeze(
  Array.from(new Set(LIVE_FILTER_REGISTRY.map((filter) => filter.family))) as LiveFilterFamily[],
);

const normalizeFilterQuery = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\\p{L}\\p{N}\\s-]/gu, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

const GENERIC_FILTER_TERMS = new Set([
  'live', 'filter', 'filters', 'camera',
  'فلتر', 'فلاتر', 'مباشر', 'الكاميرا',
]);

const scoreLiveFilter = (query: string, filter: LiveFilterDefinition): number => {
  const normalized = normalizeFilterQuery(query);
  const target = normalizeFilterQuery(`${filter.canonicalId} ${filter.label} ${filter.family}`);
  if (!normalized) return 0;
  if (target === normalized) return 100;
  if (normalizeFilterQuery(filter.canonicalId) === normalized) return 100;
  if (normalizeFilterQuery(filter.label) === normalized) return 100;

  const tokens = normalized.split(' ').filter((token) => token && !GENERIC_FILTER_TERMS.has(token));
  if (tokens.length === 0) return 1;
  const hits = tokens.filter((token) => target.includes(token)).length;
  return hits === tokens.length ? 50 + hits : hits;
};

export const findLiveFilters = (query: string): readonly LiveFilterDefinition[] => {
  const normalized = normalizeFilterQuery(query);
  if (!normalized) return LIVE_FILTER_REGISTRY;
  return [...LIVE_FILTER_REGISTRY]
    .map((filter) => ({ filter, score: scoreLiveFilter(normalized, filter) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.filter.canonicalId.localeCompare(b.filter.canonicalId))
    .map(({ filter }) => filter);
};

export const resolveLiveFilter = (query: string): LiveFilterDefinition | undefined =>
  findLiveFilters(query)[0];
