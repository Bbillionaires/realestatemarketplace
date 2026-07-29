'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ConversationSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { formatDateTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const STATUS_LABELS: Record<string, string> = {
  NEW_INQUIRY: 'New inquiry',
  ACTIVE: 'Active',
  SHOWING_REQUESTED: 'Showing requested',
  SHOWING_SCHEDULED: 'Showing scheduled',
  APPLICATION_STARTED: 'Application started',
  APPLICATION_SUBMITTED: 'Application submitted',
  APPLICATION_APPROVED: 'Application approved',
  APPLICATION_DENIED: 'Application denied',
  LEASE_PENDING: 'Lease pending',
  LEASE_SIGNED: 'Lease signed',
  CURRENT_TENANT: 'Current tenant',
  CLOSED: 'Closed',
  BLOCKED: 'Blocked',
  UNDER_REVIEW: 'Under review',
};

export default function InboxPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    api
      .listConversations(accessToken)
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversations'))
      .finally(() => setLoading(false));
  }, [accessToken, authLoading, router]);

  const isTenantView = user?.role === 'PROSPECTIVE_TENANT' || user?.role === 'CURRENT_TENANT';

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Inbox</h1>
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {loading && <p>Loading...</p>}
        {!loading && conversations.length === 0 && !error && (
          <p style={{ color: theme.textMuted }}>
            No conversations yet. Browse <Link href="/properties">properties</Link> and message a landlord to start
            one.
          </p>
        )}
        <div style={{ display: 'grid', gap: 12 }}>
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              style={{
                display: 'block',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{c.property.title}</strong>
                <span style={{ fontSize: 12, color: theme.primary, fontWeight: 600 }}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                {c.property.addressLine1}, {c.property.city}, {c.property.state}
              </div>
              <div style={{ fontSize: 13, color: theme.text, marginTop: 6 }}>
                {isTenantView ? `With ${c.landlordDisplayName}` : `With ${c.tenantDisplayName}`}
              </div>
              {c.lastMessageAt && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                  Last message {formatDateTime(c.lastMessageAt)}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
