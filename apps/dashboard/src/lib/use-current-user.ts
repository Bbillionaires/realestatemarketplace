'use client';

import { useEffect, useState } from 'react';
import { api, CurrentUser } from './api';
import { useAuth } from './auth-context';

export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      return;
    }
    api
      .me(accessToken)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [accessToken, authLoading]);

  return { user, loading };
}
