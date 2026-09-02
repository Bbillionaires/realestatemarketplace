'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, VoucherAdminDocumentSummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatDateTime } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

export default function AdminVoucherDocumentsPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [documents, setDocuments] = useState<VoucherAdminDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingTenantId, setDownloadingTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user || !STAFF_ROLES.includes(user.role)) return;
    api
      .listAdminVoucherDocuments(accessToken)
      .then(setDocuments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  async function onDownload(tenantId: string) {
    if (!accessToken) return;
    setDownloadingTenantId(tenantId);
    try {
      await api.downloadVoucherAsAdmin(accessToken, tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download this file');
    } finally {
      setDownloadingTenantId(null);
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

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Housing Voucher Uploads</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Every tenant who has uploaded a HUD Housing Choice Voucher. Staff can always download any upload directly —
          this is independent of whether a tenant has granted a landlord access.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 10 }}>
            {documents.map((d) => (
              <div
                key={d.tenantId}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{d.tenantDisplayName}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    {d.tenantEmail} · {d.fileName} · uploaded {formatDateTime(d.uploadedAt)}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(d.tenantId)}
                  disabled={downloadingTenantId === d.tenantId}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
                >
                  {downloadingTenantId === d.tenantId ? 'Downloading...' : 'Download'}
                </button>
              </div>
            ))}
            {documents.length === 0 && <p style={{ color: theme.textMuted }}>No Housing Voucher uploads yet.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
