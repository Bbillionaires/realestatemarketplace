/**
 * Single source of truth for the stored access/refresh token pair, usable
 * from both React (auth-context.tsx) and plain modules (api.ts) — api.ts
 * needs to read/replace tokens on a silent refresh without depending on
 * React, and auth-context subscribes here so its state stays in sync with
 * refreshes that happen outside any component's own setTokens() call.
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'relay_platform_tokens';
type Listener = (tokens: StoredTokens | null) => void;
const listeners = new Set<Listener>();

export function getTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

export function setTokens(tokens: StoredTokens | null): void {
  if (typeof window === 'undefined') return;
  if (tokens) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener(tokens));
}

export function subscribeToTokens(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
