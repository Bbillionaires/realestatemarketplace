'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, PropertySummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { formatMoney, primaryUnit } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { PhotoPlaceholder } from '../../../components/PhotoPlaceholder';
import { Tabs } from '../../../components/Tabs';
import { NavBar } from '../../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

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

  return (
    <main style={{ minHeight: '100vh', background: theme.bg, paddingBottom: canMessageLandlord ? 90 : 24 }}>
      <NavBar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <Link href="/properties" style={{ color: theme.primary, fontSize: 14, textDecoration: 'none' }}>
          ← Back to results
        </Link>

        <div style={{ marginTop: 12 }}>
          <PhotoPlaceholder height={260} />
        </div>

        <div style={{ marginTop: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{property.title}</h1>
          <p style={{ color: theme.textMuted, margin: '4px 0 12px' }}>
            {property.addressLine1}
            {property.addressLine2 ? `, ${property.addressLine2}` : ''}, {property.city}, {property.state}{' '}
            {property.zip}
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{formatMoney(rentCents)}</span>
            {rentCents !== null && <span style={{ color: theme.textMuted, fontSize: 13 }}>/month + fees may apply</span>}
            {unit && (
              <span style={{ color: theme.text, fontSize: 14 }}>
                {unit.bedrooms ?? '—'} beds | {unit.bathrooms ?? '—'} baths
                {unit.squareFeet ? ` | ${unit.squareFeet} sqft` : ''}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, background: theme.card, borderRadius: 10, border: `1px solid ${theme.border}`, padding: 16 }}>
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
                  </dl>
                ),
              },
              {
                label: 'Fees',
                content: (
                  <dl style={{ fontSize: 14, color: theme.text, display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 10 }}>
                    <dt style={{ color: theme.textMuted }}>Monthly rent</dt>
                    <dd style={{ margin: 0 }}>{formatMoney(rentCents)}</dd>
                    <dt style={{ color: theme.textMuted }}>Security deposit</dt>
                    <dd style={{ margin: 0 }}>{formatMoney(property.depositCents)}</dd>
                    <dt style={{ color: theme.textMuted }}>Est. move-in total</dt>
                    <dd style={{ margin: 0 }}>
                      {rentCents !== null && property.depositCents !== null
                        ? formatMoney(rentCents + property.depositCents)
                        : 'Contact for pricing'}
                    </dd>
                  </dl>
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
