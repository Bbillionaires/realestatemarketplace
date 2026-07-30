'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [propertyFilter, setPropertyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((c) => map.set(c.property.id, c.property.title));
    return Array.from(map.entries());
  }, [conversations]);

  const statuses = useMemo(() => {
    const set = new Set(conversations.map((c) => c.status));
    return Array.from(set);
  }, [conversations]);

  const filtered = conversations.filter(
    (c) => (!propertyFilter || c.property.id === propertyFilter) && (!statusFilter || c.status === statusFilter),
  );

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Inbox</h1>

        {conversations.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
            >
              <option value="">All properties</option>
              {properties.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {loading && <p>Loading...</p>}
        {!loading && conversations.length === 0 && !error && (
          <p style={{ color: theme.textMuted }}>
            No conversations yet. Browse <Link href="/properties">properties</Link> and message a landlord to start
            one.
          </p>
        )}
        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <p style={{ color: theme.textMuted }}>No conversations match these filters.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              style={{
                display: 'block',
                background: theme.card,
                border: c.hasUnread ? `1px solid ${theme.primary}` : `1px solid ${theme.border}`,
                borderRadius: 10,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                position: 'relative',
              }}
            >
              {c.hasUnread && (
                <span
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: theme.primary,
                  }}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 16 }}>
                <strong style={{ fontWeight: c.hasUnread ? 700 : 600 }}>
                  {c.property.title}
                  {c.unitLabel ? ` · ${c.unitLabel}` : ''}
                </strong>
                <span style={{ fontSize: 12, color: theme.primary, fontWeight: 600 }}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                {c.property.addressLine1}, {c.property.city}, {c.property.state}
              </div>
              <div style={{ fontSize: 13, color: theme.text, marginTop: 6, fontWeight: c.hasUnread ? 600 : 400 }}>
                {isTenantView ? `With ${c.landlordDisplayName}` : `With ${c.tenantDisplayName}`}
              </div>
              {c.lastMessagePreview && (
                <div
                  style={{
                    fontSize: 13,
                    color: c.hasUnread ? theme.text : theme.textMuted,
                    marginTop: 4,
                    fontWeight: c.hasUnread ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.lastMessagePreview}
                </div>
              )}
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
