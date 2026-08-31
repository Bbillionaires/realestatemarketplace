import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Benefits for Landlords | Guaranteed Rent Programs & Section 8',
  description:
    'Where to post Section 8 rentals and list affordable housing rentals, with guaranteed rent programs for landlords and tools to become a Section 8 landlord with confidence.',
};

export default function OwnerBenefitsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
