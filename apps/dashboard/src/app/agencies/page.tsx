'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, AgencySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

export default function AgenciesPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [agencies, setAgencies] = useState<AgencySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listAgencies(accessToken)
      .then(setAgencies)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agencies'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Agencies</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Property management companies actively managing listings on Affordable Home Match. This platform doesn't
          have a separate agency account type today — these are property manager accounts with at least one
          active listing assignment.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}

        {!loading && !error && (
          <div style={{ display: 'grid', gap: 12 }}>
            {agencies.map((agency) => (
              <div
                key={agency.id}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{agency.displayName}</span>
                <span style={{ fontSize: 13, color: theme.textMuted }}>
                  {agency.managedPropertyCount} {agency.managedPropertyCount === 1 ? 'property' : 'properties'}
                </span>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && agencies.length === 0 && (
          <p style={{ color: theme.textMuted }}>No property management companies are active on the platform yet.</p>
        )}
      </div>
    </main>
  );
}
