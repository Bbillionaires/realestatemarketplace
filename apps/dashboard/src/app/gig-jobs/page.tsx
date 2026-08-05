'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  ConversationSummary,
  GigJob,
  GigVoucher,
  PropertySummary,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { formatMoney } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];
const OWN_TENANT_POSTER_ROLES = ['LANDLORD', 'PROPERTY_MANAGER'];
const ADMIN_ROLES = ['ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  CLAIMED: 'Claimed',
  COMPLETED: 'Marked complete — awaiting confirmation',
  CONFIRMED: 'Paid — voucher issued',
  CANCELLED: 'Cancelled',
};

function dollarsToCents(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export default function GigJobsPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();

  const [jobs, setJobs] = useState<GigJob[]>([]);
  const [postedJobs, setPostedJobs] = useState<GigJob[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [myVouchers, setMyVouchers] = useState<GigVoucher[]>([]);
  const [issuedVouchers, setIssuedVouchers] = useState<GigVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConversation, setSelectedConversation] = useState<Record<string, string>>({});
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [payout, setPayout] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const isTenant = !!user && TENANT_ROLES.includes(user.role);
  const isOwnTenantPoster = !!user && OWN_TENANT_POSTER_ROLES.includes(user.role);
  const isAdminPoster = !!user && ADMIN_ROLES.includes(user.role);
  const isPoster = isOwnTenantPoster || isAdminPoster;

  async function refresh() {
    if (!accessToken || !user) return;
    const loaders: Promise<unknown>[] = [];
    if (isTenant) {
      loaders.push(api.listGigJobs(accessToken).then(setJobs));
      loaders.push(api.listConversations(accessToken).then(setConversations));
      loaders.push(api.listMyGigVouchers(accessToken).then(setMyVouchers));
    }
    if (isPoster) {
      loaders.push(api.listPostedGigJobs(accessToken).then(setPostedJobs));
      loaders.push(api.listIssuedGigVouchers(accessToken).then(setIssuedVouchers));
    }
    if (isOwnTenantPoster) {
      loaders.push(api.listProperties(accessToken).then(setProperties));
    }
    await Promise.all(loaders);
  }

  useEffect(() => {
    if (userLoading) return;
    setLoading(true);
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load gig jobs'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user, userLoading]);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setPosting(true);
    setPostError(null);
    try {
      await api.createGigJob(accessToken, {
        title,
        description,
        payoutCents: dollarsToCents(payout),
        propertyId: propertyId || undefined,
      });
      setTitle('');
      setDescription('');
      setPayout('');
      setPropertyId('');
      await refresh();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post gig job');
    } finally {
      setPosting(false);
    }
  }

  async function handleClaim(jobId: string) {
    if (!accessToken) return;
    const conversationId = selectedConversation[jobId];
    if (!conversationId) return;
    setBusyJobId(jobId);
    try {
      await api.claimGigJob(accessToken, jobId, conversationId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim gig job');
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleComplete(jobId: string) {
    if (!accessToken) return;
    setBusyJobId(jobId);
    try {
      await api.completeGigJob(accessToken, jobId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleRejectCompletion(jobId: string) {
    if (!accessToken) return;
    setBusyJobId(jobId);
    try {
      await api.rejectGigJobCompletion(accessToken, jobId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject completion');
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleCancel(jobId: string) {
    if (!accessToken) return;
    setBusyJobId(jobId);
    try {
      await api.cancelGigJob(accessToken, jobId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel gig job');
    } finally {
      setBusyJobId(null);
    }
  }

  async function handlePay(jobId: string) {
    if (!accessToken) return;
    setBusyJobId(jobId);
    try {
      const updated = await api.payGigJob(accessToken, jobId);
      if (updated.checkoutUrl) {
        window.location.href = updated.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
      setBusyJobId(null);
    }
  }

  async function handleApplyVoucher(voucherId: string, note: string) {
    if (!accessToken) return;
    setBusyJobId(voucherId);
    try {
      await api.applyGigVoucher(accessToken, voucherId, note || undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply voucher');
    } finally {
      setBusyJobId(null);
    }
  }

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  };
  const labelStyle = { display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 };
  const cardStyle = {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: 16,
    marginBottom: 16,
  };

  if (userLoading || loading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Sign in to view gig jobs.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Gig Jobs</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20, fontSize: 14 }}>
          Small paid tasks that produce a rent-relief voucher instead of cash — a way to earn toward rent, not
          spending money, aimed at helping avoid an eviction.
        </p>

        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {isPoster && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Post a gig job</h2>
            {isAdminPoster && !isOwnTenantPoster && (
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>
                Posted as platform staff — visible to every tenant on the platform.
              </p>
            )}
            {isOwnTenantPoster && (
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>
                Only visible to tenants who have an active conversation with you.
              </p>
            )}
            <form onSubmit={handlePost}>
              <label style={labelStyle}>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  maxLength={1000}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...labelStyle, flex: 1 }}>
                  Payout ($)
                  <input
                    type="number"
                    min={1}
                    step="1"
                    value={payout}
                    onChange={(e) => setPayout(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </label>
                {isOwnTenantPoster && (
                  <label style={{ ...labelStyle, flex: 2 }}>
                    Property (optional)
                    <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={inputStyle}>
                      <option value="">Not tied to a specific property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {postError && <p style={{ color: theme.danger, fontSize: 13 }}>{postError}</p>}
              <button
                type="submit"
                disabled={posting}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.primary,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {posting ? 'Posting...' : 'Post gig job'}
              </button>
            </form>
          </div>
        )}

        {isPoster && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Jobs you've posted</h2>
            {postedJobs.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>No gig jobs posted yet.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {postedJobs.map((job) => (
                <div key={job.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 14 }}>{job.title}</strong>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{formatMoney(job.payoutCents)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{job.description}</div>
                  <div style={{ fontSize: 12, color: theme.primary, fontWeight: 600, marginTop: 6 }}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {(job.status === 'OPEN' || job.status === 'CLAIMED') && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        disabled={busyJobId === job.id}
                        style={{ border: 'none', background: 'none', color: theme.danger, fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === 'COMPLETED' && (
                      <>
                        <button
                          onClick={() => handlePay(job.id)}
                          disabled={busyJobId === job.id}
                          style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Confirm & pay
                        </button>
                        <button
                          onClick={() => handleRejectCompletion(job.id)}
                          disabled={busyJobId === job.id}
                          style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Not done yet
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isPoster && issuedVouchers.length > 0 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Vouchers you've issued</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {issuedVouchers.map((v) => (
                <VoucherRow key={v.id} voucher={v} canApply onApply={handleApplyVoucher} busy={busyJobId === v.id} />
              ))}
            </div>
          </div>
        )}

        {isTenant && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Available gig jobs</h2>
            {jobs.filter((j) => j.status === 'OPEN').length === 0 && (
              <p style={{ color: theme.textMuted, fontSize: 13 }}>No open gig jobs right now.</p>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {jobs
                .filter((j) => j.status === 'OPEN')
                .map((job) => (
                  <div key={job.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 14 }}>{job.title}</strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{formatMoney(job.payoutCents)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{job.description}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                      Posted by {job.posterDisplayName}
                      {job.propertyTitle ? ` · ${job.propertyTitle}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <select
                        value={selectedConversation[job.id] ?? ''}
                        onChange={(e) => setSelectedConversation((prev) => ({ ...prev, [job.id]: e.target.value }))}
                        style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12, flex: 1 }}
                      >
                        <option value="">Which rental is this for?</option>
                        {conversations.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.property.title} ({c.landlordDisplayName})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleClaim(job.id)}
                        disabled={busyJobId === job.id || !selectedConversation[job.id]}
                        style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                      >
                        Claim
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {isTenant && jobs.some((j) => j.claimedById === user.id && j.status !== 'OPEN') && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Your claimed gig jobs</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {jobs
                .filter((j) => j.claimedById === user.id && j.status !== 'OPEN')
                .map((job) => (
                  <div key={job.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 14 }}>{job.title}</strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{formatMoney(job.payoutCents)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: theme.primary, fontWeight: 600, marginTop: 6 }}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </div>
                    {job.status === 'CLAIMED' && (
                      <button
                        onClick={() => handleComplete(job.id)}
                        disabled={busyJobId === job.id}
                        style={{ marginTop: 8, border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                      >
                        Mark complete
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {isTenant && myVouchers.length > 0 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Your rent vouchers</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {myVouchers.map((v) => (
                <VoucherRow key={v.id} voucher={v} canApply={false} busy={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function VoucherRow({
  voucher,
  canApply,
  onApply,
  busy,
}: {
  voucher: GigVoucher;
  canApply: boolean;
  onApply?: (id: string, note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 14 }}>{voucher.gigJobTitle}</strong>
        <span style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{formatMoney(voucher.voucherCents)}</span>
      </div>
      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
        {voucher.tenantDisplayName} · {voucher.landlordDisplayName} · fee {formatMoney(voucher.feeCents)}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: voucher.status === 'APPLIED' ? theme.success : theme.primary }}>
        {voucher.status === 'APPLIED' ? `Applied${voucher.appliedNote ? `: ${voucher.appliedNote}` : ''}` : 'Issued — not yet applied'}
      </div>
      {canApply && voucher.status === 'ISSUED' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. Applied to July rent"
            style={{ flex: 1, padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
          />
          <button
            onClick={() => onApply?.(voucher.id, note)}
            disabled={busy}
            style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            Mark applied
          </button>
        </div>
      )}
    </div>
  );
}
