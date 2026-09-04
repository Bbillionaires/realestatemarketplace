'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTokens, setTokens as persistTokens, subscribeToTokens, StoredTokens } from './token-store';

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
  setTokens: (tokens: StoredTokens | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer runs synchronously during the first render (before any
  // effects), so tokens are already correct by the time a page's own effect
  // checks them.
  const [tokens, setTokensState] = useState<StoredTokens | null>(getTokens);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
    // api.ts can refresh and replace tokens (or clear them, if the refresh
    // token itself is no longer valid) outside of any component's own
    // setTokens() call — subscribing keeps this provider's state in sync
    // with that instead of going stale until the next full page load.
    return subscribeToTokens(setTokensState);
  }, []);

  const value = useMemo(
    () => ({
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      isLoading,
      setTokens: persistTokens,
    }),
    [tokens, isLoading],
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
