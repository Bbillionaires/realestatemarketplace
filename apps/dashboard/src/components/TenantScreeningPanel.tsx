'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, TenantScreeningSummary } from '../lib/api';
import { theme } from '../lib/theme';

interface TenantScreeningPanelProps {
  accessToken: string;
  conversationId: string;
  isTenantView: boolean;
  screening: TenantScreeningSummary | null;
  onScreeningChange: (updated: TenantScreeningSummary) => void;
}

const TENANT_STATUS_LABEL: Record<string, string> = {
  AWAITING_TENANT_AUTHORIZATION: 'This landlord has requested a tenant screening — pay & authorize it to continue.',
  PAID: 'Your screening is paid and being processed.',
  SUBMITTED_EXTERNALLY: 'Your screening has been submitted — awaiting results.',
  COMPLETE: 'Your completed screening is available to this landlord.',
  DECLINED: 'You declined this landlord’s screening request.',
  CANCELLED: 'This screening request was cancelled.',
};

export function TenantScreeningPanel({ accessToken, conversationId, isTenantView, screening, onScreeningChange }: TenantScreeningPanelProps) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = screening?.status ?? null;

  async function onRequest() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.requestTenantScreeningForConversation(accessToken, conversationId);
      onScreeningChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request a tenant screening');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setDownloading(true);
    setError(null);
    try {
      await api.downloadConversationTenantScreening(accessToken, conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download the screening result');
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
          <Link href="/tenant-screening" style={{ color: theme.primary, fontWeight: 600 }}>
            Manage →
          </Link>
        </p>
      </div>
    );
  }

  const canRequest = !status || status === 'DECLINED' || status === 'CANCELLED';

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <strong style={{ fontSize: 13 }}>Tenant Screening</strong>
      {canRequest ? (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: theme.textMuted }}>
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} style={{ marginTop: 2 }} />
            I acknowledge AffordableHomeMatch only manually facilitates this screening through a third-party
            provider and is not responsible for its accuracy.
          </label>
          <button
            onClick={onRequest}
            disabled={busy || !acknowledged}
            style={{ marginTop: 8, border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            {busy ? 'Requesting...' : 'Request Tenant Screening ($50, tenant pays)'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {(status === 'AWAITING_TENANT_AUTHORIZATION' || status === 'PAID' || status === 'SUBMITTED_EXTERNALLY') && (
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              {status === 'AWAITING_TENANT_AUTHORIZATION' ? 'Waiting for the tenant to pay & authorize' : 'Waiting on screening results'}
            </span>
          )}
          {status === 'COMPLETE' && (
            <button
              onClick={onDownload}
              disabled={downloading}
              style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              {downloading ? 'Downloading...' : 'View/Download screening'}
            </button>
          )}
        </div>
      )}
      {error && <p style={{ color: theme.danger, fontSize: 12, marginTop: 6, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
