'use client';

import { useState } from 'react';
import { IdSubmissionSummary } from '../lib/api';
import { theme } from '../lib/theme';

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting the $5 convenience fee',
  PAID: 'Fee paid — ready to submit ID',
  SUBMITTED: 'ID submitted',
  CANCELLED: 'Cancelled',
};

function formatFee(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function IdSubmissionPanel({
  submission,
  isTenantView,
  onStart,
  onCancel,
  onSubmit,
}: {
  submission: IdSubmissionSummary | null;
  isTenantView: boolean;
  onStart: () => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onSubmit: (id: string, file: File, note?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isOpen = submission && submission.status !== 'CANCELLED';

  if (!isTenantView) {
    if (!isOpen) return null;
    return (
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>ID submission: {STATUS_LABEL[submission!.status] ?? submission!.status}</strong>
        {submission!.status === 'SUBMITTED' && (
          <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>
            Sent to your email{submission!.submittedFileName ? ` (${submission!.submittedFileName})` : ''}.
          </p>
        )}
      </div>
    );
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ID submission');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!submission || !file) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(submission.id, file, note || undefined);
      setFile(null);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ID');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>
          {isOpen ? STATUS_LABEL[submission!.status] ?? submission!.status : 'Submit ID to the landlord'}
        </strong>
        {isOpen && submission!.status === 'AWAITING_PAYMENT' && (
          <button
            onClick={() => onCancel(submission!.id)}
            style={{ border: 'none', background: 'none', color: theme.danger, fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>

      {!isOpen && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>
            Send your ID directly to the landlord/property manager through the platform for a $5 convenience fee,
            instead of exchanging contact info off-platform.
          </p>
          <button
            onClick={handleStart}
            disabled={busy}
            style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            Submit ID ($5 fee)
          </button>
        </div>
      )}

      {isOpen && submission!.status === 'AWAITING_PAYMENT' && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>
            Pay the {formatFee(submission!.feeCents)} convenience fee to continue.
          </p>
          <a
            href={submission!.checkoutUrl ?? '#'}
            style={{
              display: 'inline-block',
              border: 'none',
              background: theme.primary,
              color: 'white',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            Pay {formatFee(submission!.feeCents)}
          </a>
        </div>
      )}

      {isOpen && submission!.status === 'PAID' && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
          <input
            type="text"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
          />
          <button
            onClick={handleSubmit}
            disabled={busy || !file}
            style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', width: 'fit-content' }}
          >
            Submit ID
          </button>
        </div>
      )}

      {isOpen && submission!.status === 'SUBMITTED' && (
        <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>
          Sent to the landlord{submission!.submittedFileName ? ` (${submission!.submittedFileName})` : ''}.
        </p>
      )}

      {error && <p style={{ color: theme.danger, fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
