'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';
import { RentToOwnCallout } from '../../components/RentToOwnCallout';

export default function SecondChancePage() {
  const { accessToken, isLoading } = useAuth();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [brokenLeaseOk, setBrokenLeaseOk] = useState(false);
  const [cosignerAccepted, setCosignerAccepted] = useState(false);
  const [noCreditCheckIncomeOnly, setNoCreditCheckIncomeOnly] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setLoading(true);
    const filters = { secondChance: true, brokenLeaseOk, cosignerAccepted, noCreditCheckIncomeOnly };
    if (accessToken) {
      api
        .listProperties(accessToken, filters)
        .then((props) => {
          setProperties(props);
          setPreviewTotal(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
        .finally(() => setLoading(false));
    } else {
      // Logged-out visitor: a capped, real preview instead of a login wall
      // — enough for the page to be worth searching for and indexing.
      api
        .getPropertyPreview(filters)
        .then((res) => {
          setProperties(res.properties);
          setPreviewTotal(res.total);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
        .finally(() => setLoading(false));
    }
  }, [accessToken, isLoading, brokenLeaseOk, cosignerAccepted, noCreditCheckIncomeOnly]);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0, color: theme.text }}>Second-Chance Apartments &amp; Eviction-Friendly Rentals</h1>
          <p style={{ color: theme.text, marginTop: 10, marginBottom: 4, fontSize: 15, fontWeight: 700, maxWidth: 640 }}>
            Your Past Doesn't Define Your Home.
          </p>
          <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 16, fontSize: 14, maxWidth: 640 }}>
            Find landlords who look beyond credit scores and past evictions to give you a fresh start — including
            no-credit-check and bad-credit rental listings. Message the landlord through the platform to confirm
            current screening criteria before applying.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <a
              href="#listings"
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: theme.primary,
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Browse Second-Chance Listings
            </a>
            <Link
              href="/tenant-packet"
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: `1px solid ${theme.primary}`,
                color: theme.primary,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Build My Tenant Profile
            </Link>
          </div>
        </div>

        <RentToOwnCallout />

        {previewTotal !== null && previewTotal > properties.length && (
          <div
            style={{
              background: theme.primaryLight,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              padding: '10px 14px',
              marginTop: 20,
              marginBottom: 16,
              fontSize: 13,
              color: theme.text,
            }}
          >
            Showing {properties.length} of {previewTotal} second-chance listings.{' '}
            <Link href="/register" style={{ color: theme.primary, fontWeight: 700 }}>
              Sign up free
            </Link>{' '}
            to see them all.
          </div>
        )}

        <h2 id="listings" style={{ fontSize: 18, marginTop: 28, marginBottom: 4, color: theme.text }}>
          Second-Chance Friendly Listings
        </h2>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 16, fontSize: 13, maxWidth: 640 }}>
          Listings below are marked by their landlord as open to applicants with a prior eviction, credit issue, or
          justice-involvement.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16, fontSize: 13, color: theme.text }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={brokenLeaseOk} onChange={(e) => setBrokenLeaseOk(e.target.checked)} />
            Broken lease OK
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cosignerAccepted} onChange={(e) => setCosignerAccepted(e.target.checked)} />
            Cosigner accepted
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={noCreditCheckIncomeOnly}
              onChange={(e) => setNoCreditCheckIncomeOnly(e.target.checked)}
            />
            No credit check
          </label>
        </div>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}

        {!loading && !error && (
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
        {!loading && !error && properties.length === 0 && (
          <p style={{ color: theme.textMuted }}>No second-chance-friendly listings are available right now. Check back soon.</p>
        )}
      </div>
    </main>
  );
}
