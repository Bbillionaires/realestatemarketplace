'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, VoucherAccessRequestSummary } from '../lib/api';
import { theme } from '../lib/theme';

interface VoucherAccessPanelProps {
  accessToken: string;
  conversationId: string;
  isTenantView: boolean;
  request: VoucherAccessRequestSummary | null;
  onRequestChange: (updated: VoucherAccessRequestSummary) => void;
}

const TENANT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'This landlord has requested your Housing Voucher.',
  ACCEPTED: 'You’ve shared your Housing Voucher with this landlord.',
  DECLINED: 'You declined this landlord’s Housing Voucher request.',
  REVOKED: 'You revoked this landlord’s access to your Housing Voucher.',
};

export function VoucherAccessPanel({ accessToken, conversationId, isTenantView, request, onRequestChange }: VoucherAccessPanelProps) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = request?.status ?? null;

  async function onRequestAccess() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.requestVoucherAccess(accessToken, conversationId);
      onRequestChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request voucher access');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setDownloading(true);
    setError(null);
    try {
      await api.downloadVoucherForConversation(accessToken, conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download the Housing Voucher');
    } finally {
      setDownloading(false);
    }
  }

  if (isTenantView) {
    if (!status) return null;
    return (
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          {TENANT_STATUS_LABEL[status]}{' '}
          <Link href="/housing-voucher" style={{ color: theme.primary, fontWeight: 600 }}>
            Manage →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Housing Voucher</strong>
        {(!status || status === 'DECLINED' || status === 'REVOKED') && (
          <button
            onClick={onRequestAccess}
            disabled={busy}
            style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            {busy ? 'Requesting...' : 'Request voucher access'}
          </button>
        )}
        {status === 'PENDING' && <span style={{ fontSize: 12, color: theme.textMuted }}>Waiting for tenant to respond</span>}
        {status === 'ACCEPTED' && (
          <button
            onClick={onDownload}
            disabled={downloading}
            style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            {downloading ? 'Downloading...' : 'View/Download voucher'}
          </button>
        )}
      </div>
      {status === 'DECLINED' && (
        <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>The tenant declined your last request.</p>
      )}
      {status === 'REVOKED' && (
        <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>The tenant revoked your access.</p>
      )}
      {error && <p style={{ color: theme.danger, fontSize: 12, marginTop: 6, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
