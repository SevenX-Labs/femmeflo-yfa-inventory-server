import { z } from "zod";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geographic bounding box for the Republic of India territory:
 * Lat: 6.5° N to 37.5° N
 * Lng: 68.0° E to 97.5° E
 * (Covers mainland from Kanyakumari to Ladakh, Gujarat to Arunachal Pradesh, and Andaman & Nicobar)
 */
export const INDIA_BOUNDS = {
  MIN_LAT: 6.5,
  MAX_LAT: 37.5,
  MIN_LNG: 68.0,
  MAX_LNG: 97.5,
};

export const GLOBAL_BOUNDS = {
  MIN_LAT: -90,
  MAX_LAT: 90,
  MIN_LNG: -180,
  MAX_LNG: 180,
};

/**
 * Normalizes coordinate input (number or valid numeric string) to a float.
 * Rejects NaN, Infinity, null, undefined, empty strings, and non-numeric inputs.
 */
export function normalizeCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (Number.isNaN(num) || !Number.isFinite(num)) return null;
    return num;
  }
  return null;
}

/**
 * Validates whether GPS coordinates fall within valid India territory
 * and rejects Null Island (0, 0).
 */
export function isValidIndianCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;

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
 * Comprehensive coordinate validator returning detailed error messages.
 */
export function validateCoordinates(
  latInput: unknown,
  lngInput: unknown,
  options: { requireIndia?: boolean; required?: boolean } = { requireIndia: true, required: false }
): { valid: boolean; latitude?: number; longitude?: number; error?: string } {
  if (latInput === undefined && lngInput === undefined) {
    if (options.required) {
      return { valid: false, error: "Latitude and longitude coordinates are required" };
    }
    return { valid: true };
  }

  if (latInput === undefined || latInput === null || latInput === "") {
    return { valid: false, error: "Latitude is required when longitude is provided" };
  }
  if (lngInput === undefined || lngInput === null || lngInput === "") {
    return { valid: false, error: "Longitude is required when latitude is provided" };
  }

  const lat = normalizeCoordinate(latInput);
  const lng = normalizeCoordinate(lngInput);

  if (lat === null) {
    return { valid: false, error: "Latitude must be a valid numeric coordinate" };
  }
  if (lng === null) {
    return { valid: false, error: "Longitude must be a valid numeric coordinate" };
  }

  // Global bounds
  if (lat < GLOBAL_BOUNDS.MIN_LAT || lat > GLOBAL_BOUNDS.MAX_LAT) {
    return { valid: false, error: "Latitude must be between -90 and 90 degrees" };
  }
  if (lng < GLOBAL_BOUNDS.MIN_LNG || lng > GLOBAL_BOUNDS.MAX_LNG) {
    return { valid: false, error: "Longitude must be between -180 and 180 degrees" };
  }

  // Reject Null Island
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return { valid: false, error: "Coordinates (0, 0) [Null Island] are invalid" };
  }

  // India bounds check
  if (options.requireIndia) {
    if (!isValidIndianCoordinate(lat, lng)) {
      return {
        valid: false,
        error: `Coordinates (${lat}, ${lng}) fall outside valid India territory [Lat: ${INDIA_BOUNDS.MIN_LAT}°-${INDIA_BOUNDS.MAX_LAT}°, Lng: ${INDIA_BOUNDS.MIN_LNG}°-${INDIA_BOUNDS.MAX_LNG}°]`,
      };
    }
  }

  // Normalize to 6 decimal places for standard sub-meter precision
  const normalizedLat = Number(lat.toFixed(6));
  const normalizedLng = Number(lng.toFixed(6));

  return { valid: true, latitude: normalizedLat, longitude: normalizedLng };
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

/**
 * Reusable Zod schema refinement for India coordinates.
 */
export const indianCoordinatesZodRefinement = (data: { latitude?: unknown; longitude?: unknown }) => {
  const result = validateCoordinates(data.latitude, data.longitude, { requireIndia: true, required: false });
  return result.valid;
};
