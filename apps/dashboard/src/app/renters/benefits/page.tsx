import { InfoPage, InfoSection } from '../../../components/InfoPage';

export default function RenterBenefitsPage() {
  return (
    <InfoPage title="Benefits for Renters" subtitle="What you get when you search and message landlords through Affordable Home Match.">
      <InfoSection heading="Your contact info stays private">
        <p>
          Every conversation with a landlord goes through our platform relay. Your real phone number is never
          shared until you choose to move forward — messages, showing requests, and updates all happen in one
          inbox.
        </p>
      </InfoSection>
      <InfoSection heading="See the whole picture on a listing">
        <p>
          Beyond price and photos, listings show whether a landlord offers rent-to-own, lease-to-own, seller
          financing, a work-for-rent exchange, or allows a tenant lease swap — so you know your options before you
          reach out.
        </p>
      </InfoSection>
      <InfoSection heading="Join a waitlist instead of missing out">
        <p>
          If a property isn't available right now, join its waiting list. Landlords review the queue in the order
          tenants joined, so you don't have to keep checking back.
        </p>
      </InfoSection>
      <InfoSection heading="Moderated for safety">
        <p>
          Messages are automatically screened for scam patterns and requests to move communication off-platform,
          so you can search with confidence.
        </p>
      </InfoSection>
      <InfoSection heading="Section 8, vouchers, and second-chance housing in one place">
        <p>
          Whether you're searching for Section 8 housing near you, landlords that accept housing vouchers, or
          second-chance apartments open to no-credit-check and eviction-friendly applications, every listing on
          Affordable Home Match tells you upfront whether it's a fit — no more guessing before you apply.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
