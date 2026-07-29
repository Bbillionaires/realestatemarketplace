'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';

export default function PropertiesPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listProperties(accessToken)
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.title, p.addressLine1, p.city, p.state, p.zip].some((f) => f.toLowerCase().includes(q)),
    );
  }, [properties, query]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by city, address, or property name"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              fontSize: 14,
            }}
          />
        </div>

        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Rental Properties</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20 }}>
          {filtered.length} {filtered.length === 1 ? 'rental' : 'rentals'}
        </p>

        {error && <p style={{ color: theme.danger }}>{error}</p>}

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtered.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
        {filtered.length === 0 && !error && <p>No properties match your search.</p>}
      </div>
    </main>
  );
}
