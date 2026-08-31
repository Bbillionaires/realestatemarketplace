'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';

export default function RoomsPage() {
  const { accessToken, isLoading } = useAuth();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (accessToken) {
      api
        .listProperties(accessToken, { roomRentals: true })
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
        .getPropertyPreview({ roomRentals: true })
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
        <h1 style={{ fontSize: 22, marginBottom: 4, color: theme.text }}>Room &amp; Co-Living Rentals</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20, fontSize: 14, maxWidth: 640 }}>
          Listings below have at least one room or bed rented individually rather than the whole property as one
          unit. Open a listing to see each room&apos;s own rent and availability.
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
            Showing {properties.length} of {previewTotal} room &amp; co-living listings.{' '}
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
          <p style={{ color: theme.textMuted }}>No room or co-living listings are available right now. Check back soon.</p>
        )}
      </div>
    </main>
  );
}
