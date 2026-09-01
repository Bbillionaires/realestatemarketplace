'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { api, PropertySummary } from '../../lib/api';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';
import { RentToOwnCallout } from '../../components/RentToOwnCallout';

export default function RentToOwnPage() {
  const { accessToken, isLoading } = useAuth();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    const filters = { rentToOwn: true };
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
      // — same pattern as /section8 and /second-chance.
      api
        .getPropertyPreview(filters)
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
          <h1 style={{ fontSize: 22, margin: 0, color: theme.text }}>Rent-to-Own &amp; Path to Homeownership</h1>
          <p style={{ color: theme.textMuted, marginTop: 8, marginBottom: 0, fontSize: 14, maxWidth: 640 }}>
            Browse homes where the landlord offers rent-to-own, lease-to-own, or seller financing — a path from
            renting to owning. Message the landlord through the platform to confirm current terms before applying.
          </p>
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
            Showing {properties.length} of {previewTotal} rent-to-own listings. Sign up free to see them all.
          </div>
        )}

        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 16, color: theme.text }}>Rent-to-Own Listings</h2>

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
          <p style={{ color: theme.textMuted }}>No rent-to-own listings are available right now. Check back soon.</p>
        )}
      </div>
    </main>
  );
}
