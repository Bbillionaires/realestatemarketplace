'use client';

import { FormEvent, useState } from 'react';
import { api, VoucherMatch } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';
import { PropertyCard } from '../../components/PropertyCard';

const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1 Bedroom' },
  { value: 2, label: '2 Bedrooms' },
  { value: 3, label: '3 Bedrooms' },
  { value: 4, label: '4+ Bedrooms' },
];

export default function VoucherMatcherPage() {
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState(2);
  const [result, setResult] = useState<VoucherMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const matches = await api.getVoucherMatches(zip, bedrooms);
      setResult(matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to look up voucher matches');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Housing Choice Voucher Rentals &amp; Value Matcher</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
          Enter your voucher&apos;s bedroom allowance and a zip code to see the current HUD payment standard and
          every HUD-approved apartment and housing choice voucher rental on Affordable Home Match priced at or below
          it. No account needed.
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: 24,
            marginBottom: 20,
            maxWidth: 560,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Bedroom allowance
              <select value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} style={inputStyle}>
                {BEDROOM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Zip code
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                placeholder="32209"
                style={inputStyle}
              />
            </label>
          </div>

          {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Looking up...' : 'Find matching homes'}
          </button>
        </form>

        {result && !result.covered && (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              padding: 24,
              maxWidth: 560,
            }}
          >
            <p style={{ color: theme.textMuted, fontSize: 14, margin: 0 }}>
              We don&apos;t have a published HUD payment standard for zip code {result.zip} yet. Try a nearby Duval
              County zip code, or message a Jacksonville Housing Authority caseworker to confirm your standard.
            </p>
          </div>
        )}

        {result && result.covered && (
          <>
            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                padding: '20px 24px',
                marginBottom: 20,
                maxWidth: 560,
              }}
            >
              <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700, letterSpacing: '0.03em' }}>
                {BEDROOM_OPTIONS.find((o) => o.value === result.bedrooms)?.label.toUpperCase()} PAYMENT STANDARD
                &middot; ZIP {result.zip}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: theme.text, marginTop: 6 }}>
                {formatMoney(result.paymentStandardCents)}
                <span style={{ fontSize: 14, fontWeight: 500, color: theme.textMuted }}> /mo</span>
              </div>
              <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 10, marginBottom: 0 }}>
                {result.metroArea}
                {result.effectiveDate &&
                  ` — effective ${new Date(result.effectiveDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}
                . Confirm your exact voucher amount with your housing authority caseworker.
              </p>
            </div>

            {result.matches.length > 0 ? (
              <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {result.matches.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <p style={{ color: theme.textMuted, fontSize: 14 }}>
                No Section 8 listings in zip code {result.zip} are currently priced at or below the payment standard.
                Check back soon, or browse all{' '}
                <a href="/section8" style={{ color: theme.primary, fontWeight: 700 }}>
                  Section 8 housing
                </a>{' '}
                on the platform.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
