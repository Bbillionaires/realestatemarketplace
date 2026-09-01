// PLACEHOLDER DATA — replace with real, current housing authority / case
// worker contact info before relying on this page. Entries below are
// examples only and have not been verified.
export interface HousingAuthorityContact {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  note?: string;
}

export const HOUSING_AUTHORITIES: HousingAuthorityContact[] = [
  {
    name: 'Jacksonville Housing Authority (example)',
    phone: '(904) 555-0100',
    website: 'https://www.jaxha.org',
    note: 'Placeholder contact — confirm current phone/website before publishing.',
  },
  {
    name: 'Your Local Housing Authority (example)',
    note: 'Add your area’s housing authority name, phone, email, and website here.',
  },
];
