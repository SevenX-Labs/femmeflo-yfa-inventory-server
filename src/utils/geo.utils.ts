export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geographic bounding box for the Republic of India territory:
 * Lat: 6.5° N to 37.5° N
 * Lng: 68.0° E to 97.5° E
 */
export const INDIA_BOUNDS = {
  MIN_LAT: 6.5,
  MAX_LAT: 37.5,
  MIN_LNG: 68.0,
  MAX_LNG: 97.5,
};

/**
 * Validates whether GPS coordinates fall within valid India territory
 * and rejects Null Island (0, 0).
 */
export function isValidIndianCoordinate(lat: number, lng: number): boolean {
  // Prevent Null Island (0, 0)
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return false;
  }

  return (
    lat >= INDIA_BOUNDS.MIN_LAT &&
    lat <= INDIA_BOUNDS.MAX_LAT &&
    lng >= INDIA_BOUNDS.MIN_LNG &&
    lng <= INDIA_BOUNDS.MAX_LNG
  );
}

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  pointA: GeoCoordinates,
  pointB: GeoCoordinates
): number {
  const EARTH_RADIUS_KM = 6371.0;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(pointA.latitude)) *
      Math.cos(toRadians(pointB.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
