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
      <div
        style={{
          background: theme.card,
          borderBottom: `1px solid ${theme.border}`,
          padding: '20px 24px',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.textMuted,
                fontSize: 15,
              }}
            >
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city, address, or property name"
              style={{
                width: '100%',
                padding: '12px 14px 12px 36px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            style={{
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4, color: theme.text }}>Rental Properties</h1>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 20, fontSize: 14 }}>
          {filtered.length} {filtered.length === 1 ? 'rental' : 'rentals'}
        </p>

        {error && <p style={{ color: theme.danger }}>{error}</p>}

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
        {filtered.length === 0 && !error && <p style={{ color: theme.textMuted }}>No properties match your search.</p>}
      </div>
    </main>
  );
}
