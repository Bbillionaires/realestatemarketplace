/**
 * DASHBOARD_BASE_URL may list more than one allowed origin, comma-separated —
 * a Vercel project always has multiple valid domains pointing at the same
 * deployment (the short alias, the team-scoped alias, a later custom
 * domain), and a hardcoded single origin breaks CORS for every one but the
 * first that gets configured.
 */
export function parseAllowedOrigins(raw: string | undefined, fallback: string): string[] {
  const value = raw ?? fallback;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * CORS `origin` callback: allows any origin in the list, rejects everything
 * else. Rejection is signaled as `callback(null, false)` — the `cors`
 * package's own convention for "just omit the CORS headers" — never
 * `callback(new Error(...))`. Passing an Error here makes it propagate as an
 * unhandled exception with no matching filter, which surfaces to every
 * caller (allowed origins included, since this callback can't tell "allowed"
 * apart from "erroring" once the request already blew up upstream) as an
 * opaque 500 instead of an ordinary same-origin-policy rejection the browser
 * already knows how to report.
 */
export function corsOriginValidator(allowedOrigins: string[]) {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header at all (server-to-server calls, curl, health checks) — allow.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
