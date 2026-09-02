'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, TenantScreeningAdminSummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatDateTime } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

const STATUS_LABEL: Record<string, string> = {
  AWAITING_TENANT_AUTHORIZATION: 'Awaiting tenant payment',
  PAID: 'Paid — ready to submit externally',
  SUBMITTED_EXTERNALLY: 'Submitted — awaiting result',
  COMPLETE: 'Complete',
  DECLINED: 'Declined by tenant',
  CANCELLED: 'Cancelled',
};

export default function AdminTenantScreeningsPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [screenings, setScreenings] = useState<TenantScreeningAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const refresh = async () => {
    if (!accessToken) return;
    const rows = await api.listAdminTenantScreenings(accessToken);
    setScreenings(rows);
  };

  useEffect(() => {
    if (!accessToken || !user || !STAFF_ROLES.includes(user.role)) return;
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user]);

  async function onMarkSubmitted(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await api.markScreeningSubmittedExternally(accessToken, id);
      setScreenings((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as submitted');
    } finally {
      setBusyId(null);
    }
  }

  async function onUploadResult(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await api.uploadScreeningResult(accessToken, id, file, notesById[id]);
      setScreenings((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload the result');
    } finally {
      setBusyId(null);
      e.target.value = '';
    }
  }

  async function onCancel(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await api.cancelTenantScreening(accessToken, id);
      setScreenings((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel this screening');
    } finally {
      setBusyId(null);
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

  const NON_TERMINAL = ['AWAITING_TENANT_AUTHORIZATION', 'PAID', 'SUBMITTED_EXTERNALLY'];

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Tenant Screening Requests</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Once a screening is paid, submit the tenant's info to the external screening platform, then upload the
          result here once it comes back.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 10 }}>
            {screenings.map((s) => (
              <div
                key={s.id}
                style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '14px 18px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                      {s.tenantDisplayName ?? s.tenantEmail} · {s.kind}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {s.tenantEmail} · {STATUS_LABEL[s.status] ?? s.status} · started {formatDateTime(s.createdAt)}
                    </div>
                    {s.initiatedByEmail && (
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>requested by {s.initiatedByEmail}</div>
                    )}
                    {s.resultFileName && (
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        result: {s.resultFileName} · uploaded {s.resultUploadedAt ? formatDateTime(s.resultUploadedAt) : ''}
                      </div>
                    )}
                  </div>
                </div>

                {s.status === 'PAID' && (
                  <button
                    onClick={() => onMarkSubmitted(s.id)}
                    disabled={busyId === s.id}
                    style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', fontSize: 12, cursor: 'pointer' }}
                  >
                    Mark submitted externally
                  </button>
                )}

                {(s.status === 'PAID' || s.status === 'SUBMITTED_EXTERNALLY') && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Staff notes (optional)"
                      value={notesById[s.id] ?? ''}
                      onChange={(e) => setNotesById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
                    />
                    <label
                      style={{
                        display: 'inline-block',
                        width: 'fit-content',
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1px solid ${theme.primary}`,
                        color: theme.primary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {busyId === s.id ? 'Uploading...' : 'Upload result'}
                      <input type="file" onChange={(e) => onUploadResult(s.id, e)} disabled={busyId === s.id} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}

                {NON_TERMINAL.includes(s.status) && (
                  <button
                    onClick={() => onCancel(s.id)}
                    disabled={busyId === s.id}
                    style={{ marginTop: 10, marginLeft: 8, padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.danger}`, color: theme.danger, background: 'white', fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
            {screenings.length === 0 && <p style={{ color: theme.textMuted }}>No tenant screenings yet.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
