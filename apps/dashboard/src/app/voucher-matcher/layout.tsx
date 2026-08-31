import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Housing Choice Voucher Rentals | HUD Payment Standard Matcher',
  description:
    'Enter your voucher bedroom allowance and zip code to find HUD-approved apartments and housing choice voucher rentals priced at or below the current payment standard.',
};

export default function VoucherMatcherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
