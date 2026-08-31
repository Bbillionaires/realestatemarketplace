import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Owner Guide: How to List Your Property for Section 8 & HUD Vouchers',
  description:
    'Step-by-step guide to listing affordable housing rentals, becoming a Section 8 landlord, passing a HUD Housing Quality Standards inspection, and using guaranteed rent programs for landlords.',
};

export default function OwnerGuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
