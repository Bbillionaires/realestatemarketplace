'use client';

import { useState } from 'react';
import { theme } from '../lib/theme';

export function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: `1px solid ${theme.border}`,
          overflowX: 'auto',
          marginBottom: 16,
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              whiteSpace: 'nowrap',
              color: i === active ? theme.primary : theme.textMuted,
              fontWeight: i === active ? 600 : 400,
              borderBottom: i === active ? `2px solid ${theme.primary}` : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs[active].content}</div>
    </div>
  );
}
