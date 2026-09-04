'use client';

import { CSSProperties, useState } from 'react';
import { theme } from '../lib/theme';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  style?: CSSProperties;
}

/** A password `<input>` with a Show/Hide toggle, so a registrant can confirm what they typed. */
export function PasswordInput({ value, onChange, required, minLength, autoComplete, style }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  // Layout properties (spacing/sizing) belong on the wrapper so the field
  // occupies the same space in the form as a plain <input> would; visual
  // properties (border, padding, font) stay on the input itself.
  const { marginTop, marginBottom, width, ...inputOnlyStyle } = style ?? {};

  return (
    <div style={{ position: 'relative', marginTop, marginBottom, width: width ?? '100%' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ ...inputOnlyStyle, width: '100%', paddingRight: 56 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 4,
          top: 0,
          bottom: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          color: theme.primary,
          padding: '0 10px',
        }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
