import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Affordable Home Match | HUD, Voucher & Second-Chance Housing',
    template: '%s | Affordable Home Match',
  },
  description:
    'Connecting HUD, housing choice voucher, and second-chance renters with landlords nationwide. Browse Section 8 housing, HUD-approved apartments, and no-credit-check rentals, or list your property and start accepting housing vouchers today.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f5f6f8' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
