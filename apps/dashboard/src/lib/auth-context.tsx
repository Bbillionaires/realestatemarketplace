'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string } | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = 'relay_platform_tokens';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setAccessToken(parsed.accessToken);
      setRefreshToken(parsed.refreshToken);
    }
  }, []);

  const setTokens = (tokens: { accessToken: string; refreshToken: string } | null) => {
    if (tokens) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      setAccessToken(null);
      setRefreshToken(null);
    }
  };

  const value = useMemo(() => ({ accessToken, refreshToken, setTokens }), [accessToken, refreshToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
