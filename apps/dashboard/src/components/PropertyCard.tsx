import Link from 'next/link';
import { PropertySummary } from '../lib/api';
import { formatMoney, primaryUnit } from '../lib/format';
import { theme } from '../lib/theme';
import { PhotoPlaceholder } from './PhotoPlaceholder';

export function PropertyCard({ property }: { property: PropertySummary }) {
  const unit = primaryUnit(property.units);
  const rentCents = unit?.rentCents ?? property.monthlyRentCents;
  const available = unit ? unit.isAvailable : property.isActive;

  return (
    <Link
      href={`/properties/${property.id}`}
      style={{
        display: 'block',
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <PhotoPlaceholder height={170} photoUrl={property.photoUrl} radius={0} />
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: '-0.02em' }}>
              {formatMoney(rentCents)}
            </span>
            {rentCents !== null && <span style={{ fontSize: 12, color: theme.textMuted }}> /mo + fees</span>}
          </div>
          <span
            style={{
              fontSize: 12,
              color: available ? theme.success : theme.textMuted,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {available && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.success, display: 'inline-block' }} />
            )}
            {available ? 'Available Now' : 'Not available'}
          </span>
        </div>

        <div style={{ marginTop: 6, fontSize: 14, color: theme.text, fontWeight: 500 }}>
          {unit?.bedrooms ?? '—'} beds &middot; {unit?.bathrooms ?? '—'} baths
          {unit?.squareFeet ? ` · ${unit.squareFeet.toLocaleString()} sqft` : ''}
        </div>

        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15, color: theme.text }}>{property.title}</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {property.addressLine1}, {property.city}, {property.state} {property.zip}
        </div>

        {property.description && (
          <div style={{ marginTop: 10, fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}>
            {property.description.length > 110 ? `${property.description.slice(0, 110)}…` : property.description}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${theme.border}`,
            fontSize: 12,
            color: theme.textMuted,
          }}
        >
          Managed by {property.landlordDisplayName}
        </div>
      </div>
    </Link>
  );
}
