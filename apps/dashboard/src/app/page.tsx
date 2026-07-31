import Link from 'next/link';
import { theme } from '../lib/theme';

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: theme.primary, letterSpacing: '-0.02em', marginBottom: 12 }}>
          Affordable Home Match
        </h1>
        <p style={{ color: theme.textMuted, fontSize: 15, lineHeight: 1.6 }}>
          Landlords and tenants communicate through the platform relay — never sharing real phone
          numbers directly.
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/register"
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              background: theme.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
          <Link
            href="/properties"
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Browse properties
          </Link>
        </div>
      </div>
    </main>
  );
}
