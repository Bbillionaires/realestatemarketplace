import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'Affordable Home Match',
  description: 'Landlord/tenant relay messaging dashboard',
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
