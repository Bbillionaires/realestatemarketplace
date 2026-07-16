'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function PropertiesPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listProperties(accessToken)
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false));
  }, [accessToken, router]);

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h1>Properties</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 16 }}>
        {properties.map((property) => (
          <div key={property.id} style={{ background: 'white', padding: 16, borderRadius: 8 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{property.title}</h2>
            <p style={{ margin: '4px 0', color: '#555' }}>
              {property.addressLine1}, {property.city}, {property.state} {property.zip}
            </p>
            <p style={{ margin: '4px 0' }}>Managed by {property.landlordDisplayName}</p>
            {property.monthlyRentCents !== null && (
              <p style={{ margin: '4px 0', fontWeight: 600 }}>
                ${(property.monthlyRentCents / 100).toLocaleString()}/month
              </p>
            )}
          </div>
        ))}
        {properties.length === 0 && <p>No properties yet.</p>}
      </div>
    </main>
  );
}
