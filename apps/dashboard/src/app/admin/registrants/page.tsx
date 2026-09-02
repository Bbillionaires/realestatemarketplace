'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, RegistrantOverviewRow } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatDateTime } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];
const PAGE_SIZE = 50;

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export default function AdminRegistrantsPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [rows, setRows] = useState<RegistrantOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!accessToken || !user || !STAFF_ROLES.includes(user.role)) return;
    api
      .listRegistrantOverview(accessToken, 0, PAGE_SIZE)
      .then((data) => {
        setRows(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  async function onLoadMore() {
    if (!accessToken) return;
    setLoadingMore(true);
    try {
      const more = await api.listRegistrantOverview(accessToken, rows.length, PAGE_SIZE);
      setRows((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  if (userLoading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user || !STAFF_ROLES.includes(user.role)) {
    router.push('/properties');
    return null;
  }

  const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: theme.textMuted, borderBottom: `1px solid ${theme.border}` };
  const td: CSSProperties = { padding: '8px 10px', fontSize: 13, color: theme.text, borderBottom: `1px solid ${theme.border}` };

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Registrant Overview</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Every registered account and where they are in the process: Tenant Packet, Housing Voucher, ID submitted to
          a landlord, Homeownership Tracker enrollment, and the latest Tenant Screening.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}

        {!loading && !error && (
          <>
            <div style={{ overflowX: 'auto', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Registrant</th>
                    <th style={th}>Role</th>
                    <th style={th}>Tenant Packet</th>
                    <th style={th}>Voucher uploaded</th>
                    <th style={th}>ID submitted</th>
                    <th style={th}>Homeownership</th>
                    <th style={th}>Latest screening</th>
                    <th style={th}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.displayName ?? r.email}</div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>{r.email}</div>
                      </td>
                      <td style={td}>{r.role}</td>
                      <td style={td}>{r.tenantPacketStatus ?? '—'}</td>
                      <td style={td}>{yesNo(r.hasVoucherUpload)}</td>
                      <td style={td}>{yesNo(r.hasSubmittedId)}</td>
                      <td style={td}>{yesNo(r.homeownershipEnrolled)}</td>
                      <td style={td}>{r.latestScreening ? `${r.latestScreening.kind} · ${r.latestScreening.status}` : '—'}</td>
                      <td style={td}>{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td style={td} colSpan={8}>
                        No registrants found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                style={{ marginTop: 16, padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
