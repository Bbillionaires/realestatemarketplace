import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Section 8 Housing Near You | HUD-Approved Apartments',
  description:
    'Browse Section 8 housing listings from landlords that accept housing vouchers, including HUD-approved apartments and housing choice voucher rentals nationwide.',
};

export default function Section8Layout({ children }: { children: React.ReactNode }) {
  return children;
}
