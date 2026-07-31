'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens } = useAuth();
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.login(email, password);
      setTokens(tokens);
      router.push('/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
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

  return (
    <main style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          maxWidth: 380,
          width: '100%',
          padding: 32,
          background: theme.card,
          borderRadius: theme.radius,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: theme.primary, textDecoration: 'none' }}>
          Affordable Home Match
        </Link>
        <h1 style={{ fontSize: 20, marginTop: 20, marginBottom: 20, color: theme.text }}>Sign in</h1>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: 'block', marginBottom: 18, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          {error && (
            <p style={{ color: theme.danger, fontSize: 13, background: '#fdecec', padding: '8px 10px', borderRadius: 6 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
