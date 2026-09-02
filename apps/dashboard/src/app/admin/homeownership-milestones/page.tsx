'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, HomeownershipMilestone } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const ADMIN_ROLES = ['ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

export default function AdminHomeownershipMilestonesPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [milestones, setMilestones] = useState<HomeownershipMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user || !ADMIN_ROLES.includes(user.role)) return;
    api
      .listAllMilestones(accessToken)
      .then(setMilestones)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    setSaving(true);
    try {
      const created = await api.createMilestone(accessToken, {
        label,
        sortOrder: sortOrder.trim() ? Number(sortOrder) : undefined,
      });
      setMilestones((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setLabel('');
      setSortOrder('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create milestone');
    } finally {
      setSaving(false);
    }
  }

  async function updateField(id: string, patch: { label?: string; sortOrder?: number; isActive?: boolean }) {
    if (!accessToken) return;
    try {
      const updated = await api.updateMilestone(accessToken, id, patch);
      setMilestones((prev) => prev.map((m) => (m.id === id ? updated : m)).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      // Leave the row as-is; the user can retry the edit.
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    try {
      await api.deleteMilestone(accessToken, id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
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
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: 6, letterSpacing: '-0.01em' }}>Homeownership Milestones</h1>
        <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>
          Manage the checklist tenants see on their Homeownership Progress Tracker. Inactive milestones stay here for
          reference but no longer show up for tenants, and are unaffected in any tenant's already-completed history.
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
            Label
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              required
              placeholder="e.g. Meet with a HUD-approved housing counselor"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Sort order (optional)
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              style={inputStyle}
            />
          </label>

          {formError && <p style={{ color: theme.danger, fontSize: 13 }}>{formError}</p>}

          <button
            type="submit"
            disabled={saving || !label.trim()}
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
            {saving ? 'Adding...' : 'Add milestone'}
          </button>
        </form>

        <h2 style={{ fontSize: 17, color: theme.text, marginBottom: 12 }}>Current milestones</h2>
        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger }}>{error}</p>}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 10 }}>
            {milestones.map((m) => (
              <div
                key={m.id}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius,
                  boxShadow: theme.shadow,
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  opacity: m.isActive ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    defaultValue={m.label}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== m.label) {
                        updateField(m.id, { label: e.target.value.trim() });
                      }
                    }}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 14 }}
                  />
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.sortOrder}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value) && value !== m.sortOrder) {
                        updateField(m.id, { sortOrder: value });
                      }
                    }}
                    style={{ width: 70, padding: '8px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 14 }}
                  />
                </div>
                <button
                  onClick={() => updateField(m.id, { isActive: !m.isActive })}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
                >
                  {m.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => remove(m.id)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', color: theme.danger, fontSize: 13, cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            ))}
            {milestones.length === 0 && <p style={{ color: theme.textMuted }}>No milestones yet.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
