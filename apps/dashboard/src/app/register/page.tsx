'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { theme } from '../../lib/theme';
import { PasswordInput } from '../../components/PasswordInput';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'PROSPECTIVE_TENANT', label: "I'm looking for a place to rent" },
  { value: 'LANDLORD', label: 'I own property I want to list' },
  { value: 'PROPERTY_MANAGER', label: 'I manage property for an owner' },
  { value: 'EMPLOYER', label: "I'm hiring and want to reach tenants on the platform" },
];

const SERVICE_PROVIDER_QUESTIONS: {
  key: 'hasLawnCareProvider' | 'hasPlumbingProvider' | 'hasHandymanProvider' | 'hasPestControlProvider' | 'hasRoofingProvider';
  label: string;
}[] = [
  { key: 'hasLawnCareProvider', label: 'Do you have someone to cut the grass / lawn care?' },
  { key: 'hasPlumbingProvider', label: 'Do you have a plumber?' },
  { key: 'hasHandymanProvider', label: 'Do you have a handyman for minor, non-permitted work?' },
  { key: 'hasPestControlProvider', label: 'Do you have pest control?' },
  { key: 'hasRoofingProvider', label: 'Do you have a roofer?' },
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(ROLE_OPTIONS[0].value);
  const [serviceAnswers, setServiceAnswers] = useState<Record<string, boolean>>({});
  const [requestsPropertyManagementHelp, setRequestsPropertyManagementHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens } = useAuth();
  const router = useRouter();

  const isLandlord = role === 'LANDLORD';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.register({
        email,
        password,
        displayName,
        role,
        ...(isLandlord && {
          hasLawnCareProvider: !!serviceAnswers.hasLawnCareProvider,
          hasPlumbingProvider: !!serviceAnswers.hasPlumbingProvider,
          hasHandymanProvider: !!serviceAnswers.hasHandymanProvider,
          hasPestControlProvider: !!serviceAnswers.hasPestControlProvider,
          hasRoofingProvider: !!serviceAnswers.hasRoofingProvider,
          requestsPropertyManagementHelp,
        }),
      });
      setTokens(tokens);
      router.push('/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
    fontFamily: 'inherit',
  };

  return (
    <main style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          maxWidth: 420,
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
        <h1 style={{ fontSize: 20, marginTop: 20, marginBottom: 20, color: theme.text }}>Create your account</h1>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
            Full name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={120}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
            Password
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              minLength={12}
              autoComplete="new-password"
              style={inputStyle}
            />
            <span style={{ display: 'block', marginTop: 4, fontWeight: 400, color: theme.textMuted }}>
              At least 12 characters.
            </span>
          </label>
          <div style={{ marginBottom: 18 }}>
            <span style={{ display: 'block', marginBottom: 8, fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>
              I am signing up as
            </span>
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  border: `1px solid ${role === opt.value ? theme.primary : theme.border}`,
                  borderRadius: 8,
                  marginBottom: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  background: role === opt.value ? theme.primaryLight : 'white',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={role === opt.value}
                  onChange={() => setRole(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {isLandlord && (
            <div style={{ marginBottom: 18, padding: 14, background: theme.bg, borderRadius: 8 }}>
              <span style={{ display: 'block', marginBottom: 10, fontSize: 13, color: theme.text, fontWeight: 700 }}>
                A few questions about your property
              </span>
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0, marginBottom: 10 }}>
                If you don't already have a provider for something below, we may be able to connect you with one.
              </p>
              {SERVICE_PROVIDER_QUESTIONS.map((q) => (
                <label key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!serviceAnswers[q.key]}
                    onChange={(e) => setServiceAnswers((prev) => ({ ...prev, [q.key]: e.target.checked }))}
                  />
                  {q.label}
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                <input
                  type="checkbox"
                  checked={requestsPropertyManagementHelp}
                  onChange={(e) => setRequestsPropertyManagementHelp(e.target.checked)}
                />
                I'd like help finding a property manager
              </label>
            </div>
          )}

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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p style={{ marginTop: 18, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: theme.primary, fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
