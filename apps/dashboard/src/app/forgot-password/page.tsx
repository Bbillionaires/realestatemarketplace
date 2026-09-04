'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { theme } from '../../lib/theme';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      // The API responds the same way whether or not the email matches an
      // account — this page must never reveal which, so "submitted" is the
      // only outcome shown for a well-formed request.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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
        <h1 style={{ fontSize: 20, marginTop: 20, marginBottom: 12, color: theme.text }}>Reset your password</h1>

        {submitted ? (
          <p style={{ fontSize: 14, color: theme.text }}>
            If an account exists for that email, we&apos;ve sent a link to reset your password. It&apos;s valid for 1 hour.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 18 }}>
              Enter the email you signed up with and we&apos;ll send you a link to reset your password.
            </p>
            <form onSubmit={onSubmit}>
              <label style={{ display: 'block', marginBottom: 18, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
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
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p style={{ marginTop: 18, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
          <Link href="/login" style={{ color: theme.primary, fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
