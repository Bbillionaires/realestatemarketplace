'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  AdminNoteSummary,
  ModerationFlagSummary,
  RestrictionSummary,
  ViolationSummary,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useCurrentUser } from '../../lib/use-current-user';
import { formatDateTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { NavBar } from '../../components/NavBar';

const STAFF_ROLES = ['STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

const STATUS_LABELS: Record<string, string> = {
  FLAGGED: 'Flagged',
  UNDER_REVIEW: 'Under review',
  CLEARED: 'Cleared',
  BLOCKED: 'Blocked',
};

const RESTRICTION_LABELS: Record<string, string> = {
  MESSAGING_RESTRICTED: 'Messaging restricted',
  SUSPENDED: 'Suspended',
  BLOCKED: 'Blocked',
};

const statusBadgeColor = (status: string) => {
  if (status === 'CLEARED') return theme.success;
  if (status === 'BLOCKED') return theme.danger;
  return theme.warningText;
};

export default function ModerationPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState('');
  const [flags, setFlags] = useState<ModerationFlagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [violations, setViolations] = useState<ViolationSummary[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionSummary[]>([]);
  const [notes, setNotes] = useState<AdminNoteSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reviewNote, setReviewNote] = useState('');
  const [restrictionType, setRestrictionType] = useState('MESSAGING_RESTRICTED');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [restrictionHours, setRestrictionHours] = useState('24');
  const [newNote, setNewNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.push('/login');
    }
  }, [accessToken, authLoading, router]);

  useEffect(() => {
    if (!accessToken || userLoading) return;
    if (user && !STAFF_ROLES.includes(user.role)) {
      router.push('/inbox');
    }
  }, [accessToken, user, userLoading, router]);

  function loadFlags() {
    if (!accessToken) return;
    setLoading(true);
    api
      .listModerationFlags(accessToken, statusFilter || undefined)
      .then(setFlags)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load flags'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, statusFilter]);

  const selectedFlag = flags.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    if (!accessToken || !selectedFlag?.flaggedUser) {
      setViolations([]);
      setRestrictions([]);
      setNotes([]);
      return;
    }
    setDetailLoading(true);
    const userId = selectedFlag.flaggedUser.id;
    Promise.all([
      api.listUserViolations(accessToken, userId),
      api.listUserRestrictions(accessToken, userId),
      api.listConversationNotes(accessToken, selectedFlag.conversation.id),
    ])
      .then(([v, r, n]) => {
        setViolations(v);
        setRestrictions(r);
        setNotes(n);
      })
      .finally(() => setDetailLoading(false));
  }, [accessToken, selectedFlag?.id]);

  async function reviewFlag(status: string) {
    if (!accessToken || !selectedFlag) return;
    setBusy(true);
    try {
      await api.reviewModerationFlag(accessToken, selectedFlag.id, status, reviewNote || undefined);
      setReviewNote('');
      loadFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review flag');
    } finally {
      setBusy(false);
    }
  }

  async function imposeRestriction() {
    if (!accessToken || !selectedFlag?.flaggedUser || !restrictionReason.trim()) return;
    setBusy(true);
    try {
      const hours = restrictionHours ? parseInt(restrictionHours, 10) : undefined;
      const restriction = await api.imposeRestriction(accessToken, selectedFlag.flaggedUser.id, {
        type: restrictionType,
        reason: restrictionReason,
        durationHours: hours,
      });
      setRestrictions((prev) => [restriction, ...prev]);
      setRestrictionReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to impose restriction');
    } finally {
      setBusy(false);
    }
  }

  async function liftRestriction(id: string) {
    if (!accessToken) return;
    setBusy(true);
    try {
      const updated = await api.liftRestriction(accessToken, id);
      setRestrictions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lift restriction');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!accessToken || !selectedFlag || !newNote.trim()) return;
    setBusy(true);
    try {
      const note = await api.addConversationNote(accessToken, selectedFlag.conversation.id, newNote);
      setNotes((prev) => [note, ...prev]);
      setNewNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setBusy(false);
    }
  }

  if (user && !STAFF_ROLES.includes(user.role)) {
    return null;
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20 }}>Moderation queue</h1>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedId(null);
            }}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
          >
            <option value="">Open (flagged + under review)</option>
            <option value="FLAGGED">Flagged</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="CLEARED">Cleared</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        {error && (
          <p style={{ color: theme.danger, marginBottom: 12 }}>
            {error} <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', color: theme.textMuted, cursor: 'pointer' }}>dismiss</button>
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
          <div>
            {loading && <p>Loading...</p>}
            {!loading && flags.length === 0 && <p style={{ color: theme.textMuted }}>No flags match this filter.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {flags.map((flag) => (
                <button
                  key={flag.id}
                  onClick={() => setSelectedId(flag.id)}
                  style={{
                    textAlign: 'left',
                    background: theme.card,
                    border: flag.id === selectedId ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>{flag.conversation.propertyTitle}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusBadgeColor(flag.status) }}>
                      {STATUS_LABELS[flag.status] ?? flag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                    {flag.flaggedUser?.displayName ?? 'Unknown user'} ({flag.flaggedUser?.role})
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    {flag.flagType} · {flag.detectionMethod} · {Math.round(flag.confidenceScore * 100)}% confidence
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      marginTop: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    &ldquo;{flag.message.originalContent}&rdquo;
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                    {formatDateTime(flag.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            {!selectedFlag && (
              <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20, color: theme.textMuted }}>
                Select a flag to review it.
              </div>
            )}

            {selectedFlag && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
                  <strong style={{ fontSize: 14 }}>Flag detail</strong>
                  <p style={{ fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedFlag.message.originalContent}</p>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    From {selectedFlag.flaggedUser?.displayName} ({selectedFlag.flaggedUser?.email}) ·{' '}
                    {selectedFlag.flagType} via {selectedFlag.detectionMethod}
                  </div>
                  {selectedFlag.decision && (
                    <div style={{ fontSize: 12, marginTop: 8, padding: 8, background: theme.bg, borderRadius: 6 }}>
                      Last decision by {selectedFlag.reviewedByName}: {selectedFlag.decision}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Optional note for this decision"
                      rows={2}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        disabled={busy}
                        onClick={() => reviewFlag('CLEARED')}
                        style={{ border: 'none', background: theme.success, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => reviewFlag('UNDER_REVIEW')}
                        style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                      >
                        Mark under review
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => reviewFlag('BLOCKED')}
                        style={{ border: 'none', background: theme.danger, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                      >
                        Confirm block
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
                  <strong style={{ fontSize: 14 }}>Violation history ({violations.length})</strong>
                  {detailLoading && <p style={{ fontSize: 12, color: theme.textMuted }}>Loading...</p>}
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {violations.map((v) => (
                      <div key={v.id} style={{ fontSize: 12, color: theme.textMuted }}>
                        {formatDateTime(v.createdAt)} · {v.violationType} ({v.detectionMethod}) → {v.actionTaken}
                      </div>
                    ))}
                    {violations.length === 0 && !detailLoading && (
                      <span style={{ fontSize: 12, color: theme.textMuted }}>No prior violations.</span>
                    )}
                  </div>
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
                  <strong style={{ fontSize: 14 }}>Restrictions</strong>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {restrictions.map((r) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ color: r.isActive ? theme.danger : theme.textMuted }}>
                          {RESTRICTION_LABELS[r.type] ?? r.type} — {r.reason} ({formatDateTime(r.startsAt)}
                          {r.endsAt ? ` until ${formatDateTime(r.endsAt)}` : ', indefinite'})
                          {r.isActive ? ' · active' : r.liftedAt ? ' · lifted' : ' · expired'}
                        </span>
                        {r.isActive && (
                          <button
                            disabled={busy}
                            onClick={() => liftRestriction(r.id)}
                            style={{ border: `1px solid ${theme.border}`, background: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                          >
                            Lift
                          </button>
                        )}
                      </div>
                    ))}
                    {restrictions.length === 0 && (
                      <span style={{ fontSize: 12, color: theme.textMuted }}>No restrictions on record.</span>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={restrictionType}
                        onChange={(e) => setRestrictionType(e.target.value)}
                        style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
                      >
                        <option value="MESSAGING_RESTRICTED">Messaging restricted</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={restrictionHours}
                        onChange={(e) => setRestrictionHours(e.target.value)}
                        placeholder="Hours (blank = indefinite)"
                        style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12, width: 160 }}
                      />
                    </div>
                    <input
                      type="text"
                      value={restrictionReason}
                      onChange={(e) => setRestrictionReason(e.target.value)}
                      placeholder="Reason for this restriction"
                      style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
                    />
                    <button
                      disabled={busy || !restrictionReason.trim()}
                      onClick={imposeRestriction}
                      style={{ justifySelf: 'start', border: 'none', background: theme.primaryDark, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Impose restriction
                    </button>
                  </div>
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
                  <strong style={{ fontSize: 14 }}>Admin notes on this conversation</strong>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {notes.map((n) => (
                      <div key={n.id} style={{ fontSize: 12 }}>
                        <span style={{ color: theme.textMuted }}>
                          {n.authorName} · {formatDateTime(n.createdAt)}
                        </span>
                        <div>{n.note}</div>
                      </div>
                    ))}
                    {notes.length === 0 && <span style={{ fontSize: 12, color: theme.textMuted }}>No notes yet.</span>}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add an internal note"
                      style={{ flex: 1, padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12 }}
                    />
                    <button
                      disabled={busy || !newNote.trim()}
                      onClick={addNote}
                      style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
