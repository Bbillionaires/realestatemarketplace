'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, WaitlistEntry } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

export default function WaitlistsPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listMyWaitlists(accessToken)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your waiting lists'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  async function leave(propertyId: string) {
    if (!accessToken) return;
    setLeavingId(propertyId);
    try {
      await api.leaveWaitlist(accessToken, propertyId);
      setEntries((prev) => prev.filter((e) => e.propertyId !== propertyId));
    } catch {
      // Leave the entry in place; the user can retry.
    } finally {
      setLeavingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Waiting Lists</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Properties you've joined a waiting list for. The landlord reviews the queue in the order tenants joined.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}

        {!loading && !error && (
          <div style={{ display: 'grid', gap: 12 }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <Link
                      href={`/properties/${entry.property?.id}`}
                      style={{ fontWeight: 700, fontSize: 15, color: theme.primary, textDecoration: 'none' }}
                    >
                      {entry.property?.title}
                    </Link>
                    <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                      {entry.property?.addressLine1}, {entry.property?.city}, {entry.property?.state}
                    </div>
                    {entry.note && <div style={{ fontSize: 13, color: theme.text, marginTop: 6 }}>{entry.note}</div>}
                  </div>
                  <button
                    onClick={() => entry.propertyId && leave(entry.propertyId)}
                    disabled={leavingId === entry.propertyId}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                      background: 'white',
                      fontSize: 13,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {leavingId === entry.propertyId ? 'Leaving...' : 'Leave'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p style={{ color: theme.textMuted }}>You haven't joined any waiting lists yet.</p>
        )}
      </div>
    </main>
  );
}
