'use client';

import { useEffect, useState } from 'react';
import { InfoPage } from '../../components/InfoPage';
import { theme } from '../../lib/theme';

const STORAGE_KEY = 'hqs-checklist-v1';

const CHECKLIST_ITEMS: string[] = [
  'No peeling, chipping, or flaking paint anywhere (required if the home was built before 1978)',
  'Every GFCI outlet near a water source (kitchen, bathroom, exterior) trips and resets properly',
  'All windows open, close, and lock; window screens are intact where present',
  'Smoke detectors installed on every level and inside/near each bedroom, and they work',
  'A carbon monoxide detector is installed if there is a gas appliance or attached garage',
  'No exposed or frayed electrical wiring anywhere in the unit',
  'The heating system turns on and heats the unit (and the water heater works)',
  'No visible signs of pests, mold, or standing water',
  'Handrails are secure on any stairs with 4+ steps',
  'All doors to the exterior lock and latch properly',
];

export default function HqsChecklistPage() {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      // localStorage unavailable — checklist just won't persist, no big deal.
    }
  }, []);

  function toggle(index: number) {
    const next = { ...checked, [index]: !checked[index] };
    setChecked(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore — nothing to recover from if storage is blocked.
    }
  }

  const completedCount = Object.values(checked).filter(Boolean).length;

  return (
    <InfoPage
      title="HUD HQS Fast-Track Checklist"
      subtitle="Walk through this before requesting your move-in inspection so it passes on the first attempt."
    >
      <p style={{ color: theme.textMuted, fontSize: 14 }}>
        {completedCount} of {CHECKLIST_ITEMS.length} checked — this list is saved on this device only, it isn't sent
        anywhere.
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {CHECKLIST_ITEMS.map((item, index) => (
          <label
            key={index}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              padding: 14,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!checked[index]}
              onChange={() => toggle(index)}
              style={{ marginTop: 3, width: 16, height: 16 }}
            />
            <span
              style={{
                fontSize: 14,
                color: checked[index] ? theme.textMuted : theme.text,
                textDecoration: checked[index] ? 'line-through' : 'none',
              }}
            >
              {item}
            </span>
          </label>
        ))}
      </div>
      <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 20 }}>
        This checklist covers common HQS failure points but isn't a substitute for the official inspection standard.
        When you're ready, a landlord can request a professional HQS pre-inspection walkthrough from their property
        page.
      </p>
    </InfoPage>
  );
}
