'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /**
   * True until the initial synchronous read of localStorage has happened.
   * Pages must wait for this before deciding "no token -> redirect to
   * login", otherwise a full page load (not client-side navigation) can
   * bounce a signed-in user to /login: on first mount React fires child
   * effects before parent effects, so a page's own useEffect would
   * otherwise run its redirect check before this provider's state settles.
   */
  isLoading: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string } | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = 'relay_platform_tokens';

function readStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { accessToken: null, refreshToken: null };
  }
  const parsed = JSON.parse(stored);
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer runs synchronously during the first render (before any
  // effects), so accessToken is already correct by the time a page's own
  // effect checks it.
  const [{ accessToken, refreshToken }, setState] = useState(readStoredTokens);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const setTokens = (tokens: { accessToken: string; refreshToken: string } | null) => {
    if (tokens) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      setState(tokens);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      setState({ accessToken: null, refreshToken: null });
    }
  };

  const value = useMemo(
    () => ({ accessToken, refreshToken, isLoading, setTokens }),
    [accessToken, refreshToken, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
