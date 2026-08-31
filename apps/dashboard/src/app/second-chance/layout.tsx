import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Second-Chance Apartments | No Credit Check & Eviction-Friendly Rentals',
  description:
    'Second-chance apartments from private landlords open to no-credit-check applications, past evictions, and bad-credit rental history. Browse eviction-friendly apartments nationwide.',
};

export default function SecondChanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
