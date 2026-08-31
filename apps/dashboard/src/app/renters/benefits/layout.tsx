import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Benefits for Renters | Section 8, Vouchers & Second-Chance Housing',
  description:
    'Find Section 8 housing, landlords that accept housing vouchers, and second-chance apartments open to no-credit-check and eviction-friendly applications, all in one private inbox.',
};

export default function RenterBenefitsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
