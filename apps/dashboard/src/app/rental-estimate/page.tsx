'use client';

import { FormEvent, useState } from 'react';
import { api, RentEstimate } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { formatMoney } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

export default function RentalEstimatePage() {
  const { accessToken } = useAuth();
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [result, setResult] = useState<RentEstimate | null>(null);
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
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const estimate = await api.getRentEstimate(accessToken, {
        addressLine1,
        city,
        state,
        zip,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      });
      setResult(estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get an estimate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Rental Estimate</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Get an estimated monthly rent based on active listings on Affordable Home Match near a specific
          address — not just a city or zip-code average, since rent can vary significantly within less than a
          mile. This is not a formal appraisal.
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
          }}
        >
          <label style={labelStyle}>
            Street address
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              required
              placeholder="123 Main Street"
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 2 }}>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} required style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              State
              <input value={state} onChange={(e) => setState(e.target.value)} required style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              ZIP
              <input value={zip} onChange={(e) => setZip(e.target.value)} required style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Bedrooms
            <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={inputStyle} />
          </label>

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
            {loading ? 'Calculating...' : 'Get estimate'}
          </button>
        </form>

        {result && (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              padding: 24,
              textAlign: 'center',
            }}
          >
            {!result.addressResolved ? (
              <p style={{ color: theme.textMuted, fontSize: 14 }}>
                We couldn't locate that address. Double-check the street address, city, state, and ZIP and try
                again.
              </p>
            ) : result.estimatedMonthlyRentCents !== null ? (
              <>
                <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700, letterSpacing: '0.03em' }}>
                  ESTIMATED MONTHLY RENT
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: theme.text, marginTop: 6 }}>
                  {formatMoney(result.estimatedMonthlyRentCents)}
                </div>
                <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 10 }}>
                  Based on {result.sampleSize} similar {result.sampleSize === 1 ? 'listing' : 'listings'} within{' '}
                  {result.radiusMiles} miles on Affordable Home Match.
                </p>
              </>
            ) : (
              <p style={{ color: theme.textMuted, fontSize: 14 }}>
                We don't have enough listings within {result.radiusMiles} miles of that address yet to produce an
                estimate. Try a broader search (fewer filters).
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
