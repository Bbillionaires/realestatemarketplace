import { InfoPage } from '../../components/InfoPage';

export default function AboutPage() {
  return (
    <InfoPage title="About Us">
      <p>
        Affordable Home Match connects renters and property owners through a private messaging relay, so both
        sides can communicate freely without exchanging personal phone numbers until they choose to.
      </p>
      <p>
        We built the platform around flexible listing terms that aren't always front and center on other rental
        sites — rent-to-own, lease-to-own, seller financing, work-for-rent exchanges, and tenant lease swaps — so
        renters and owners can find arrangements that work for their situation.
      </p>
      <p>
        Affordable Home Match is focused on a niche other rental sites treat as an afterthought: Section 8 housing,
        housing choice voucher rentals, and second-chance apartments. Renters can search for HUD-approved
        apartments or no-credit-check listings directly, and landlords can list affordable housing rentals and
        connect with guaranteed rent programs built around housing vouchers.
      </p>
      <p>Every conversation is monitored for scam patterns and off-platform contact requests to help keep both sides safe.</p>
    </InfoPage>
  );
}
