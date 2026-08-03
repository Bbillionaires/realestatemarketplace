'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LenderAssignment, LenderRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

function AssignmentCard({ assignment, accessToken }: { assignment: LenderAssignment; accessToken: string }) {
  const [requests, setRequests] = useState<LenderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listLenderRequestsForAssignment(accessToken, assignment.id)
      .then(setRequests)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [accessToken, assignment.id]);

  async function sendRequest() {
    setSending(true);
    setError(null);
    try {
      const created = await api.createLenderRequest(accessToken, assignment.id, message || undefined);
      setRequests((prev) => [created, ...prev]);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSending(false);
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
        <h3 style={{ margin: 0, fontSize: 16, color: theme.text }}>{assignment.propertyTitle}</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.primaryDark, background: theme.primaryLight, padding: '3px 8px', borderRadius: 999 }}>
          {assignment.accessTier}
        </span>
      </div>
      <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 14 }}>
        Tenant: {assignment.tenantDisplayName ?? 'Not set yet — ask an admin to assign one'}
      </p>

      {assignment.tenantDisplayName && (
        <div style={{ marginBottom: 14 }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional note, e.g. what proof you need and why"
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}
          <button
            onClick={sendRequest}
            disabled={sending}
            style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {sending ? 'Sending...' : 'Request payment proof'}
          </button>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 6 }}>REQUEST HISTORY</div>
        {loading && <p style={{ fontSize: 13, color: theme.textMuted }}>Loading...</p>}
        {!loading && requests.length === 0 && <p style={{ fontSize: 13, color: theme.textMuted }}>No requests sent yet.</p>}
        {!loading &&
          requests.map((r) => (
            <div key={r.id} style={{ fontSize: 13, padding: '8px 0', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.textMuted }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: r.status === 'FULFILLED' ? theme.success : r.status === 'DECLINED' ? theme.danger : theme.warningText,
                  }}
                >
                  {r.status}
                </span>
              </div>
              {r.message && <div style={{ marginTop: 2 }}>{r.message}</div>}
              {r.status === 'FULFILLED' && (
                <div style={{ color: theme.textMuted, marginTop: 2 }}>
                  {r.responseFileName ? `File "${r.responseFileName}" ` : ''}
                  {r.responseNote ? `Note: "${r.responseNote}" ` : ''}
                  sent to your email{r.emailSent ? '' : ' (delivery pending)'}.
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

export default function LenderDashboardPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [assignments, setAssignments] = useState<LenderAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user || user.role !== 'LENDER') return;
    api
      .listMyLenderAssignments(accessToken)
      .then(setAssignments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  if (userLoading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user || user.role !== 'LENDER') {
    router.push('/properties');
    return null;
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Lender Dashboard</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Properties assigned to you by an administrator. Request payment proof from the current tenant — nothing is
          shared unless the tenant chooses to respond.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && accessToken && (
          <>
            {assignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} accessToken={accessToken} />
            ))}
            {assignments.length === 0 && <p style={{ color: theme.textMuted }}>No properties assigned yet.</p>}
          </>
        )}
      </div>
    </main>
  );
}
