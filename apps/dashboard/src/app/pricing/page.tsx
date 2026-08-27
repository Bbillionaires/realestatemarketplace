'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Subscription, SubscriptionTier } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const PLANS: {
  tier: SubscriptionTier;
  name: string;
  price: string;
  description: string;
  features: string[];
}[] = [
  {
    tier: 'FREE',
    name: 'Free',
    price: 'Free',
    description: 'Everything you need to list a property and message tenants through the relay.',
    features: [
      'Unlimited listings',
      'Relay messaging with tenants',
      'Showing scheduling',
      'Listing options (rent-to-own, lease-to-own, seller financing, work-for-rent, tenant swap)',
      'Property waitlists',
    ],
  },
  {
    tier: 'PRO',
    name: 'Landlord Pro',
    price: '$49/mo',
    description: 'For owners who want their listings to stand out and are actively filling vacancies.',
    features: ['Everything in Free', 'Priority support', 'Discounted Featured Listing Boosts (coming soon)'],
  },
  {
    tier: 'UNLIMITED',
    name: 'Landlord Unlimited',
    price: '$99/mo',
    description: 'For portfolio landlords and property managers running multiple listings at once.',
    features: ['Everything in Pro', 'Highest-tier support', 'Early access to new landlord tools'],
  },
];

export default function PricingPage() {
  const { accessToken, isLoading } = useAuth();
  const { user } = useCurrentUser();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<SubscriptionTier | null>(null);

  const isLandlord = user?.role === 'LANDLORD';

  useEffect(() => {
    if (isLoading || !accessToken || !isLandlord) return;
    api.getSubscription(accessToken).then(setSubscription).catch(() => undefined);
  }, [accessToken, isLoading, isLandlord]);

  async function upgrade(tier: 'PRO' | 'UNLIMITED') {
    if (!accessToken) return;
    setError(null);
    setPurchasing(tier);
    try {
      const sub = await api.createSubscriptionCheckout(accessToken, tier);
      if (sub.checkoutUrl) {
        window.location.href = sub.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setPurchasing(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Plans & Pricing</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 8, maxWidth: 640 }}>
          Search is always free for tenants — these plans are for landlords who want extra support or visibility.
        </p>

        {isLandlord && subscription && (
          <div
            style={{
              background: theme.primaryLight,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              padding: '12px 16px',
              marginTop: 16,
              marginBottom: 8,
              fontSize: 13,
              color: theme.primaryDark,
              fontWeight: 600,
            }}
          >
            You're currently on {PLANS.find((p) => p.tier === subscription.tier)?.name ?? subscription.tier}
            {subscription.isActive && subscription.expiresAt && (
              <> — renews or expires {new Date(subscription.expiresAt).toLocaleDateString()}</>
            )}
            .
          </div>
        )}
        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 24 }}>
          {PLANS.map((plan) => {
            const isCurrent = subscription?.tier === plan.tier && (plan.tier === 'FREE' || subscription?.isActive);
            return (
              <div
                key={plan.tier}
                style={{
                  background: theme.card,
                  border: isCurrent ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={{ fontSize: 18, color: theme.text, margin: 0 }}>{plan.name}</h2>
                  <span style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>{plan.price}</span>
                </div>
                <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 8 }}>{plan.description}</p>
                <ul style={{ marginTop: 12, paddingLeft: 18, color: theme.text, fontSize: 14, lineHeight: 1.8, flex: 1 }}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                {plan.tier !== 'FREE' &&
                  (isLandlord ? (
                    <button
                      onClick={() => upgrade(plan.tier as 'PRO' | 'UNLIMITED')}
                      disabled={purchasing !== null || isCurrent}
                      style={{
                        marginTop: 16,
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: isCurrent ? theme.border : theme.primary,
                        color: isCurrent ? theme.textMuted : 'white',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: isCurrent ? 'default' : 'pointer',
                      }}
                    >
                      {isCurrent ? 'Current plan' : purchasing === plan.tier ? 'Starting checkout...' : `Upgrade to ${plan.name}`}
                    </button>
                  ) : (
                    <p style={{ marginTop: 16, fontSize: 12, color: theme.textMuted }}>
                      <Link href="/register" style={{ color: theme.primary, fontWeight: 700 }}>
                        Sign up as a landlord
                      </Link>{' '}
                      to subscribe.
                    </p>
                  ))}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 28 }}>
          Ready to list a property?{' '}
          <Link href="/properties/new" style={{ color: theme.primary, fontWeight: 600, textDecoration: 'none' }}>
            Get started for free
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
