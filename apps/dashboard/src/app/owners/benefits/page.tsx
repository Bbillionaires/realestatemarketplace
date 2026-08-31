import Link from 'next/link';
import { InfoPage, InfoSection } from '../../../components/InfoPage';
import { theme } from '../../../lib/theme';

export default function OwnerBenefitsPage() {
  return (
    <InfoPage title="Benefits for Owners" subtitle="List a property and manage tenant conversations without giving out your personal number.">
      <InfoSection heading="A relay number, not your own">
        <p>
          Every conversation with a prospective or current tenant is routed through the platform. You keep full
          control of the thread without exposing your personal phone number.
        </p>
      </InfoSection>
      <InfoSection heading="Advertise flexible terms">
        <p>
          Flag a listing as selling soon, rent-to-own, lease-to-own, seller-financed, open to a work-for-rent
          exchange, or open to a tenant lease swap — right from the listing's edit panel.
        </p>
      </InfoSection>
      <InfoSection heading="A queue when you're full">
        <p>
          Let interested tenants join a waiting list for a property that isn't available yet, so you have a
          ready pool of leads the moment a unit opens up.
        </p>
      </InfoSection>
      <InfoSection heading="Delegate without losing oversight">
        <p>
          Assign a property manager to a listing whenever you need help, and revoke access at any time.
        </p>
      </InfoSection>
      <InfoSection heading="Where to post Section 8 rentals">
        <p>
          Affordable Home Match is built to be where owners list affordable housing rentals and reach renters
          searching for guaranteed rent programs for landlords. Flag a listing as voucher-friendly to become a
          Section 8 landlord and start filling vacancies with tenants backed by a housing authority payment.
        </p>
      </InfoSection>
      <p>
        Ready to get started?{' '}
        <Link href="/properties/new" style={{ color: theme.primary, fontWeight: 600, textDecoration: 'none' }}>
          List your property
        </Link>
        .
      </p>
    </InfoPage>
  );
}
