import { InfoPage, InfoSection } from '../../components/InfoPage';

export default function OwnerGuidePage() {
  return (
    <InfoPage title="Owner Guide" subtitle="A quick walkthrough of managing a listing on Affordable Home Match.">
      <InfoSection heading="1. Create your listing">
        <p>
          From the menu, choose "List Your Property" under For Owners. Fill in the address, rent, and any
          optional details like pet policy or Section 8 voucher acceptance.
        </p>
      </InfoSection>
      <InfoSection heading="2. Set your listing options">
        <p>
          On the property page, open "Listing options" to flag whether you're open to rent-to-own, lease-to-own,
          seller financing, a work-for-rent exchange, a tenant lease swap, or note that the property may sell
          soon.
        </p>
      </InfoSection>
      <InfoSection heading="3. Respond to tenant messages">
        <p>
          Every inquiry lands in your Inbox. Replies go through the platform relay, so you never have to share
          your personal phone number.
        </p>
      </InfoSection>
      <InfoSection heading="4. Schedule showings">
        <p>Propose a showing time directly from a conversation thread, and the tenant can accept a slot that works for them.</p>
      </InfoSection>
      <InfoSection heading="5. Manage your waitlist">
        <p>
          If your property is full, tenants can join its waiting list. Review the queue from the property page to
          see who's interested, in the order they joined.
        </p>
      </InfoSection>
      <InfoSection heading="6. Delegate to a manager">
        <p>Assign a property manager to help run day-to-day communication on a listing, and revoke that access any time.</p>
      </InfoSection>
      <InfoSection heading="7. Become a Section 8 landlord">
        <p>
          Learning how to list property for Section 8 starts with flagging your listing as accepting housing
          vouchers, which puts it in front of renters actively searching for HUD-approved apartments. Many owners
          find that guaranteed rent programs for landlords make accepting housing vouchers a reliable source of
          monthly income — weigh the pros and cons of accepting housing vouchers for your situation before deciding.
        </p>
        <p>
          If your unit needs to meet HUD Housing Quality Standards before a housing authority will approve it, use
          the HQS pre-inspection service from your property page: it walks through the same HUD Housing Quality
          Standards inspection checklist an official inspector uses, so you can fix issues ahead of time instead of
          failing the real inspection.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
