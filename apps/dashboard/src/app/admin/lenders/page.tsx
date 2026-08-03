'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LenderAccessTier, LenderAssignment, PropertySummary, UserSummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const ADMIN_ROLES = ['ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

export default function AdminLendersPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [lenders, setLenders] = useState<UserSummary[]>([]);
  const [tenants, setTenants] = useState<UserSummary[]>([]);
  const [assignments, setAssignments] = useState<LenderAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [propertyId, setPropertyId] = useState('');
  const [lenderId, setLenderId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [accessTier, setAccessTier] = useState<LenderAccessTier>('BASIC');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user || !ADMIN_ROLES.includes(user.role)) return;
    Promise.all([
      api.listProperties(accessToken),
      api.listUsers(accessToken, 'LENDER'),
      api.listUsers(accessToken, 'PROSPECTIVE_TENANT'),
      api.listUsers(accessToken, 'CURRENT_TENANT'),
      api.listLenderAssignments(accessToken),
    ])
      .then(([props, lenderUsers, prospective, current, assigns]) => {
        setProperties(props);
        setLenders(lenderUsers);
        setTenants([...prospective, ...current]);
        setAssignments(assigns);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    setSaving(true);
    try {
      const created = await api.createLenderAssignment(accessToken, {
        propertyId,
        lenderId,
        tenantId: tenantId || undefined,
        accessTier,
      });
      setAssignments((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setPropertyId('');
      setLenderId('');
      setTenantId('');
      setAccessTier('BASIC');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    if (!accessToken) return;
    try {
      const updated = await api.revokeLenderAssignment(accessToken, id);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      // Leave the row as-is; the user can retry the click.
    }
  }

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 };

  if (userLoading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    router.push('/properties');
    return null;
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Lender Assignments</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Assign a lender to a property so they can view that property's current tenant and request payment proof.
          Access is centrally controlled here rather than by the landlord.
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <label style={labelStyle}>
            Property
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required style={inputStyle}>
              <option value="" disabled>
                Select a property
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.city}, {p.state}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Lender
            <select value={lenderId} onChange={(e) => setLenderId(e.target.value)} required style={inputStyle}>
              <option value="" disabled>
                Select a lender
              </option>
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.profile?.displayName ?? l.email} ({l.email})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Current tenant (optional)
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={inputStyle}>
              <option value="">None yet</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.profile?.displayName ?? t.email} ({t.email})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Access tier
            <select value={accessTier} onChange={(e) => setAccessTier(e.target.value as LenderAccessTier)} style={inputStyle}>
              <option value="BASIC">Basic</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </label>

          {formError && <p style={{ color: theme.danger, fontSize: 13 }}>{formError}</p>}

          <button
            type="submit"
            disabled={saving || !propertyId || !lenderId}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Assigning...' : 'Assign lender'}
          </button>
        </form>

        <h2 style={{ fontSize: 17, color: theme.text, marginBottom: 12 }}>Current assignments</h2>
        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 10 }}>
            {assignments.map((a) => (
              <div
                key={a.id}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: a.revokedAt ? 0.5 : 1,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                    {a.propertyTitle} → {a.lenderDisplayName}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    Tenant: {a.tenantDisplayName ?? 'None yet'} · Tier: {a.accessTier}
                    {a.revokedAt ? ' · Revoked' : ''}
                  </div>
                </div>
                {!a.revokedAt && (
                  <button
                    onClick={() => revoke(a.id)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
            {assignments.length === 0 && <p style={{ color: theme.textMuted }}>No lender assignments yet.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
