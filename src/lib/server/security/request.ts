/** Request-derived metadata helpers. */
export function getClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || null;
}
export function getCountry(request: Request): string | null {
  const value = request.headers.get('x-vercel-ip-country');
  return value?.trim() || null;
}
export function getDevice(request: Request): string | null {
  const ua = request.headers.get('user-agent');
  if (!ua) return null;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}
export function getReferrer(request: Request): string | null {
  const ref = request.headers.get('referer');
  if (!ref) return null;
  try { return new URL(ref).host || null; } catch { return null; }
}
