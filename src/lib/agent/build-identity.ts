declare const __FLIXO_BUILD_SHA__: string | undefined;

export const FLIXO_BUILD_SHA = (() => {
  const value = typeof __FLIXO_BUILD_SHA__ === 'string' ? __FLIXO_BUILD_SHA__.trim() : '';
  return /^[a-f0-9]{40}$/u.test(value) ? value : null;
})();

export function requireFlixoBuildSha(): string {
  if (!FLIXO_BUILD_SHA) throw new Error('FLIXO_BUILD_SHA_UNAVAILABLE');
  return FLIXO_BUILD_SHA;
}
