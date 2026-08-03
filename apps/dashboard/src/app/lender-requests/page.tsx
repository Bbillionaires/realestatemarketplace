'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LenderRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

function RequestCard({ request, accessToken, onUpdated }: { request: LenderRequest; accessToken: string; onUpdated: (r: LenderRequest) => void }) {
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.submitLenderRequest(accessToken, request.id, note || undefined, file ?? undefined);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.declineLenderRequest(accessToken, request.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: theme.text }}>{request.propertyTitle}</h3>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: request.status === 'FULFILLED' ? theme.success : request.status === 'DECLINED' ? theme.danger : theme.warningText,
          }}
        >
          {request.status}
        </span>
      </div>
      {request.message && <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>"{request.message}"</p>}
      <p style={{ fontSize: 12, color: theme.textMuted }}>
        Requested {new Date(request.createdAt).toLocaleDateString()}
      </p>

      {request.status === 'PENDING' && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 0 }}>
            You can choose to share proof of payment or income directly with this lender, or decline. Nothing is
            stored on the platform — your file is forwarded straight to the lender by email.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ marginBottom: 10, fontSize: 13 }}
          />
          {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={submit}
              disabled={busy || (!note && !file)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {busy ? 'Submitting...' : 'Submit'}
            </button>
            <button
              onClick={decline}
              disabled={busy}
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LenderRequestsPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [requests, setRequests] = useState<LenderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user || !TENANT_ROLES.includes(user.role)) return;
    api
      .listMyLenderRequests(accessToken)
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  function handleUpdated(updated: LenderRequest) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  if (userLoading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user || !TENANT_ROLES.includes(user.role)) {
    router.push('/properties');
    return null;
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Lender Requests</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          A lender assigned to your property may ask you to share proof of payment or income for refinancing or
          underwriting purposes. Sharing is always your choice.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && accessToken && (
          <>
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} accessToken={accessToken} onUpdated={handleUpdated} />
            ))}
            {requests.length === 0 && <p style={{ color: theme.textMuted }}>No lender requests right now.</p>}
          </>
        )}
      </div>
    </main>
  );
}
