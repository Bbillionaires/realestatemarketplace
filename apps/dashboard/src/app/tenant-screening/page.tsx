'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ConversationSummary, TenantScreeningSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { formatDateTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const STATUS_LABEL: Record<string, string> = {
  AWAITING_TENANT_AUTHORIZATION: 'Needs your payment & authorization',
  PAID: 'Paid — being submitted for screening',
  SUBMITTED_EXTERNALLY: 'Submitted — awaiting results',
  COMPLETE: 'Complete',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export default function TenantScreeningPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [screenings, setScreenings] = useState<TenantScreeningSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareTargets, setShareTargets] = useState<Record<string, string>>({});

  const refresh = async () => {
    if (!accessToken) return;
    const [rows, convos] = await Promise.all([api.listMyTenantScreenings(accessToken), api.listConversations(accessToken)]);
    setScreenings(rows);
    setConversations(convos);
  };

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your screenings'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isLoading, router]);

  async function onGetPortableScreening() {
    if (!accessToken) return;
    setBusyId('new');
    setError(null);
    try {
      const screening = await api.createMyTenantScreening(accessToken);
      if (screening.checkoutUrl) {
        window.location.href = screening.checkoutUrl;
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setBusyId(null);
    }
  }

  async function onPay(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const screening = await api.payTenantScreening(accessToken, id);
      if (screening.checkoutUrl) {
        window.location.href = screening.checkoutUrl;
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await api.declineTenantScreening(accessToken, id);
      setScreenings((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline this screening');
    } finally {
      setBusyId(null);
    }
  }

  function onDownload(id: string) {
    if (!accessToken) return;
    api.downloadTenantScreening(accessToken, id).catch((err) => setError(err instanceof Error ? err.message : 'Failed to download'));
  }

  async function onShare(id: string) {
    if (!accessToken) return;
    const conversationId = shareTargets[id];
    if (!conversationId) return;
    setBusyId(id);
    setError(null);
    try {
      await api.shareTenantScreening(accessToken, id, conversationId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share this screening');
    } finally {
      setBusyId(null);
    }
  }

  const isExpired = (s: TenantScreeningSummary) => !!s.expiresAt && new Date(s.expiresAt) < new Date();

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Tenant Screening</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          A background and eviction check, run manually by our team through a third-party screening provider. A
          portable screening costs $50, is valid for 30 days once complete, and can be shared with any landlord you
          choose — you never have to pay for the same screening twice.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {!loading && (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <button
              onClick={onGetPortableScreening}
              disabled={busyId === 'new'}
              style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              {busyId === 'new' ? 'Starting checkout...' : 'Get a portable screening ($50)'}
            </button>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gap: 10 }}>
            {screenings.map((s) => {
              if (!s.id) return null;
              const expired = isExpired(s);
              return (
                <div
                  key={s.id}
                  style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '14px 18px' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                    {s.kind === 'PORTABLE' ? 'Portable screening' : 'Screening for one landlord'}
                    {s.initiatedById && s.status === 'AWAITING_TENANT_AUTHORIZATION' ? ' · requested by a landlord' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    {s.status ? STATUS_LABEL[s.status] : ''}
                    {s.status === 'COMPLETE' && s.expiresAt ? ` · ${expired ? 'expired' : `valid until ${formatDateTime(s.expiresAt)}`}` : ''}
                    {s.createdAt ? ` · started ${formatDateTime(s.createdAt)}` : ''}
                  </div>

                  {s.status === 'AWAITING_TENANT_AUTHORIZATION' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => onPay(s.id!)}
                        disabled={busyId === s.id}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: theme.primary, color: 'white', fontSize: 12, cursor: 'pointer' }}
                      >
                        Pay & authorize ($50)
                      </button>
                      <button
                        onClick={() => onDecline(s.id!)}
                        disabled={busyId === s.id}
                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', fontSize: 12, cursor: 'pointer' }}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {s.status === 'COMPLETE' && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => onDownload(s.id!)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', fontSize: 12, cursor: 'pointer' }}
                      >
                        View my result
                      </button>
                      {s.kind === 'PORTABLE' && !expired && conversations.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                          <select
                            value={shareTargets[s.id] ?? ''}
                            onChange={(e) => setShareTargets((prev) => ({ ...prev, [s.id!]: e.target.value }))}
                            style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
                          >
                            <option value="">Share with a conversation...</option>
                            {conversations.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.property.title} — {c.landlordDisplayName}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => onShare(s.id!)}
                            disabled={busyId === s.id || !shareTargets[s.id]}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: theme.primary, color: 'white', fontSize: 12, cursor: 'pointer' }}
                          >
                            Share
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {screenings.length === 0 && <p style={{ color: theme.textMuted }}>You have no tenant screenings yet.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
