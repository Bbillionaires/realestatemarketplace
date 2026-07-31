import { ReactNode } from 'react';
import { theme } from '../lib/theme';
import { NavBar } from './NavBar';

export function InfoPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 26, color: theme.text, marginBottom: subtitle ? 6 : 20, letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {subtitle && <p style={{ color: theme.textMuted, fontSize: 15, marginTop: 0, marginBottom: 24 }}>{subtitle}</p>}
        <div style={{ fontSize: 15, lineHeight: 1.7, color: theme.text }}>{children}</div>
      </div>
    </main>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, color: theme.text, marginBottom: 8 }}>{heading}</h2>
      <div style={{ color: theme.textMuted }}>{children}</div>
    </section>
  );
}
