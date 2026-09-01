import Link from 'next/link';
import { PropertySummary } from '../lib/api';
import { formatMoney, primaryUnit } from '../lib/format';
import { theme } from '../lib/theme';
import { PhotoPlaceholder } from './PhotoPlaceholder';

const PERK_BADGES: { flag: keyof PropertySummary; label: string }[] = [
  { flag: 'acceptsSection8Vouchers', label: 'Section 8 OK' },
  { flag: 'hqsPreInspected', label: 'HQS Pre-Inspected' },
  { flag: 'secondChanceFriendly', label: 'Second-Chance Friendly' },
  { flag: 'brokenLeaseOk', label: 'Broken Lease OK' },
  { flag: 'cosignerAccepted', label: 'Cosigner OK' },
  { flag: 'noCreditCheckIncomeOnly', label: 'No Credit Check' },
  { flag: 'hasRoomRentals', label: 'Room Rentals' },
  { flag: 'rentToOwnAvailable', label: 'Rent-to-Own' },
  { flag: 'leaseToOwnAvailable', label: 'Lease-to-Own' },
  { flag: 'sellerFinancingAvailable', label: 'Seller Financing' },
  { flag: 'workForRentAvailable', label: 'Work for Rent' },
  { flag: 'tenantSwapAllowed', label: 'Tenant Swap OK' },
];

// Owner has signaled some path to the tenant eventually owning the home —
// starred prominently rather than folded into the generic perk-badge list.
function isWillingToSellToTenant(property: PropertySummary): boolean {
  return property.rentToOwnAvailable || property.leaseToOwnAvailable || property.sellerFinancingAvailable;
}

export function PropertyCard({ property }: { property: PropertySummary }) {
  const unit = primaryUnit(property.units);
  const rentCents = unit?.rentCents ?? property.monthlyRentCents;
  const available = unit ? unit.isAvailable : property.isActive;
  const perks = PERK_BADGES.filter((p) => property[p.flag]);
  const willingToSell = isWillingToSellToTenant(property);
  const isBoosted = property.boostedUntil !== null && new Date(property.boostedUntil).getTime() > Date.now();

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

        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15, color: theme.text }}>
          {willingToSell && (
            <span title="Owner may be willing to sell to the tenant" style={{ color: theme.gold, marginRight: 4 }}>
              ★
            </span>
          )}
          {property.title}
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {property.addressLine1}, {property.city}, {property.state} {property.zip}
        </div>

        {(isBoosted || property.sellingSoon || perks.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {isBoosted && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.gold,
                  background: theme.primaryLight,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                ★ Featured
              </span>
            )}
            {property.sellingSoon && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.warningText,
                  background: theme.warningBg,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                Selling Soon
              </span>
            )}
            {perks.map((p) => (
              <span
                key={p.flag}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.primaryDark,
                  background: theme.primaryLight,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        )}

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
          {willingToSell && (
            <span title="Owner may be willing to sell to the tenant" style={{ color: theme.gold, marginLeft: 4 }}>
              ★
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
