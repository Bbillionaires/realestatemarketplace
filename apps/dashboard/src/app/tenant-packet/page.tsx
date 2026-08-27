'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, TenantPacketSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

export default function TenantPacketPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [packet, setPacket] = useState<TenantPacketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backgroundExplanation, setBackgroundExplanation] = useState('');
  const [references, setReferences] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .getTenantPacket(accessToken)
      .then((p) => {
        setPacket(p);
        setBackgroundExplanation(p.backgroundExplanation ?? '');
        setReferences(p.references ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your packet'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  async function startCheckout() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.createTenantPacketCheckout(accessToken);
      if (updated.checkoutUrl) {
        window.location.href = updated.checkoutUrl;
      } else {
        setPacket(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.submitTenantPacket(accessToken, {
        backgroundExplanation: backgroundExplanation || undefined,
        references: references || undefined,
        file: file ?? undefined,
      });
      setPacket(updated);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your packet');
    } finally {
      setBusy(false);
    }
  }

  const canFillOut = packet && (packet.status === 'PAID' || packet.status === 'SUBMITTED');

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Fast-Track Profile Packet</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Pay a one-time $29 fee, fill this out once, then share it with any landlord you message on the platform —
          no need to retype your income proof, background explanation, and references for every application.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {!loading && packet?.status === 'NOT_STARTED' && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24 }}>
            <button
              onClick={startCheckout}
              disabled={busy}
              style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              {busy ? 'Starting checkout...' : 'Get started ($29)'}
            </button>
          </div>
        )}

        {!loading && packet?.status === 'AWAITING_PAYMENT' && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24 }}>
            <a
              href={packet.checkoutUrl ?? '#'}
              style={{ display: 'inline-block', padding: '12px 20px', borderRadius: 8, background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
            >
              Pay ${(packet.feeCents / 100).toFixed(2)}
            </a>
          </div>
        )}

        {!loading && canFillOut && (
          <form
            onSubmit={onSubmit}
            style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, display: 'grid', gap: 14 }}
          >
            {packet?.status === 'SUBMITTED' && (
              <p style={{ fontSize: 13, color: theme.primaryDark, fontWeight: 600, margin: 0 }}>
                Your packet is ready to share. Update any field below and save to change it.
              </p>
            )}
            <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              Background explanation (optional)
              <textarea
                value={backgroundExplanation}
                onChange={(e) => setBackgroundExplanation(e.target.value)}
                rows={4}
                placeholder="e.g. Evicted 4 years ago due to job loss; stable income and housing since."
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              References (optional)
              <textarea
                value={references}
                onChange={(e) => setReferences(e.target.value)}
                rows={3}
                placeholder="e.g. Prior landlord: Jane Smith, (555) 555-0100"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              Income proof {packet?.incomeProofFileName ? `(currently: ${packet.incomeProofFileName})` : ''}
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: 'block', marginTop: 6, fontSize: 13 }}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: 'fit-content' }}
            >
              {busy ? 'Saving...' : 'Save packet'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
