'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api,
  BedSummary,
  NearbySchool,
  PropertySummary,
  SewerSourceType,
  UnitListingType,
  UnitSummary,
  UpdatePropertyPayload,
  UtilityType,
  WaitlistEntry,
  WaterSourceType,
} from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatMoney, primaryUnit } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { PhotoPlaceholder } from '../../../components/PhotoPlaceholder';
import { Tabs } from '../../../components/Tabs';
import { NavBar } from '../../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

const LISTING_OPTIONS: { flag: keyof UpdatePropertyPayload; label: string; hint: string }[] = [
  { flag: 'acceptsSection8Vouchers', label: 'Accepts Section 8 Vouchers', hint: 'Housing Choice Voucher tenants are welcome to apply.' },
  { flag: 'rentToOwnAvailable', label: 'Rent-to-Own', hint: 'Tenant may apply rent toward eventual purchase.' },
  { flag: 'leaseToOwnAvailable', label: 'Lease-to-Own', hint: 'Lease includes an option to buy at term end.' },
  { flag: 'sellerFinancingAvailable', label: 'Seller Financing', hint: 'You would finance the purchase directly for a buyer.' },
  { flag: 'workForRentAvailable', label: 'Work for Rent', hint: 'Willing to exchange labor/work for reduced or free rent.' },
  { flag: 'tenantSwapAllowed', label: 'Tenant Swap Allowed', hint: 'Current tenant may swap leases with an equally qualified tenant.' },
  { flag: 'subleaseAllowed', label: 'Subleasing Allowed', hint: 'Tenant may sublease the unit to another party.' },
  { flag: 'landlordPaysElectricity', label: 'Landlord Pays Electricity', hint: 'Electric bill is covered by the landlord, not the tenant.' },
  { flag: 'landlordPaysWater', label: 'Landlord Pays Water', hint: 'Water bill is covered by the landlord, not the tenant.' },
];

const UTILITY_OPTIONS: { value: UtilityType; label: string }[] = [
  { value: 'GAS', label: 'Gas' },
  { value: 'TRASH', label: 'Trash' },
  { value: 'LAWN_SERVICE', label: 'Lawn service' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'CABLE', label: 'Cable' },
  { value: 'PARKING', label: 'Parking' },
];

const SCHOOL_LEVEL_LABEL: Record<string, string> = {
  PRESCHOOL: 'Preschool',
  ELEMENTARY: 'Elementary',
  MIDDLE: 'Middle school',
  HIGH: 'High school',
  OTHER: 'School',
};

const SCHOOL_TYPE_LABEL: Record<string, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  CHARTER: 'Charter',
  OTHER: 'Other',
};

const LISTING_TYPE_LABEL: Record<string, string> = {
  ENTIRE_PLACE: 'Entire place',
  PRIVATE_ROOM: 'Private room',
  SHARED_ROOM: 'Shared room',
};

const LISTING_TYPE_OPTIONS: { value: UnitListingType; label: string }[] = [
  { value: 'ENTIRE_PLACE', label: 'Entire place' },
  { value: 'PRIVATE_ROOM', label: 'Private room' },
  { value: 'SHARED_ROOM', label: 'Shared room (rented bed-by-bed)' },
];

function toMonthInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 7);
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, isLoading: authLoading } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();

  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [composerOpen, setComposerOpen] = useState(false);
  const [messageText, setMessageText] = useState(
    'Is this property still available? I would love to schedule a tour.',
  );
  const [sending, setSending] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<UpdatePropertyPayload>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [messageTarget, setMessageTarget] = useState<{ unitId?: string; bedId?: string; label?: string } | null>(null);

  const [schools, setSchools] = useState<NearbySchool[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [schoolsRefreshing, setSchoolsRefreshing] = useState(false);

  const [myWaitlistEntry, setMyWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [waitlistNote, setWaitlistNote] = useState('');
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistQueue, setWaitlistQueue] = useState<WaitlistEntry[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .getProperty(accessToken, id)
      .then(setProperty)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load property'))
      .finally(() => setLoading(false));
  }, [accessToken, authLoading, id, router]);

  useEffect(() => {
    if (!accessToken) return;
    setSchoolsLoading(true);
    api
      .listNearbySchools(accessToken, id)
      .then(setSchools)
      .catch((err) => setSchoolsError(err instanceof Error ? err.message : 'Failed to load nearby schools'))
      .finally(() => setSchoolsLoading(false));
  }, [accessToken, id]);

  async function handleRefreshSchools() {
    if (!accessToken) return;
    setSchoolsRefreshing(true);
    setSchoolsError(null);
    try {
      const updated = await api.refreshNearbySchools(accessToken, id);
      setSchools(updated);
    } catch (err) {
      setSchoolsError(err instanceof Error ? err.message : 'Failed to refresh nearby schools');
    } finally {
      setSchoolsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!accessToken || !user) return;
    if (TENANT_ROLES.includes(user.role)) {
      api
        .listMyWaitlists(accessToken)
        .then((entries) => setMyWaitlistEntry(entries.find((e) => e.propertyId === id) ?? null))
        .catch(() => undefined);
    }
  }, [accessToken, user, id]);

  useEffect(() => {
    if (!accessToken || !property || property.ownerId === undefined) return;
    api
      .listPropertyWaitlist(accessToken, property.id)
      .then(setWaitlistQueue)
      .catch(() => undefined);
  }, [accessToken, property]);

  async function joinWaitlist() {
    if (!accessToken) return;
    setWaitlistBusy(true);
    setWaitlistError(null);
    try {
      const entry = await api.joinWaitlist(accessToken, id, waitlistNote || undefined);
      setMyWaitlistEntry(entry);
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : 'Failed to join the waitlist');
    } finally {
      setWaitlistBusy(false);
    }
  }

  async function leaveWaitlist() {
    if (!accessToken) return;
    setWaitlistBusy(true);
    setWaitlistError(null);
    try {
      await api.leaveWaitlist(accessToken, id);
      setMyWaitlistEntry(null);
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : 'Failed to leave the waitlist');
    } finally {
      setWaitlistBusy(false);
    }
  }

  function openEditPanel() {
    if (!property) return;
    setEditForm({
      acceptsSection8Vouchers: property.acceptsSection8Vouchers,
      amenities: property.amenities ?? '',
      utilitiesIncluded: property.utilitiesIncluded,
      sewerSource: property.sewerSource ?? undefined,
      waterSource: property.waterSource ?? undefined,
      landlordPaysElectricity: property.landlordPaysElectricity,
      landlordPaysWater: property.landlordPaysWater,
      subleaseAllowed: property.subleaseAllowed,
      currentLeaseEndDate: toMonthInput(property.currentLeaseEndDate),
      sellingSoon: property.sellingSoon,
      sellingSoonNote: property.sellingSoonNote ?? '',
      rentToOwnAvailable: property.rentToOwnAvailable,
      leaseToOwnAvailable: property.leaseToOwnAvailable,
      sellerFinancingAvailable: property.sellerFinancingAvailable,
      workForRentAvailable: property.workForRentAvailable,
      tenantSwapAllowed: property.tenantSwapAllowed,
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function saveEditPanel() {
    if (!accessToken || !property) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await api.updateProperty(accessToken, property.id, {
        ...editForm,
        currentLeaseEndDate: editForm.currentLeaseEndDate ? `${editForm.currentLeaseEndDate}-01T00:00:00.000Z` : undefined,
      });
      setProperty(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  }

  function toggleEditUtility(value: UtilityType) {
    setEditForm((f) => {
      const current = f.utilitiesIncluded ?? [];
      return {
        ...f,
        utilitiesIncluded: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  async function refreshProperty() {
    if (!accessToken) return;
    const refreshed = await api.getProperty(accessToken, id);
    setProperty(refreshed);
  }

  async function handleCreateUnit(payload: Parameters<typeof api.createUnit>[2]) {
    if (!accessToken) return;
    await api.createUnit(accessToken, id, payload);
    await refreshProperty();
  }

  async function handleUpdateUnit(unitId: string, payload: Parameters<typeof api.updateUnit>[3]) {
    if (!accessToken) return;
    await api.updateUnit(accessToken, id, unitId, payload);
    await refreshProperty();
  }

  async function handleCreateBed(unitId: string, payload: Parameters<typeof api.createBed>[3]) {
    if (!accessToken) return;
    await api.createBed(accessToken, id, unitId, payload);
    await refreshProperty();
  }

  async function handleUpdateBed(unitId: string, bedId: string, payload: Parameters<typeof api.updateBed>[4]) {
    if (!accessToken) return;
    await api.updateBed(accessToken, id, unitId, bedId, payload);
    await refreshProperty();
  }

  function openComposerFor(target: { unitId?: string; bedId?: string; label?: string } | null) {
    setMessageTarget(target);
    setGuidance(null);
    setSendError(null);
    setComposerOpen(true);
  }

  async function submitMessage() {
    if (!accessToken) return;
    setSending(true);
    setGuidance(null);
    setSendError(null);
    try {
      const result = await api.startConversation(accessToken, {
        propertyId: id,
        unitId: messageTarget?.unitId,
        bedId: messageTarget?.bedId,
        message: messageText,
      });
      if (result.delivered) {
        router.push(`/conversations/${result.conversation.id}`);
      } else {
        setGuidance(result.guidance ?? 'Your message was not delivered. Please edit and try again.');
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (error || !property) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24, color: theme.danger }}>{error ?? 'Property not found'}</p>
      </main>
    );
  }

  const unit = primaryUnit(property.units);
  const rentCents = unit?.rentCents ?? property.monthlyRentCents;
  const canMessageLandlord = !!user && TENANT_ROLES.includes(user.role);
  const canManage = property.ownerId !== undefined;
  const willingToSell = property.rentToOwnAvailable || property.leaseToOwnAvailable || property.sellerFinancingAvailable;
  const activePerks = LISTING_OPTIONS.filter((o) => property[o.flag as keyof PropertySummary]);
  // Only worth a dedicated section when the property is actually broken
  // into individually-priced rooms/beds — a single ENTIRE_PLACE unit is
  // already fully represented by the headline price/bed/bath line above.
  const hasRoomLevelListings =
    property.units.length > 1 || property.units.some((u) => u.listingType !== 'ENTIRE_PLACE' || u.beds.length > 0);

  return (
    <main style={{ minHeight: '100vh', background: theme.bg, paddingBottom: canMessageLandlord ? 90 : 24 }}>
      <NavBar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <Link href="/properties" style={{ color: theme.primary, fontSize: 14, textDecoration: 'none' }}>
          ← Back to results
        </Link>

        <div style={{ marginTop: 12 }}>
          <PhotoPlaceholder height={300} photoUrl={property.photoUrl} radius={theme.radius} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, margin: 0, color: theme.text, letterSpacing: '-0.01em' }}>
              {willingToSell && (
                <span title="Owner may be willing to sell to the tenant" style={{ color: theme.gold, marginRight: 6 }}>
                  ★
                </span>
              )}
              {property.title}
            </h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: property.isActive ? theme.success : theme.textMuted,
                background: property.isActive ? theme.successBg : theme.bg,
                padding: '5px 10px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              {property.isActive ? '● Available Now' : 'Not currently available'}
            </span>
          </div>
          <p style={{ color: theme.textMuted, margin: '4px 0 12px', fontSize: 14 }}>
            {property.addressLine1}
            {property.addressLine2 ? `, ${property.addressLine2}` : ''}, {property.city}, {property.state}{' '}
            {property.zip}
          </p>

          {(property.sellingSoon || activePerks.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {property.sellingSoon && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.warningText,
                    background: theme.warningBg,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  Selling Soon
                </span>
              )}
              {activePerks.map((p) => (
                <span
                  key={p.flag}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.primaryDark,
                    background: theme.primaryLight,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: theme.text, letterSpacing: '-0.02em' }}>
              {formatMoney(rentCents)}
            </span>
            {rentCents !== null && <span style={{ color: theme.textMuted, fontSize: 13 }}>/month + fees may apply</span>}
            {unit && (
              <span style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>
                {unit.bedrooms ?? '—'} beds | {unit.bathrooms ?? '—'} baths
                {unit.squareFeet ? ` | ${unit.squareFeet} sqft` : ''}
              </span>
            )}
          </div>
        </div>

        {hasRoomLevelListings && (
          <AvailableRooms
            units={property.units}
            canMessage={canMessageLandlord}
            onMessageAbout={(target) => openComposerFor(target)}
          />
        )}

        <div style={{ marginTop: 24, background: theme.card, borderRadius: theme.radius, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 16 }}>
          <Tabs
            tabs={[
              {
                label: 'Overview',
                content: (
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: theme.text }}>
                    {property.description ?? 'No description provided.'}
                  </div>
                ),
              },
              {
                label: 'Details',
                content: (
                  <dl style={{ fontSize: 14, color: theme.text, display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 10 }}>
                    <dt style={{ color: theme.textMuted }}>Bedrooms</dt>
                    <dd style={{ margin: 0 }}>{unit?.bedrooms ?? 'Not specified'}</dd>
                    <dt style={{ color: theme.textMuted }}>Bathrooms</dt>
                    <dd style={{ margin: 0 }}>{unit?.bathrooms ?? 'Not specified'}</dd>
                    <dt style={{ color: theme.textMuted }}>Square feet</dt>
                    <dd style={{ margin: 0 }}>{unit?.squareFeet ?? 'Not specified'}</dd>
                    <dt style={{ color: theme.textMuted }}>Pet policy</dt>
                    <dd style={{ margin: 0 }}>{property.petPolicy ?? 'Not specified'}</dd>
                    <dt style={{ color: theme.textMuted }}>Amenities</dt>
                    <dd style={{ margin: 0 }}>{property.amenities ?? 'Not specified'}</dd>
                    <dt style={{ color: theme.textMuted }}>Sewer</dt>
                    <dd style={{ margin: 0 }}>
                      {property.sewerSource === 'CITY_SEWER'
                        ? 'City sewer'
                        : property.sewerSource === 'SEPTIC'
                          ? 'Septic'
                          : 'Not specified'}
                    </dd>
                    <dt style={{ color: theme.textMuted }}>Water source</dt>
                    <dd style={{ margin: 0 }}>
                      {property.waterSource === 'CITY_WATER'
                        ? 'City water'
                        : property.waterSource === 'WELL'
                          ? 'Well'
                          : 'Not specified'}
                    </dd>
                    <dt style={{ color: theme.textMuted }}>Electricity</dt>
                    <dd style={{ margin: 0 }}>{property.landlordPaysElectricity ? 'Paid by landlord' : 'Paid by tenant'}</dd>
                    <dt style={{ color: theme.textMuted }}>Water bill</dt>
                    <dd style={{ margin: 0 }}>{property.landlordPaysWater ? 'Paid by landlord' : 'Paid by tenant'}</dd>
                    <dt style={{ color: theme.textMuted }}>Other utilities covered by landlord</dt>
                    <dd style={{ margin: 0 }}>
                      {property.utilitiesIncluded.length > 0
                        ? property.utilitiesIncluded
                            .map((u) => UTILITY_OPTIONS.find((o) => o.value === u)?.label ?? u)
                            .join(', ')
                        : 'None'}
                    </dd>
                    <dt style={{ color: theme.textMuted }}>Subleasing</dt>
                    <dd style={{ margin: 0 }}>{property.subleaseAllowed ? 'Allowed' : 'Not allowed'}</dd>
                    <dt style={{ color: theme.textMuted }}>Current lease ends</dt>
                    <dd style={{ margin: 0 }}>
                      {property.currentLeaseEndDate
                        ? new Date(property.currentLeaseEndDate).toLocaleDateString(undefined, {
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'Not specified'}
                    </dd>
                    <dt style={{ color: theme.textMuted }}>Availability</dt>
                    <dd style={{ margin: 0 }}>
                      {(unit?.isAvailable ?? property.isActive) ? 'Available now' : 'Not currently available'}
                    </dd>
                    <dt style={{ color: theme.textMuted }}>Section 8 Vouchers</dt>
                    <dd style={{ margin: 0 }}>{property.acceptsSection8Vouchers ? 'Accepted' : 'Not accepted'}</dd>
                    <dt style={{ color: theme.textMuted }}>Rent-to-Own</dt>
                    <dd style={{ margin: 0 }}>{property.rentToOwnAvailable ? 'Available' : 'Not offered'}</dd>
                    <dt style={{ color: theme.textMuted }}>Lease-to-Own</dt>
                    <dd style={{ margin: 0 }}>{property.leaseToOwnAvailable ? 'Available' : 'Not offered'}</dd>
                    <dt style={{ color: theme.textMuted }}>Seller Financing</dt>
                    <dd style={{ margin: 0 }}>{property.sellerFinancingAvailable ? 'Available' : 'Not offered'}</dd>
                    <dt style={{ color: theme.textMuted }}>Work for Rent</dt>
                    <dd style={{ margin: 0 }}>{property.workForRentAvailable ? 'Available' : 'Not offered'}</dd>
                    <dt style={{ color: theme.textMuted }}>Tenant Lease Swap</dt>
                    <dd style={{ margin: 0 }}>{property.tenantSwapAllowed ? 'Allowed' : 'Not allowed'}</dd>
                    {property.sellingSoon && (
                      <>
                        <dt style={{ color: theme.textMuted }}>Selling Soon</dt>
                        <dd style={{ margin: 0 }}>{property.sellingSoonNote || 'Landlord may list this property for sale soon.'}</dd>
                      </>
                    )}
                  </dl>
                ),
              },
              {
                label: 'Fees',
                content: (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 10 }}>Your Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: theme.border, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: theme.bg, padding: '12px 16px', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, letterSpacing: '0.03em' }}>MONTHLY RENT</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginTop: 2 }}>{formatMoney(rentCents)}</div>
                      </div>
                      <div style={{ background: theme.bg, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, letterSpacing: '0.03em' }}>MOVE-IN FEES</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 2 }}>
                          {rentCents !== null && property.depositCents !== null
                            ? formatMoney(rentCents + property.depositCents)
                            : 'Contact for pricing'}
                        </div>
                      </div>
                      <div style={{ background: theme.bg, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, letterSpacing: '0.03em' }}>SECURITY DEPOSIT</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 2 }}>
                          {formatMoney(property.depositCents)}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                label: 'Location',
                content: (
                  <div style={{ fontSize: 14, color: theme.text }}>
                    <p style={{ marginTop: 0 }}>
                      {property.addressLine1}, {property.city}, {property.state} {property.zip}
                    </p>
                    <p style={{ color: theme.textMuted }}>
                      Exact showing details and directions are shared through the conversation once a tour is
                      scheduled.
                    </p>
                  </div>
                ),
              },
              {
                label: 'Schools',
                content: (
                  <div style={{ fontSize: 14, color: theme.text }}>
                    {canManage && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                        <button
                          onClick={handleRefreshSchools}
                          disabled={schoolsRefreshing}
                          style={{
                            border: `1px solid ${theme.border}`,
                            background: 'white',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {schoolsRefreshing ? 'Refreshing...' : 'Refresh schools'}
                        </button>
                      </div>
                    )}
                    {schoolsError && <p style={{ color: theme.danger, fontSize: 13 }}>{schoolsError}</p>}
                    {schoolsLoading ? (
                      <p style={{ color: theme.textMuted }}>Loading nearby schools...</p>
                    ) : schools.length === 0 ? (
                      <p style={{ color: theme.textMuted }}>
                        No nearby school data yet for this listing.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {schools.map((school) => (
                          <div
                            key={school.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: theme.bg,
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700 }}>{school.name}</div>
                              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                                {SCHOOL_LEVEL_LABEL[school.level] ?? school.level} ·{' '}
                                {SCHOOL_TYPE_LABEL[school.schoolType] ?? school.schoolType}
                                {school.distanceMiles !== null ? ` · ${school.distanceMiles.toFixed(1)} mi` : ''}
                              </div>
                              {school.address && (
                                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{school.address}</div>
                              )}
                            </div>
                            {school.rating !== null && (
                              <div
                                style={{
                                  flexShrink: 0,
                                  minWidth: 40,
                                  textAlign: 'center',
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  background: theme.primaryLight,
                                  color: theme.primary,
                                  fontWeight: 800,
                                  fontSize: 14,
                                }}
                              >
                                {school.rating}
                                <span style={{ fontSize: 10, fontWeight: 600 }}>/10</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ color: theme.textMuted, fontSize: 11, marginTop: 12 }}>
                      School data and ratings are provided for reference only and may not reflect current
                      boundaries or enrollment. Confirm with the school district before relying on it.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {canManage && (
          <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Listing options</h3>
              {!editOpen && (
                <button
                  onClick={openEditPanel}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    background: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {!editOpen && (
              <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>
                Manage whether this property is selling soon, and whether rent-to-own, lease-to-own, seller
                financing, work-for-rent, or tenant lease swaps are available to prospective and current tenants.
              </p>
            )}

            {editOpen && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={!!editForm.sellingSoon}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sellingSoon: e.target.checked,
                        sellingSoonNote: e.target.checked ? f.sellingSoonNote : '',
                      }))
                    }
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong>Selling Soon</strong>
                    <div style={{ color: theme.textMuted, fontSize: 12 }}>
                      Let tenants know this property may go up for sale in the near future.
                    </div>
                  </span>
                </label>
                {editForm.sellingSoon && (
                  <textarea
                    value={editForm.sellingSoonNote ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, sellingSoonNote: e.target.value }))}
                    placeholder="Optional note, e.g. expected timeline"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      marginBottom: 14,
                    }}
                  />
                )}

                {LISTING_OPTIONS.map((opt) => (
                  <label key={opt.flag} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={!!editForm[opt.flag]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [opt.flag]: e.target.checked }))}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <strong>{opt.label}</strong>
                      <div style={{ color: theme.textMuted, fontSize: 12 }}>{opt.hint}</div>
                    </span>
                  </label>
                ))}

                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Amenities</label>
                  <textarea
                    value={editForm.amenities ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, amenities: e.target.value }))}
                    placeholder="e.g. in-unit washer/dryer, pool access, fenced yard"
                    rows={2}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13, fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Sewer</label>
                    <select
                      value={editForm.sewerSource ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, sewerSource: (e.target.value || undefined) as SewerSourceType | undefined }))
                      }
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14 }}
                    >
                      <option value="">Not specified</option>
                      <option value="CITY_SEWER">City sewer</option>
                      <option value="SEPTIC">Septic</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Water source</label>
                    <select
                      value={editForm.waterSource ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, waterSource: (e.target.value || undefined) as WaterSourceType | undefined }))
                      }
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14 }}
                    >
                      <option value="">Not specified</option>
                      <option value="CITY_WATER">City water</option>
                      <option value="WELL">Well</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Other utilities covered by landlord
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {UTILITY_OPTIONS.map((opt) => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={(editForm.utilitiesIncluded ?? []).includes(opt.value)}
                          onChange={() => toggleEditUtility(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Current lease end date, if occupied
                  </label>
                  <input
                    type="month"
                    value={editForm.currentLeaseEndDate ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, currentLeaseEndDate: e.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14 }}
                  />
                </div>

                {editError && <p style={{ color: theme.danger, fontSize: 13 }}>{editError}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={saveEditPanel}
                    disabled={editSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: theme.primary,
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {editSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => setEditOpen(false)}
                    disabled={editSaving}
                    style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {canManage && (
          <UnitsManager
            units={property.units}
            onCreateUnit={handleCreateUnit}
            onUpdateUnit={handleUpdateUnit}
            onCreateBed={handleCreateBed}
            onUpdateBed={handleUpdateBed}
          />
        )}

        {canMessageLandlord && (
          <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Waiting List</h3>
            {myWaitlistEntry ? (
              <>
                <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>
                  You're on the waiting list for this property{myWaitlistEntry.note ? `: "${myWaitlistEntry.note}"` : '.'}
                </p>
                {waitlistError && <p style={{ color: theme.danger, fontSize: 13 }}>{waitlistError}</p>}
                <button
                  onClick={leaveWaitlist}
                  disabled={waitlistBusy}
                  style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', cursor: 'pointer', fontSize: 13 }}
                >
                  {waitlistBusy ? 'Leaving...' : 'Leave waiting list'}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 10 }}>
                  Not available right now? Join the waiting list to be considered when a unit opens up.
                </p>
                <textarea
                  value={waitlistNote}
                  onChange={(e) => setWaitlistNote(e.target.value)}
                  placeholder="Optional note for the landlord"
                  rows={2}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13, fontFamily: 'inherit', marginBottom: 10 }}
                />
                {waitlistError && <p style={{ color: theme.danger, fontSize: 13 }}>{waitlistError}</p>}
                <button
                  onClick={joinWaitlist}
                  disabled={waitlistBusy}
                  style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  {waitlistBusy ? 'Joining...' : 'Join waiting list'}
                </button>
              </>
            )}
          </div>
        )}

        {canManage && waitlistQueue && (
          <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Waiting List ({waitlistQueue.length})</h3>
            {waitlistQueue.length === 0 ? (
              <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>No one has joined the waiting list yet.</p>
            ) : (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {waitlistQueue.map((entry, i) => (
                  <div key={entry.id} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: theme.text }}>
                      <span>#{i + 1} {entry.displayName}</span>
                      <span style={{ color: theme.textMuted, fontWeight: 400 }}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.note && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{entry.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 12, color: theme.textMuted }}>
          Managed by {property.landlordDisplayName}
          {willingToSell && (
            <span title="Owner may be willing to sell to the tenant" style={{ color: theme.gold, marginLeft: 4 }}>
              ★
            </span>
          )}
          . All communication happens through the platform relay — real phone numbers are never shared.
        </p>

        {canMessageLandlord && composerOpen && (
          <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Message {property.landlordDisplayName}</h3>
            {messageTarget?.label && (
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: -6, marginBottom: 10 }}>
                About: {messageTarget.label}
              </p>
            )}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit' }}
            />
            {guidance && (
              <p style={{ background: theme.warningBg, color: theme.warningText, padding: 10, borderRadius: 8, fontSize: 13, marginTop: 8 }}>
                {guidance}
              </p>
            )}
            {sendError && <p style={{ color: theme.danger, fontSize: 13 }}>{sendError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={submitMessage}
                disabled={sending || messageText.trim().length === 0}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.primary,
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {sending ? 'Sending...' : guidance ? 'Edit and resend' : 'Send message'}
              </button>
              <button
                onClick={() => setComposerOpen(false)}
                style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>
              Personal contact information cannot be shared through this conversation.
            </p>
          </div>
        )}
      </div>

      {canMessageLandlord && !composerOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: theme.card,
            borderTop: `1px solid ${theme.border}`,
            padding: 12,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => openComposerFor(null)}
            style={{
              width: '100%',
              maxWidth: 900,
              padding: '14px 20px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Message Landlord
          </button>
        </div>
      )}
    </main>
  );
}

/** Read-only, tenant-facing browse of every individually-priced room/bed on the property. */
function AvailableRooms({
  units,
  canMessage,
  onMessageAbout,
}: {
  units: UnitSummary[];
  canMessage: boolean;
  onMessageAbout: (target: { unitId?: string; bedId?: string; label?: string }) => void;
}) {
  return (
    <div style={{ marginTop: 24, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>Available rooms</h3>
      <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 12 }}>
        This property is listed room-by-room rather than as a single rental.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {units.map((u) => (
          <div key={u.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ fontSize: 14 }}>
                {u.unitLabel} — {LISTING_TYPE_LABEL[u.listingType]}
              </strong>
              {u.listingType !== 'SHARED_ROOM' && <span style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(u.rentCents)}</span>}
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {u.bedrooms ?? '—'} beds | {u.bathrooms ?? '—'} baths{u.squareFeet ? ` | ${u.squareFeet} sqft` : ''}
            </div>

            {u.listingType !== 'SHARED_ROOM' && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: u.isAvailable ? theme.success : theme.textMuted }}>
                  {u.isAvailable ? 'Available' : 'Not available'}
                </span>
                {canMessage && u.isAvailable && (
                  <button
                    onClick={() => onMessageAbout({ unitId: u.id, label: `${u.unitLabel} (${LISTING_TYPE_LABEL[u.listingType]})` })}
                    style={{ border: 'none', background: 'none', color: theme.primary, fontSize: 12, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Message about this room
                  </button>
                )}
              </div>
            )}

            {u.listingType === 'SHARED_ROOM' && (
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {u.beds.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>No beds listed yet.</p>}
                {u.beds.map((bed) => (
                  <div key={bed.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 6, padding: '6px 10px' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{bed.bedLabel}</span>{' '}
                      <span style={{ fontSize: 12, color: bed.isAvailable ? theme.success : theme.textMuted, fontWeight: 700 }}>
                        {bed.isAvailable ? 'Available' : 'Not available'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(bed.rentCents)}</span>
                      {canMessage && bed.isAvailable && (
                        <button
                          onClick={() => onMessageAbout({ unitId: u.id, bedId: bed.id, label: `${u.unitLabel} — ${bed.bedLabel}` })}
                          style={{ border: 'none', background: 'none', color: theme.primary, fontSize: 12, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Message about this bed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const unitsManagerInputStyle = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  marginTop: 4,
  borderRadius: 6,
  border: `1px solid ${theme.border}`,
  fontSize: 13,
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};
const unitsManagerLabelStyle = { display: 'block', marginBottom: 10, fontSize: 12, color: theme.textMuted, fontWeight: 600 };

/** Landlord/manager-facing CRUD for every unit on a property, plus beds nested under any SHARED_ROOM unit. */
function UnitsManager({
  units,
  onCreateUnit,
  onUpdateUnit,
  onCreateBed,
  onUpdateBed,
}: {
  units: UnitSummary[];
  onCreateUnit: (payload: {
    unitLabel: string;
    listingType: UnitListingType;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    rentCents?: number;
    isAvailable?: boolean;
  }) => Promise<void>;
  onUpdateUnit: (
    unitId: string,
    payload: Partial<{
      unitLabel: string;
      listingType: UnitListingType;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
      rentCents?: number;
      isAvailable?: boolean;
    }>,
  ) => Promise<void>;
  onCreateBed: (unitId: string, payload: { bedLabel: string; rentCents?: number; isAvailable?: boolean }) => Promise<void>;
  onUpdateBed: (
    unitId: string,
    bedId: string,
    payload: Partial<{ bedLabel: string; rentCents?: number; isAvailable?: boolean }>,
  ) => Promise<void>;
}) {
  const [addingUnit, setAddingUnit] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [addingBedForUnitId, setAddingBedForUnitId] = useState<string | null>(null);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Units & rooms</h3>
        {!addingUnit && (
          <button
            onClick={() => setAddingUnit(true)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Add unit
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 12 }}>
        List the whole place as one unit, or break it into individually-priced rooms — and, for a shared
        room, individually-priced beds.
      </p>

      {addingUnit && (
        <UnitForm
          onSave={async (payload) => {
            await onCreateUnit(payload);
            setAddingUnit(false);
          }}
          onCancel={() => setAddingUnit(false)}
        />
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: addingUnit ? 12 : 0 }}>
        {units.map((u) => (
          <div key={u.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
            {editingUnitId === u.id ? (
              <UnitForm
                initial={u}
                onSave={async (payload) => {
                  await onUpdateUnit(u.id, payload);
                  setEditingUnitId(null);
                }}
                onCancel={() => setEditingUnitId(null)}
              />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14 }}>
                    {u.unitLabel} — {LISTING_TYPE_LABEL[u.listingType]}
                  </strong>
                  <button
                    onClick={() => setEditingUnitId(u.id)}
                    style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  {u.bedrooms ?? '—'} beds | {u.bathrooms ?? '—'} baths{u.squareFeet ? ` | ${u.squareFeet} sqft` : ''}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {formatMoney(u.rentCents)} ·{' '}
                  <span style={{ fontWeight: 700, color: u.isAvailable ? theme.success : theme.textMuted }}>
                    {u.isAvailable ? 'Available' : 'Not available'}
                  </span>
                </div>
              </>
            )}

            {u.listingType === 'SHARED_ROOM' && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>BEDS</span>
                  {addingBedForUnitId !== u.id && (
                    <button
                      onClick={() => setAddingBedForUnitId(u.id)}
                      style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Add bed
                    </button>
                  )}
                </div>

                {addingBedForUnitId === u.id && (
                  <BedForm
                    onSave={async (payload) => {
                      await onCreateBed(u.id, payload);
                      setAddingBedForUnitId(null);
                    }}
                    onCancel={() => setAddingBedForUnitId(null)}
                  />
                )}

                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {u.beds.length === 0 && !addingBedForUnitId && (
                    <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>No beds listed yet.</p>
                  )}
                  {u.beds.map((bed) =>
                    editingBedId === bed.id ? (
                      <BedForm
                        key={bed.id}
                        initial={bed}
                        onSave={async (payload) => {
                          await onUpdateBed(u.id, bed.id, payload);
                          setEditingBedId(null);
                        }}
                        onCancel={() => setEditingBedId(null)}
                      />
                    ) : (
                      <div key={bed.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 6, padding: '6px 10px' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{bed.bedLabel}</span>{' '}
                          <span style={{ fontSize: 12, color: theme.textMuted }}>{formatMoney(bed.rentCents)}</span>{' '}
                          <span style={{ fontSize: 12, fontWeight: 700, color: bed.isAvailable ? theme.success : theme.textMuted }}>
                            {bed.isAvailable ? 'Available' : 'Not available'}
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingBedId(bed.id)}
                          style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UnitForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: UnitSummary;
  onSave: (payload: {
    unitLabel: string;
    listingType: UnitListingType;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    rentCents?: number;
    isAvailable?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [unitLabel, setUnitLabel] = useState(initial?.unitLabel ?? '');
  const [listingType, setListingType] = useState(initial?.listingType ?? 'ENTIRE_PLACE');
  const [bedrooms, setBedrooms] = useState(initial?.bedrooms?.toString() ?? '');
  const [bathrooms, setBathrooms] = useState(initial?.bathrooms?.toString() ?? '');
  const [squareFeet, setSquareFeet] = useState(initial?.squareFeet?.toString() ?? '');
  const [rent, setRent] = useState(initial?.rentCents !== null && initial?.rentCents !== undefined ? (initial.rentCents / 100).toString() : '');
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        unitLabel,
        listingType,
        bedrooms: bedrooms.trim() ? parseInt(bedrooms, 10) : undefined,
        bathrooms: bathrooms.trim() ? parseFloat(bathrooms) : undefined,
        squareFeet: squareFeet.trim() ? parseInt(squareFeet, 10) : undefined,
        rentCents: rent.trim() ? Math.round(parseFloat(rent) * 100) : undefined,
        isAvailable,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save unit');
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Label (e.g. "Bedroom 2")
          <input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} maxLength={60} style={unitsManagerInputStyle} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Listing type
          <select value={listingType} onChange={(e) => setListingType(e.target.value as UnitListingType)} style={unitsManagerInputStyle}>
            {LISTING_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Bedrooms
          <input type="number" min={0} max={20} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={unitsManagerInputStyle} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Bathrooms
          <input type="number" min={0} max={20} step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} style={unitsManagerInputStyle} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Square feet
          <input type="number" min={0} value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} style={unitsManagerInputStyle} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Rent ($/month) {listingType === 'SHARED_ROOM' ? '— set per bed below' : ''}
          <input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} style={unitsManagerInputStyle} disabled={listingType === 'SHARED_ROOM'} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
          Available now
        </label>
      </div>
      {error && <p style={{ color: theme.danger, fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submit}
          disabled={saving || !unitLabel.trim()}
          style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BedForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BedSummary;
  onSave: (payload: { bedLabel: string; rentCents?: number; isAvailable?: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [bedLabel, setBedLabel] = useState(initial?.bedLabel ?? '');
  const [rent, setRent] = useState(initial?.rentCents !== null && initial?.rentCents !== undefined ? (initial.rentCents / 100).toString() : '');
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        bedLabel,
        rentCents: rent.trim() ? Math.round(parseFloat(rent) * 100) : undefined,
        isAvailable,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bed');
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 8, padding: 10, border: `1px solid ${theme.border}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Bed label (e.g. "Bed A")
          <input value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} maxLength={60} style={unitsManagerInputStyle} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1 }}>
          Rent ($/month)
          <input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} style={unitsManagerInputStyle} />
        </label>
        <label style={{ ...unitsManagerLabelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
          Available
        </label>
      </div>
      {error && <p style={{ color: theme.danger, fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submit}
          disabled={saving || !bedLabel.trim()}
          style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
