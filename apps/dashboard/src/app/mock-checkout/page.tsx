'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { theme } from '../../lib/theme';

function MockCheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const orderId = params.get('orderId') ?? '';
  const amountCents = parseInt(params.get('amountCents') ?? '0', 10);
  const description = params.get('description') ?? 'Convenience fee';
  const redirectUrl = params.get('redirectUrl');

  async function confirmPayment() {
    setBusy(true);
    setError(null);
    try {
      await api.simulateMockPayment(orderId);
      setPaid(true);
      if (redirectUrl) {
        setTimeout(() => router.push(redirectUrl), 900);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to simulate payment');
    } finally {
      setBusy(false);
    }
  }

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
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>
          Development mock checkout
        </p>
        <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 16, color: theme.text }}>{description}</h1>
        <p style={{ fontSize: 28, fontWeight: 800, color: theme.text, marginBottom: 24 }}>
          ${(amountCents / 100).toFixed(2)}
        </p>

        {paid ? (
          <p style={{ color: theme.primary, fontWeight: 600 }}>Payment confirmed — redirecting...</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
              This stands in for Square's hosted checkout in local development. Clicking below simulates a completed
              payment and notifies the API the same way Square's webhook would.
            </p>
            <button
              onClick={confirmPayment}
              disabled={busy || !orderId}
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
              {busy ? 'Processing...' : 'Simulate successful payment'}
            </button>
            {error && <p style={{ color: theme.danger, fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <MockCheckoutContent />
    </Suspense>
  );
}
