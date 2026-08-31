'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';

export default function Section8Page() {
  const { accessToken, isLoading } = useAuth();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (accessToken) {
      api
        .listProperties(accessToken, { section8: true })
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
        .getPropertyPreview({ section8: true })
        .then((res) => {
          setProperties(res.properties);
          setPreviewTotal(res.total);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
        .finally(() => setLoading(false));
    }
  }, [accessToken, isLoading]);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4, color: theme.text }}>Section 8 Housing &amp; HUD-Approved Apartments</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20, fontSize: 14, maxWidth: 640 }}>
          Browse affordable housing listings from landlords that accept housing vouchers, including HUD-approved
          apartments and housing choice voucher rentals nationwide. Message the landlord through the platform to
          confirm current voucher requirements before applying.
        </p>

        {previewTotal !== null && previewTotal > properties.length && (
          <div
            style={{
              background: theme.primaryLight,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 13,
              color: theme.text,
            }}
          >
            Showing {properties.length} of {previewTotal} Section 8 listings.{' '}
            <Link href="/register" style={{ color: theme.primary, fontWeight: 700 }}>
              Sign up free
            </Link>{' '}
            to see them all.
          </div>
        )}

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
          <p style={{ color: theme.textMuted }}>No Section 8 listings are available right now. Check back soon.</p>
        )}
      </div>
    </main>
  );
}
