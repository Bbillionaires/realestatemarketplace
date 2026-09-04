// Jacksonville Housing Authority's published Small Area Fair Market Rent
// (SAFMR) Payment Standards, effective 10/01/2025 — every zip code Duval
// County's SAFMR program covers (47 zips), one figure per bedroom size
// (0=studio through 6="6 or more", matching JaxHA's own published table,
// which — unlike HUD's own national FMR schedule that stops at 4BR —
// publishes distinct 5BR/6BR standards for larger voucher households).
// These dollar amounts are JaxHA's *payment standards* (already the
// area's HUD SAFMR adjusted by JaxHA's own 95%-110% "PS" policy percentage
// per zip), not the raw SAFMR — i.e. exactly the number a voucher holder
// needs to compare their rent against, matching what this feature is named.
//
// Source: Jacksonville Housing Authority, "SAFMR Payment Standards
// Effective 10/01/2025" (jaxha.org/safmr-program-effective-april-1-2018 →
// jaxha.org/plugins/show_image.php?id=1906), cross-referenced against the
// zip list on jaxha.org/payment-standards-map. HUD's own nationwide FY2026
// FMR Schedule (huduser.gov/portal/datasets/fmr/fmr2026/FY2026_FMR_Schedule.pdf)
// is the underlying national baseline JaxHA's SAFMRs derive from, but is
// published at the metro/county level, not by zip — Duval County uses
// SAFMRs specifically because rents vary too much within it for one
// county-wide figure, so the zip-level JaxHA table is the correct source
// for this feature, not the county schedule.
//
// Shared between prisma/seed.ts (fresh databases) and a data-refresh
// migration's data-load (existing databases) so the two never drift apart.
export const PAYMENT_STANDARDS_EFFECTIVE_DATE = '2025-10-01';

export const PAYMENT_STANDARDS: { zip: string; rents: [number, number, number, number, number, number, number] }[] = [
  { zip: '32003', rents: [1890, 1920, 2310, 2850, 3570, 4284, 4820] },
  { zip: '32033', rents: [1637, 1676, 2009, 2530, 3107, 3692, 4154] },
  { zip: '32043', rents: [1343, 1373, 1646, 2030, 2545, 3054, 3436] },
  { zip: '32065', rents: [1548, 1587, 1891, 2332, 2920, 3576, 4023] },
  { zip: '32068', rents: [1400, 1431, 1720, 2121, 2657, 3188, 3587] },
  { zip: '32073', rents: [1380, 1411, 1689, 2080, 2605, 3126, 3517] },
  { zip: '32080', rents: [1581, 1611, 1938, 2386, 2998, 3597, 4047] },
  { zip: '32081', rents: [1870, 1970, 2340, 2930, 3710, 4552, 5009] },
  { zip: '32082', rents: [1810, 1840, 2210, 2720, 3410, 4092, 4604] },
  { zip: '32084', rents: [1282, 1301, 1567, 1928, 2422, 2906, 3270] },
  { zip: '32086', rents: [1470, 1500, 1800, 2220, 2780, 3336, 3753] },
  { zip: '32092', rents: [2020, 2060, 2470, 3040, 3820, 4584, 5157] },
  { zip: '32095', rents: [1311, 1339, 1605, 1976, 2479, 2975, 3347] },
  { zip: '32202', rents: [1243, 1265, 1870, 1870, 2343, 2812, 3163] },
  { zip: '32204', rents: [1265, 1287, 1551, 1914, 2398, 2878, 3231] },
  { zip: '32205', rents: [1230, 1260, 1510, 1860, 2330, 2796, 3145] },
  { zip: '32206', rents: [1034, 1056, 1265, 1562, 1958, 2346, 2643] },
  { zip: '32207', rents: [1266, 1287, 1545, 1905, 2389, 2866, 3225] },
  { zip: '32208', rents: [1298, 1331, 1595, 1969, 2464, 2956, 3326] },
  { zip: '32209', rents: [1078, 1100, 1320, 1628, 2035, 2442, 2747] },
  { zip: '32210', rents: [1150, 1170, 1410, 1740, 2180, 2616, 2845] },
  { zip: '32211', rents: [1221, 1243, 1496, 1848, 2310, 2772, 3118] },
  { zip: '32212', rents: [1940, 1980, 2380, 2930, 3680, 4416, 4968] },
  { zip: '32216', rents: [1250, 1270, 1530, 1890, 2360, 2832, 3186] },
  { zip: '32217', rents: [1243, 1265, 1518, 1870, 2343, 2811, 3163] },
  { zip: '32218', rents: [1360, 1390, 1670, 2060, 2580, 3096, 3483] },
  { zip: '32219', rents: [1150, 1170, 1410, 1740, 2180, 2616, 2943] },
  { zip: '32220', rents: [1342, 1364, 1639, 2024, 2530, 3036, 3416] },
  { zip: '32221', rents: [1570, 1600, 1920, 2370, 2970, 3564, 4009] },
  { zip: '32222', rents: [1630, 1670, 2000, 2460, 3090, 3708, 4171] },
  { zip: '32223', rents: [1470, 1500, 1800, 2220, 2780, 3336, 3753] },
  { zip: '32224', rents: [1580, 1610, 1930, 2380, 2980, 3576, 4023] },
  { zip: '32225', rents: [1580, 1610, 1930, 2380, 2980, 3576, 4023] },
  { zip: '32226', rents: [2030, 2070, 2490, 3070, 3850, 4620, 5197] },
  { zip: '32227', rents: [1850, 1910, 2270, 2840, 3600, 4320, 4860] },
  { zip: '32233', rents: [1420, 1450, 1740, 2140, 2690, 3228, 3631] },
  { zip: '32234', rents: [1012, 1034, 1243, 1529, 1914, 2296, 2583] },
  { zip: '32244', rents: [1400, 1420, 1710, 2110, 2640, 3168, 3564] },
  { zip: '32246', rents: [1586, 1624, 1947, 2403, 3011, 3613, 4064] },
  { zip: '32250', rents: [1810, 2210, 2720, 3410, 3410, 4092, 4603] },
  { zip: '32254', rents: [1166, 1188, 1430, 1760, 2211, 2653, 2984] },
  { zip: '32256', rents: [1630, 1670, 2000, 2460, 3090, 3708, 4028] },
  { zip: '32257', rents: [1320, 1350, 1620, 2000, 2500, 3000, 3375] },
  { zip: '32258', rents: [1830, 1870, 2240, 2760, 3460, 4152, 4671] },
  { zip: '32259', rents: [2030, 2070, 2490, 3070, 3850, 4620, 5197] },
  { zip: '32266', rents: [1494, 1525, 1828, 2253, 2828, 3393, 3817] },
  { zip: '32277', rents: [1353, 1375, 1650, 2035, 2552, 3062, 3445] },
];
