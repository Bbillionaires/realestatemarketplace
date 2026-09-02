'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, VoucherAccessRequestSummary, VoucherDocumentSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { formatDateTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for your response',
  ACCEPTED: 'You shared this with the landlord',
  DECLINED: 'You declined this request',
  REVOKED: 'You revoked this landlord’s access',
};

export default function HousingVoucherPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [document, setDocument] = useState<VoucherDocumentSummary | null>(null);
  const [requests, setRequests] = useState<VoucherAccessRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const refresh = async () => {
    if (!accessToken) return;
    const [doc, reqs] = await Promise.all([api.getMyVoucherDocument(accessToken), api.listMyVoucherAccessRequests(accessToken)]);
    setDocument(doc);
    setRequests(reqs);
  };

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your Housing Voucher'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isLoading, router]);

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await api.uploadVoucherDocument(accessToken, file);
      setDocument(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload your Housing Voucher');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function onView() {
    if (!accessToken) return;
    api.viewMyVoucherDocument(accessToken);
  }

  async function onAccept(id: string) {
    if (!accessToken) return;
    setBusyRequestId(id);
    setError(null);
    try {
      const updated = await api.acceptVoucherAccessRequest(accessToken, id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept this request');
    } finally {
      setBusyRequestId(null);
    }
  }

  async function onDecline(id: string) {
    if (!accessToken) return;
    setBusyRequestId(id);
    setError(null);
    try {
      const updated = await api.declineVoucherAccessRequest(accessToken, id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline this request');
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Housing Voucher</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Upload your HUD Housing Choice Voucher once, then decide which landlords get to see it. A landlord can only
          view or download it after you accept their request — and you can revoke access at any time.
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
              padding: 24,
              marginBottom: 20,
            }}
          >
            {document?.hasDocument ? (
              <>
                <p style={{ fontSize: 14, color: theme.text, margin: 0 }}>
                  <strong>{document.fileName}</strong> — uploaded {document.uploadedAt ? formatDateTime(document.uploadedAt) : ''}
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={onView}
                    style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
                  >
                    View my upload
                  </button>
                  <label
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${theme.primary}`,
                      color: theme.primary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Replace file'}
                    <input type="file" accept="image/*,.pdf" onChange={onFileSelected} disabled={uploading} style={{ display: 'none' }} />
                  </label>
                </div>
              </>
            ) : (
              <label
                style={{
                  display: 'inline-block',
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.primary,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {uploading ? 'Uploading...' : 'Upload my Housing Voucher'}
                <input type="file" accept="image/*,.pdf" onChange={onFileSelected} disabled={uploading} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        )}

        {!loading && (
          <>
            <h2 style={{ fontSize: 17, color: theme.text, marginBottom: 12 }}>Requests from landlords</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {requests.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius,
                    boxShadow: theme.shadow,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{r.propertyTitle} — {r.landlordDisplayName}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    {r.status ? STATUS_LABEL[r.status] : ''}
                    {r.message ? ` · "${r.message}"` : ''}
                  </div>
                  {r.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => r.id && onAccept(r.id)}
                        disabled={busyRequestId === r.id || !document?.hasDocument}
                        title={!document?.hasDocument ? 'Upload your Housing Voucher before accepting' : undefined}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: theme.primary, color: 'white', fontSize: 12, cursor: 'pointer' }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => r.id && onDecline(r.id)}
                        disabled={busyRequestId === r.id}
                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', fontSize: 12, cursor: 'pointer' }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {!document?.hasDocument && r.status === 'PENDING' && (
                    <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, marginBottom: 0 }}>
                      Upload your Housing Voucher above before accepting.
                    </p>
                  )}
                  {r.status === 'ACCEPTED' && (
                    <button
                      onClick={() => r.id && onDecline(r.id)}
                      disabled={busyRequestId === r.id}
                      style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.danger}`, color: theme.danger, background: 'white', fontSize: 12, cursor: 'pointer' }}
                    >
                      Revoke access
                    </button>
                  )}
                </div>
              ))}
              {requests.length === 0 && <p style={{ color: theme.textMuted }}>No landlords have requested your Housing Voucher yet.</p>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
