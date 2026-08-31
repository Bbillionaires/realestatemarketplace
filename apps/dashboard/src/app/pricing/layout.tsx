import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plans & Pricing for Landlords',
  description:
    'Free listings for landlords accepting housing vouchers, with Pro and Unlimited plans for portfolio owners running guaranteed rent programs across multiple properties.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
