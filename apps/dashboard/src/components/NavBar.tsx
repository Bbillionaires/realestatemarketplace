'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useCurrentUser } from '../lib/use-current-user';
import { theme } from '../lib/theme';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];
const ADMIN_ROLES = ['ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];
const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

interface NavLink {
  href: string;
  label: string;
}

const RENTER_LINKS: NavLink[] = [
  { href: '/renters/benefits', label: 'Benefits' },
  { href: '/properties', label: 'Rental Properties' },
  { href: '/properties?type=APARTMENT', label: 'Apartments for rent' },
  { href: '/properties?type=HOUSE', label: 'Houses for rent' },
  { href: '/section8', label: 'Section 8 Housing' },
  { href: '/waitlists', label: 'Waiting Lists' },
];

const OWNER_LINKS: NavLink[] = [
  { href: '/owners/benefits', label: 'Benefits' },
  { href: '/properties/new', label: 'List Your Property' },
  { href: '/rental-estimate', label: 'Rental Estimate' },
  { href: '/pricing', label: 'Plans & Pricing' },
];

const AGENCY_LINKS: NavLink[] = [{ href: '/agencies', label: 'Agencies' }];

const INFO_LINKS: NavLink[] = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/owner-guide', label: 'Owner Guide' },
];

function SectionHeader({ children }: { children: string }) {
  return (
    <div
      style={{
        background: theme.bg,
        color: theme.text,
        fontWeight: 700,
        fontSize: 13,
        padding: '10px 20px',
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

function DrawerLink({ href, label, onClick }: NavLink & { onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="nav-drawer-link"
      style={{
        display: 'block',
        padding: '12px 20px',
        color: theme.text,
        textDecoration: 'none',
        fontSize: 15,
      }}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const { accessToken, setTokens } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const isLender = !!user && user.role === 'LENDER';
  const isTenant = !!user && TENANT_ROLES.includes(user.role);
  const isLoggedIn = !!accessToken;

  function close() {
    setDrawerOpen(false);
  }

  function signOut() {
    setTokens(null);
    close();
    router.push('/login');
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: theme.card,
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: '0 1px 3px rgba(21, 34, 56, 0.04)',
        }}
      >
        <Link
          href="/properties"
          style={{ fontWeight: 800, fontSize: 17, color: theme.primary, textDecoration: 'none', letterSpacing: '-0.01em' }}
        >
          Affordable Home Match
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            border: `1px solid ${theme.border}`,
            background: 'white',
            borderRadius: 8,
            width: 40,
            height: 36,
            fontSize: 18,
            cursor: 'pointer',
            color: theme.text,
          }}
        >
          ☰
        </button>
      </header>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={close}
            style={{ position: 'absolute', inset: 0, background: 'rgba(21, 34, 56, 0.35)' }}
          />
          <div
            className="nav-drawer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              background: 'white',
              boxShadow: '2px 0 12px rgba(21, 34, 56, 0.15)',
              overflowY: 'auto',
            }}
          >
            <div style={{ background: theme.primary, padding: '16px 20px' }}>
              <button
                onClick={close}
                aria-label="Close menu"
                style={{ border: 'none', background: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            </div>

            <SectionHeader>For Renters</SectionHeader>
            {RENTER_LINKS.map((l) => (
              <DrawerLink key={l.href + l.label} {...l} onClick={close} />
            ))}

            <SectionHeader>For Owners</SectionHeader>
            {OWNER_LINKS.map((l) => (
              <DrawerLink key={l.href + l.label} {...l} onClick={close} />
            ))}

            <SectionHeader>For Agencies</SectionHeader>
            {AGENCY_LINKS.map((l) => (
              <DrawerLink key={l.href + l.label} {...l} onClick={close} />
            ))}

            <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 8 }}>
              {INFO_LINKS.map((l) => (
                <DrawerLink key={l.href + l.label} {...l} onClick={close} />
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 8, paddingBottom: 20 }}>
              {isLoggedIn ? (
                <>
                  <DrawerLink href="/inbox" label="Inbox" onClick={close} />
                  {isStaff && <DrawerLink href="/moderation" label="Moderation" onClick={close} />}
                  {isAdmin && <DrawerLink href="/admin/lenders" label="Lender Assignments" onClick={close} />}
                  {isLender && <DrawerLink href="/lender" label="Lender Dashboard" onClick={close} />}
                  {isTenant && <DrawerLink href="/lender-requests" label="Lender Requests" onClick={close} />}
                  <button
                    onClick={signOut}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 20px',
                      border: 'none',
                      background: 'none',
                      color: theme.textMuted,
                      fontSize: 15,
                      cursor: 'pointer',
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <DrawerLink href="/login" label="Sign in" onClick={close} />
                  <DrawerLink href="/register" label="Sign up" onClick={close} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
