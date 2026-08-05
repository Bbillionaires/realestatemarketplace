const EARTH_RADIUS_MILES = 3958.8;
const MILES_PER_DEGREE_LATITUDE = 69.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/long points, in miles. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * A conservative lat/long bounding box for a given radius, meant as a cheap
 * pre-filter (indexable range query) before computing exact haversineMiles
 * distance on the smaller candidate set — not itself precise near the poles
 * or the antimeridian, neither of which this US rental platform needs to
 * handle.
 */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusMiles / MILES_PER_DEGREE_LATITUDE;
  const milesPerDegreeLongitude = MILES_PER_DEGREE_LATITUDE * Math.cos(toRadians(latitude));
  const lonDelta = milesPerDegreeLongitude > 0 ? radiusMiles / milesPerDegreeLongitude : 180;

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLon: longitude - lonDelta,
    maxLon: longitude + lonDelta,
  };
}
