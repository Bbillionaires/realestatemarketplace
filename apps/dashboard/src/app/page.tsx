'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PropertySummary } from '../lib/api';
import { formatMoney, primaryUnit } from '../lib/format';
import { theme } from '../lib/theme';
import { PhotoPlaceholder } from '../components/PhotoPlaceholder';

// A 4x4 ring: the center 2x2 block is the hero (brand/slogan/buttons), and
// the 12 outer cells frame it — matching exactly the default feed size, so
// on a wide screen every tile is a real listing. On narrow screens this
// collapses to a plain two-column grid with the hero spanning the top (see
// the media query below) rather than trying to keep a "ring" that wouldn't
// fit.
const RING_CSS = `
  .home-feed-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .home-feed-hero {
    grid-column: 1 / -1;
  }
  @media (min-width: 900px) {
    .home-feed-grid {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(4, minmax(170px, 1fr));
      grid-template-areas:
        "c1  c2   c3   c4"
        "c5  hero hero c6"
        "c7  hero hero c8"
        "c9  c10  c11  c12";
      gap: 18px;
      min-height: 82vh;
    }
    .home-feed-hero { grid-area: hero; }
    .home-feed-gc-1 { grid-area: c1; }
    .home-feed-gc-2 { grid-area: c2; }
    .home-feed-gc-3 { grid-area: c3; }
    .home-feed-gc-4 { grid-area: c4; }
    .home-feed-gc-5 { grid-area: c5; }
    .home-feed-gc-6 { grid-area: c6; }
    .home-feed-gc-7 { grid-area: c7; }
    .home-feed-gc-8 { grid-area: c8; }
    .home-feed-gc-9 { grid-area: c9; }
    .home-feed-gc-10 { grid-area: c10; }
    .home-feed-gc-11 { grid-area: c11; }
    .home-feed-gc-12 { grid-area: c12; }
  }
`;

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

  const hero = (
    <div
      className="home-feed-hero"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: '32px 24px',
        gap: 6,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.primary, letterSpacing: '-0.02em', margin: 0 }}>
        Affordable Home Match
      </h1>
      <p style={{ color: theme.textMuted, fontSize: 14, margin: 0, maxWidth: 320 }}>
        Matching Qualified Tenants with Affordable Homes Nationwide
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
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
      {properties.length > 0 && (
        <p style={{ marginTop: 14, fontSize: 12, color: theme.textMuted }}>Tap a home to flip it over and see the details.</p>
      )}
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      {/* dangerouslySetInnerHTML, not a JSX text child — a raw text child
          here gets HTML-entity-escaped differently between server and
          client render passes (the quotes in grid-template-areas trigger
          it), which is a real React hydration mismatch, not cosmetic. */}
      <style dangerouslySetInnerHTML={{ __html: RING_CSS }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 48px' }}>
        {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {loading ? (
          <>
            {hero}
            <p style={{ color: theme.textMuted, marginTop: 16 }}>Loading homes...</p>
          </>
        ) : properties.length === 0 ? (
          <>
            {hero}
            <div
              style={{
                marginTop: 16,
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
          </>
        ) : (
          <div className="home-feed-grid">
            {hero}
            {properties.map((property, i) => (
              <FlipCard key={property.id} property={property} className={`home-feed-gc-${i + 1}`} />
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

const CARD_HEIGHT = 220;

function FlipCard({ property, className }: { property: PropertySummary; className?: string }) {
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
      className={className}
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
