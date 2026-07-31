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

/** CORS `origin` callback: allows any origin in the list, rejects everything else. */
export function corsOriginValidator(allowedOrigins: string[]) {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header at all (server-to-server calls, curl, health checks) — allow.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}
