// HUD FY2026 Small Area Fair Market Rents (effective 2025-10-01) for the 20
// zip codes HUD designates as Duval County, FL's Small Area FMR zips —
// Duval County uses SAFMRs (a distinct figure per zip code) rather than one
// FMR for the whole Jacksonville, FL HUD Metro FMR Area. Source: HUD USER
// FY2026 SAFMR documentation system (huduser.gov/portal/datasets/fmr/smallarea).
//
// Dollar amounts, one row per (zip, bedrooms). bedrooms: 0=studio, 4="4 or
// more" (HUD's own tables stop at 4). Shared between prisma/seed.ts (fresh
// databases) and the `add_payment_standards` migration's data-load (existing
// databases) so the two never drift apart.
export const PAYMENT_STANDARDS_EFFECTIVE_DATE = '2025-10-01';

export const PAYMENT_STANDARDS: { zip: string; rents: [number, number, number, number, number] }[] = [
  { zip: '32082', rents: [1810, 1840, 2210, 2720, 3410] },
  { zip: '32205', rents: [1230, 1260, 1510, 1860, 2330] },
  { zip: '32207', rents: [1230, 1250, 1500, 1850, 2320] },
  { zip: '32208', rents: [1180, 1210, 1450, 1790, 2240] },
  { zip: '32209', rents: [980, 1000, 1200, 1480, 1850] },
  { zip: '32210', rents: [1150, 1170, 1410, 1740, 2180] },
  { zip: '32211', rents: [1110, 1130, 1360, 1680, 2100] },
  { zip: '32216', rents: [1250, 1270, 1530, 1890, 2360] },
  { zip: '32218', rents: [1360, 1390, 1670, 2060, 2580] },
  { zip: '32221', rents: [1570, 1600, 1920, 2370, 2970] },
  { zip: '32223', rents: [1470, 1500, 1800, 2220, 2780] },
  { zip: '32224', rents: [1580, 1610, 1930, 2380, 2980] },
  { zip: '32225', rents: [1580, 1610, 1930, 2380, 2980] },
  { zip: '32244', rents: [1400, 1420, 1710, 2110, 2640] },
  { zip: '32246', rents: [1670, 1710, 2050, 2530, 3170] },
  { zip: '32250', rents: [1810, 1840, 2210, 2720, 3410] },
  { zip: '32256', rents: [1630, 1670, 2000, 2460, 3090] },
  { zip: '32257', rents: [1320, 1350, 1620, 2000, 2500] },
  { zip: '32258', rents: [1830, 1870, 2240, 2760, 3460] },
  { zip: '32277', rents: [1230, 1250, 1500, 1850, 2320] },
];
