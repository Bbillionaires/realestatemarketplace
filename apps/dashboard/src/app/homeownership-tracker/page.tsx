'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, HomeownershipMilestone, HomeownershipProgress } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

export default function HomeownershipTrackerPage() {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [milestones, setMilestones] = useState<HomeownershipMilestone[]>([]);
  const [progress, setProgress] = useState<HomeownershipProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingsGoal, setSavingsGoal] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    Promise.all([api.listActiveMilestones(accessToken), api.getHomeownershipProgress(accessToken)])
      .then(([ms, p]) => {
        setMilestones(ms);
        setProgress(p);
        setSavingsGoal(p.savingsGoalCents != null ? (p.savingsGoalCents / 100).toString() : '');
        setCurrentSavings(p.currentSavingsCents != null ? (p.currentSavingsCents / 100).toString() : '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your tracker'))
      .finally(() => setLoading(false));
  }, [accessToken, isLoading, router]);

  async function onSaveSavings(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const goal = savingsGoal.trim();
      const current = currentSavings.trim();
      const updated = await api.updateHomeownershipProgress(accessToken, {
        savingsGoalCents: goal ? Math.round(Number(goal) * 100) : undefined,
        currentSavingsCents: current ? Math.round(Number(current) * 100) : undefined,
      });
      setProgress(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your savings');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMilestone(milestoneId: string, completed: boolean) {
    if (!accessToken || !progress) return;
    const previous = progress;
    setProgress({
      ...progress,
      completedMilestoneIds: completed
        ? [...progress.completedMilestoneIds, milestoneId]
        : progress.completedMilestoneIds.filter((id) => id !== milestoneId),
    });
    try {
      const updated = completed
        ? await api.markMilestoneComplete(accessToken, milestoneId)
        : await api.unmarkMilestoneComplete(accessToken, milestoneId);
      setProgress(updated);
    } catch (err) {
      setProgress(previous);
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    }
  }

  const goalCents = progress?.savingsGoalCents ?? null;
  const currentCents = progress?.currentSavingsCents ?? null;
  const progressPct = goalCents && goalCents > 0 ? Math.min(100, Math.round(((currentCents ?? 0) / goalCents) * 100)) : null;

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Homeownership Progress Tracker</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Track your savings and check off milestones toward buying a home. This is self-reported and private to
          your account — it isn't connected to a credit bureau or lender.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {!loading && progress && (
          <>
            <form
              onSubmit={onSaveSavings}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                padding: 24,
                marginBottom: 20,
                display: 'grid',
                gap: 14,
              }}
            >
              <h2 style={{ fontSize: 16, color: theme.text, margin: 0 }}>Savings</h2>
              <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
                Savings goal
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={savingsGoal}
                  onChange={(e) => setSavingsGoal(e.target.value)}
                  placeholder="e.g. 15000"
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
                Current savings
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={currentSavings}
                  onChange={(e) => setCurrentSavings(e.target.value)}
                  placeholder="e.g. 4200"
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </label>

              {progressPct !== null && (
                <div>
                  <div style={{ height: 10, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: theme.primary }} />
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{progressPct}% of your goal</div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: 'fit-content' }}
              >
                {busy ? 'Saving...' : 'Save savings'}
              </button>
            </form>

            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 16, color: theme.text, marginTop: 0, marginBottom: 14 }}>Milestones</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {milestones.map((m) => {
                  const completed = progress.completedMilestoneIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.border}`,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={completed}
                        onChange={(e) => toggleMilestone(m.id, e.target.checked)}
                      />
                      <span style={{ fontSize: 14, color: theme.text, textDecoration: completed ? 'line-through' : 'none' }}>
                        {m.label}
                      </span>
                    </label>
                  );
                })}
                {milestones.length === 0 && <p style={{ color: theme.textMuted, margin: 0 }}>No milestones yet — check back soon.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
