import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

const redisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = redisConfigured ? Redis.fromEnv() : null;
const ipLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "flixo:agent-editor:ip",
      ephemeralCache: new Map(),
    })
  : null;

const userLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "flixo:agent-editor:user",
      ephemeralCache: new Map(),
    })
  : null;

const TRUSTED_IP_HEADER =
  process.env.FLIXO_TRUSTED_IP_HEADER === "cf-connecting-ip"
    ? "cf-connecting-ip"
    : "x-vercel-forwarded-for";

function getClientIp(request: NextRequest): string {
  const edgeIp = request.headers.get(TRUSTED_IP_HEADER)?.trim();
  if (edgeIp) return edgeIp.split(",")[0]?.trim() || "unknown";
  const fallback = request.headers.get("cf-connecting-ip")?.trim();
  if (fallback) return fallback;
  return "unknown";
}

async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function denyResponse(status: number, error: string, retryAfter?: number): NextResponse {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (retryAfter !== undefined) {
    response.headers.set("Retry-After", String(Math.max(1, Math.ceil(retryAfter))));
  }
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!request.nextUrl.pathname.startsWith("/api/chat")) {
    return NextResponse.next();
  }

  const failClosed = process.env.FLIXO_RATE_LIMIT_FAIL_CLOSED !== "false";
  if (!redisConfigured) {
    if (process.env.NODE_ENV === "production" && failClosed) {
      return denyResponse(503, "RATE_LIMIT_UNAVAILABLE");
    }
    return NextResponse.next();
  }

  const anonymousCookie = request.cookies.get("flixo_anon_id")?.value;
  const anonymousId = anonymousCookie || crypto.randomUUID();
  const [ipHash, userHash] = await Promise.all([
    hashIdentifier(getClientIp(request)),
    hashIdentifier(anonymousId),
  ]);

  let ipResult: Awaited<ReturnType<NonNullable<typeof ipLimiter>["limit"]>>;
  let userResult: Awaited<ReturnType<NonNullable<typeof userLimiter>["limit"]>>;

  try {
    [ipResult, userResult] = await Promise.all([
      ipLimiter!.limit(ipHash),
      userLimiter!.limit(userHash),
    ]);
  } catch {
    if (process.env.NODE_ENV === "production" && failClosed) {
      return denyResponse(503, "RATE_LIMIT_UNAVAILABLE");
    }
    return NextResponse.next();
  }

  if (!ipResult.success || !userResult.success) {
    const reset = Math.max(ipResult.reset, userResult.reset);
    return denyResponse(
      429,
      "RATE_LIMITED",
      Math.max(1, (reset - Date.now()) / 1000),
    );
  }

  const response = NextResponse.next();
  if (!anonymousCookie) {
    response.cookies.set("flixo_anon_id", anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  response.headers.set("X-RateLimit-Limit", String(Math.min(ipResult.limit, userResult.limit)));
  response.headers.set(
    "X-RateLimit-Remaining",
    String(Math.min(ipResult.remaining, userResult.remaining)),
  );
  return response;
}

export const config = {
  matcher: ["/api/chat"],
};
