import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Room & Co-Living Rentals',
  description: 'Browse room and co-living rental listings priced and available by the room, nationwide.',
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
