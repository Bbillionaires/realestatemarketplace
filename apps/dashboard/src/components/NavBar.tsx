'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { theme } from '../lib/theme';

export function NavBar() {
  const { setTokens } = useAuth();
  const router = useRouter();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: theme.card,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <Link href="/properties" style={{ fontWeight: 700, color: theme.primary, textDecoration: 'none' }}>
        Relay Messaging Platform
      </Link>
      <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <Link href="/properties" style={{ color: theme.text, textDecoration: 'none', fontSize: 14 }}>
          Properties
        </Link>
        <Link href="/inbox" style={{ color: theme.text, textDecoration: 'none', fontSize: 14 }}>
          Inbox
        </Link>
        <button
          onClick={() => {
            setTokens(null);
            router.push('/login');
          }}
          style={{
            border: 'none',
            background: 'none',
            color: theme.textMuted,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
