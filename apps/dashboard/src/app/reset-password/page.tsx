'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { theme } from '../../lib/theme';

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
        <h1 style={{ fontSize: 20, marginTop: 20, marginBottom: 18, color: theme.text }}>Set a new password</h1>

        {!token ? (
          <p style={{ color: theme.danger, fontSize: 13 }}>
            This link is missing its reset token. Please use the link from your email, or{' '}
            <Link href="/forgot-password" style={{ color: theme.primary, fontWeight: 600 }}>
              request a new one
            </Link>
            .
          </p>
        ) : done ? (
          <p style={{ fontSize: 14, color: theme.text }}>Your password has been reset. Redirecting to sign in...</p>
        ) : (
          <form onSubmit={onSubmit}>
            <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={12}
                style={inputStyle}
              />
              <span style={{ display: 'block', marginTop: 4, fontWeight: 400, color: theme.textMuted }}>
                At least 12 characters.
              </span>
            </label>
            <label style={{ display: 'block', marginBottom: 18, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                style={inputStyle}
              />
            </label>
            {error && (
              <p style={{ color: theme.danger, fontSize: 13, background: '#fdecec', padding: '8px 10px', borderRadius: 6 }}>
                {error}
                {error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid') ? (
                  <>
                    {' '}
                    <Link href="/forgot-password" style={{ color: theme.danger, fontWeight: 700 }}>
                      Request a new link
                    </Link>
                    .
                  </>
                ) : null}
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
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
