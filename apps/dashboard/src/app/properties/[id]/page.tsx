'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, PropertySummary, UpdatePropertyPayload } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatMoney, primaryUnit } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { PhotoPlaceholder } from '../../../components/PhotoPlaceholder';
import { Tabs } from '../../../components/Tabs';
import { NavBar } from '../../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

const LISTING_OPTIONS: { flag: keyof UpdatePropertyPayload; label: string; hint: string }[] = [
  { flag: 'rentToOwnAvailable', label: 'Rent-to-Own', hint: 'Tenant may apply rent toward eventual purchase.' },
  { flag: 'leaseToOwnAvailable', label: 'Lease-to-Own', hint: 'Lease includes an option to buy at term end.' },
  { flag: 'sellerFinancingAvailable', label: 'Seller Financing', hint: 'You would finance the purchase directly for a buyer.' },
  { flag: 'workForRentAvailable', label: 'Work for Rent', hint: 'Willing to exchange labor/work for reduced or free rent.' },
  { flag: 'tenantSwapAllowed', label: 'Tenant Swap Allowed', hint: 'Current tenant may swap leases with an equally qualified tenant.' },
];

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

  function openEditPanel() {
    if (!property) return;
    setEditForm({
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
      const updated = await api.updateProperty(accessToken, property.id, editForm);
      setProperty(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  }

  async function submitMessage() {
    if (!accessToken) return;
    setSending(true);
    setGuidance(null);
    setSendError(null);
    try {
      const result = await api.startConversation(accessToken, { propertyId: id, message: messageText });
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
  const activePerks = LISTING_OPTIONS.filter((o) => property[o.flag as keyof PropertySummary]);

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
            <h1 style={{ fontSize: 24, margin: 0, color: theme.text, letterSpacing: '-0.01em' }}>{property.title}</h1>
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
                    <dt style={{ color: theme.textMuted }}>Availability</dt>
                    <dd style={{ margin: 0 }}>
                      {(unit?.isAvailable ?? property.isActive) ? 'Available now' : 'Not currently available'}
                    </dd>
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

        <p style={{ marginTop: 16, fontSize: 12, color: theme.textMuted }}>
          Managed by {property.landlordDisplayName}. All communication happens through the platform relay — real
          phone numbers are never shared.
        </p>

        {canMessageLandlord && composerOpen && (
          <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Message {property.landlordDisplayName}</h3>
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
            onClick={() => setComposerOpen(true)}
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
