'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../lib/api';
import { formatMoney, primaryUnit } from '../lib/format';
import { theme } from '../lib/theme';
import { PhotoPlaceholder } from '../components/PhotoPlaceholder';

export default function HomePage() {
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPropertyFeed(12)
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.primary, letterSpacing: '-0.02em', margin: 0 }}>
              Affordable Home Match
            </h1>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: '2px 0 0' }}>
              Matching Qualified Tenants with Affordable Homes Nationwide
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/register" style={pillStyle('solid')}>
              Sign up
            </Link>
            <Link href="/login" style={pillStyle('outline')}>
              Sign in
            </Link>
            <Link href="/properties" style={pillStyle('outline')}>
              Browse properties
            </Link>
          </div>
        </div>

        <p style={{ marginTop: 28, marginBottom: 16, fontSize: 13, color: theme.textMuted }}>
          Tap a home to flip it over and see the details.
        </p>

        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {loading ? (
          <p style={{ color: theme.textMuted }}>Loading homes...</p>
        ) : properties.length === 0 ? (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              padding: 32,
              textAlign: 'center',
              color: theme.textMuted,
            }}
          >
            No listings yet — check back soon, or{' '}
            <Link href="/register" style={{ color: theme.primary, fontWeight: 700 }}>
              list your property
            </Link>
            .
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {properties.map((property) => (
              <FlipCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function pillStyle(variant: 'solid' | 'outline'): CSSProperties {
  return {
    padding: '10px 20px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    textDecoration: 'none',
    border: variant === 'outline' ? `1px solid ${theme.border}` : 'none',
    background: variant === 'solid' ? theme.primary : theme.card,
    color: variant === 'solid' ? 'white' : theme.text,
  };
}

const CARD_HEIGHT = 260;

function FlipCard({ property }: { property: PropertySummary }) {
  const [flipped, setFlipped] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  const unit = primaryUnit(property.units);
  const rentCents = unit?.rentCents ?? property.monthlyRentCents;
  const willingToSell = property.rentToOwnAvailable || property.leaseToOwnAvailable || property.sellerFinancingAvailable;

  function handleFlip() {
    setFlipped((f) => !f);
    if (!viewRecorded) {
      setViewRecorded(true);
      api.recordPropertyView(property.id).catch(() => undefined);
    }
  }

  return (
    <div
      onClick={handleFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleFlip();
      }}
      style={{
        height: CARD_HEIGHT,
        perspective: 1200,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.1, 0.2, 1)',
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
        }}
      >
        {/* Front: the image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: theme.radius,
            overflow: 'hidden',
            boxShadow: theme.shadow,
          }}
        >
          <PhotoPlaceholder height={CARD_HEIGHT} photoUrl={property.photoUrl} radius={0} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '20px 14px 12px',
              background: 'linear-gradient(to top, rgba(10,20,35,0.78), rgba(10,20,35,0))',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {formatMoney(rentCents)}
              {rentCents !== null && <span style={{ fontSize: 12, fontWeight: 500 }}> /mo</span>}
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {property.city}, {property.state}
            </div>
          </div>
        </div>

        {/* Back: the details */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: theme.card,
            boxShadow: theme.shadow,
            padding: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: theme.text }}>
            {willingToSell && <span style={{ color: theme.gold, marginRight: 4 }}>★</span>}
            {property.title}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            {property.addressLine1}, {property.city}, {property.state} {property.zip}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, marginTop: 8 }}>
            {formatMoney(rentCents)}
            {rentCents !== null && <span style={{ fontSize: 12, fontWeight: 500, color: theme.textMuted }}> /mo + fees</span>}
          </div>
          <div style={{ fontSize: 12, color: theme.text, marginTop: 4 }}>
            {unit?.bedrooms ?? '—'} beds &middot; {unit?.bathrooms ?? '—'} baths
            {unit?.squareFeet ? ` · ${unit.squareFeet.toLocaleString()} sqft` : ''}
          </div>
          {property.description && (
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, lineHeight: 1.5, flex: 1, overflow: 'hidden' }}>
              {property.description.length > 90 ? `${property.description.slice(0, 90)}…` : property.description}
            </div>
          )}
          <Link
            href={`/properties/${property.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 'auto', fontSize: 12, fontWeight: 700, color: theme.primary, textDecoration: 'none' }}
          >
            View full details →
          </Link>
        </div>
      </div>
    </div>
  );
}
