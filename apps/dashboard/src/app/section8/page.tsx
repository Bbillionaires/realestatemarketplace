'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PropertyCard } from '../../components/PropertyCard';
import { NavBar } from '../../components/NavBar';
import { RentToOwnCallout } from '../../components/RentToOwnCallout';

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
          <h1 style={{ fontSize: 22, margin: 0, color: theme.text }}>Section 8 Housing &amp; HUD-Approved Apartments</h1>
          <p style={{ color: theme.text, marginTop: 10, marginBottom: 4, fontSize: 15, fontWeight: 700, maxWidth: 640 }}>
            Stop Wasting Money on Application Fees.
          </p>
          <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 16, fontSize: 14, maxWidth: 640 }}>
            Browse 100% verified voucher-friendly homes from landlords that actively welcome housing vouchers,
            including HUD-approved apartments and housing choice voucher rentals nationwide. Message the landlord
            through the platform to confirm current voucher requirements before applying.
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
              Search Voucher-Approved Homes
            </a>
            <Link
              href="/voucher-matcher"
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
              Check My Zip Code Payment Standard
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, fontSize: 13 }}>
            <Link href="/hqs-checklist" style={{ color: theme.primary, fontWeight: 600 }}>
              HUD HQS Fast-Track Checklist →
            </Link>
            <Link href="/housing-authorities" style={{ color: theme.primary, fontWeight: 600 }}>
              Housing Authority Directory →
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
            Showing {properties.length} of {previewTotal} Section 8 listings.{' '}
            <Link href="/register" style={{ color: theme.primary, fontWeight: 700 }}>
              Sign up free
            </Link>{' '}
            to see them all.
          </div>
        )}

        <h2 id="listings" style={{ fontSize: 18, marginTop: 28, marginBottom: 4, color: theme.text }}>
          Verified Voucher-Friendly Listings
        </h2>
        <p style={{ color: theme.textMuted, marginTop: 0, marginBottom: 16, fontSize: 13, maxWidth: 640 }}>
          Look for the "Section 8 OK" badge for guaranteed voucher acceptance and the "HQS Pre-Inspected" badge for
          landlords who've already passed a walkthrough.
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
          <p style={{ color: theme.textMuted }}>No Section 8 listings are available right now. Check back soon.</p>
        )}
      </div>
    </main>
  );
}
