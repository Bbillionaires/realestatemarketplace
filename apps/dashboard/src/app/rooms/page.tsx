'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';

export default function RoomsPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listProperties(accessToken, { roomRentals: true })
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4, color: theme.text }}>Room &amp; Co-Living Rentals</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20, fontSize: 14, maxWidth: 640 }}>
          Listings below have at least one room or bed rented individually rather than the whole property as one
          unit. Open a listing to see each room&apos;s own rent and availability.
        </p>

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
