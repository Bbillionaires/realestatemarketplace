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
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [referenceRows, setReferenceRows] = useState<{ name: string; phone: string; email: string; relationship: string }[]>([]);
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
        setMonthlyIncome(p.monthlyIncomeCents != null ? (p.monthlyIncomeCents / 100).toString() : '');
        setEmployerName(p.employerName ?? '');
        setReferenceRows(
          p.referenceContacts.length > 0
            ? p.referenceContacts.map((r) => ({ name: r.name, phone: r.phone ?? '', email: r.email ?? '', relationship: r.relationship ?? '' }))
            : [],
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your packet'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  function addReferenceRow() {
    setReferenceRows((rows) => [...rows, { name: '', phone: '', email: '', relationship: '' }]);
  }

  function updateReferenceRow(index: number, field: 'name' | 'phone' | 'email' | 'relationship', value: string) {
    setReferenceRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeReferenceRow(index: number) {
    setReferenceRows((rows) => rows.filter((_, i) => i !== index));
  }

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
      const trimmedIncome = monthlyIncome.trim();
      const namedReferences = referenceRows.filter((r) => r.name.trim().length > 0);
      const updated = await api.submitTenantPacket(accessToken, {
        backgroundExplanation: backgroundExplanation || undefined,
        monthlyIncomeCents: trimmedIncome ? Math.round(Number(trimmedIncome) * 100) : undefined,
        employerName: employerName || undefined,
        referenceContacts: namedReferences.length > 0 ? namedReferences : undefined,
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
              Monthly income (optional)
              <input
                type="number"
                min={0}
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 3200"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              Employer (optional)
              <input
                type="text"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                maxLength={200}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </label>
            <div>
              <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>References (optional)</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {referenceRows.map((row, i) => (
                  <div
                    key={i}
                    style={{ display: 'grid', gap: 6, padding: 10, border: `1px solid ${theme.border}`, borderRadius: 8 }}
                  >
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateReferenceRow(i, 'name', e.target.value)}
                      placeholder="Name"
                      maxLength={200}
                      style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={row.relationship}
                        onChange={(e) => updateReferenceRow(i, 'relationship', e.target.value)}
                        placeholder="Relationship, e.g. Prior landlord"
                        maxLength={100}
                        style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
                      />
                      <input
                        type="text"
                        value={row.phone}
                        onChange={(e) => updateReferenceRow(i, 'phone', e.target.value)}
                        placeholder="Phone"
                        maxLength={50}
                        style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={row.email}
                        onChange={(e) => updateReferenceRow(i, 'email', e.target.value)}
                        placeholder="Email"
                        maxLength={200}
                        style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeReferenceRow(i)}
                        style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', color: theme.danger, fontSize: 12, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addReferenceRow}
                style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, border: `1px solid ${theme.primary}`, background: 'white', color: theme.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                + Add another reference
              </button>
            </div>
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
