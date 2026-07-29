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
        borderRadius: 10,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <PhotoPlaceholder height={160} />
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{formatMoney(rentCents)}</span>
          <span style={{ fontSize: 13, color: available ? theme.success : theme.textMuted, fontWeight: 600 }}>
            {available ? '● Available Now' : 'Not currently available'}
          </span>
        </div>
        {rentCents !== null && <div style={{ fontSize: 12, color: theme.textMuted }}>/month + fees may apply</div>}

        <div style={{ marginTop: 8, fontSize: 14, color: theme.text }}>
          {unit && (
            <span>
              {unit.bedrooms ?? '—'} beds | {unit.bathrooms ?? '—'} baths
              {unit.squareFeet ? ` | ${unit.squareFeet} sqft` : ''}
            </span>
          )}
        </div>

        <div style={{ marginTop: 6, fontWeight: 600, color: theme.text }}>{property.title}</div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          {property.addressLine1}, {property.city}, {property.state} {property.zip}
        </div>

        {property.description && (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.textMuted, lineHeight: 1.4 }}>
            {property.description.length > 110 ? `${property.description.slice(0, 110)}…` : property.description}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
          Managed by {property.landlordDisplayName}
        </div>
      </div>
    </Link>
  );
}
