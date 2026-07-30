'use client';

import { useState } from 'react';
import { ShowingSummary } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { theme } from '../lib/theme';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Showing requested',
  SLOT_PROPOSED: 'New time proposed',
  SCHEDULED: 'Showing scheduled',
  RESCHEDULE_PROPOSED: 'Reschedule proposed',
  CANCELLED: 'Showing cancelled',
  COMPLETED: 'Showing completed',
  NO_SHOW: 'No-show recorded',
};

export function ShowingPanel({
  showing,
  currentUserId,
  onPropose,
  onAcceptSlot,
  onCancel,
}: {
  showing: ShowingSummary | null;
  currentUserId: string | undefined;
  onPropose: (startTimeLocal: string) => Promise<void>;
  onAcceptSlot: (showingId: string, slotId: string) => Promise<void>;
  onCancel: (showingId: string) => Promise<void>;
}) {
  const [proposedTime, setProposedTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const isOpenShowing = showing && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(showing.status);

  async function submit() {
    if (!proposedTime) return;
    setBusy(true);
    try {
      await onPropose(new Date(proposedTime).toISOString());
      setProposedTime('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>
          {showing ? STATUS_LABEL[showing.status] ?? showing.status : 'Schedule a showing'}
        </strong>
        {isOpenShowing && showing && showing.status !== 'SCHEDULED' && (
          <button
            onClick={() => onCancel(showing.id)}
            style={{ border: 'none', background: 'none', color: theme.danger, fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>

      {showing && showing.timeSlots.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {showing.timeSlots.map((slot) => (
            <div
              key={slot.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                padding: '6px 8px',
                borderRadius: 6,
                background: slot.isSelected ? '#e8f4ea' : '#f5f6f8',
              }}
            >
              <span>
                {formatDateTime(slot.startTime)}
                {slot.isSelected ? ' ✓ confirmed' : ''}
              </span>
              {!slot.isSelected && showing.status !== 'SCHEDULED' && slot.proposedBy !== currentUserId && (
                <button
                  onClick={() => onAcceptSlot(showing.id, slot.id)}
                  style={{
                    border: 'none',
                    background: theme.primary,
                    color: 'white',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Accept
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(!isOpenShowing || showing?.status !== 'SCHEDULED') && (
        <div style={{ marginTop: 10 }}>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              style={{
                border: `1px solid ${theme.border}`,
                background: 'white',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {showing ? 'Propose a different time' : 'Propose a showing time'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="datetime-local"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 13 }}
              />
              <button
                onClick={submit}
                disabled={busy || !proposedTime}
                style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                Propose
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
