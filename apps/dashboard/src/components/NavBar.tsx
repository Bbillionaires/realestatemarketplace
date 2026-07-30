'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useCurrentUser } from '../lib/use-current-user';
import { theme } from '../lib/theme';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

export function NavBar() {
  const { setTokens } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

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
        {isStaff && (
          <Link href="/moderation" style={{ color: theme.text, textDecoration: 'none', fontSize: 14 }}>
            Moderation
          </Link>
        )}
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
