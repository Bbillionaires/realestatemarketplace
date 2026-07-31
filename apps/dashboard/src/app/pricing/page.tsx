import Link from 'next/link';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const PLANS = [
  {
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
];

export default function PricingPage() {
  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Plans & Pricing</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 8 }}>
          Affordable Home Match is currently free for owners and renters — there is no paid tier today.
        </p>
        <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 0, marginBottom: 28 }}>
          This page describes what's included; it isn't connected to a billing system.
        </p>

        {PLANS.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: 18, color: theme.text, margin: 0 }}>{plan.name}</h2>
              <span style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>{plan.price}</span>
            </div>
            <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 8 }}>{plan.description}</p>
            <ul style={{ marginTop: 12, paddingLeft: 18, color: theme.text, fontSize: 14, lineHeight: 1.8 }}>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}

        <p style={{ fontSize: 14, color: theme.textMuted }}>
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
