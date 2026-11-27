import { z } from "zod";
import { INDIA_BOUNDS } from "../utils/geo.utils.js";

const GEOCODE_TIMEOUT_MS = 5000;
const ACCURACY_THRESHOLD_METERS = 500;

export { ACCURACY_THRESHOLD_METERS };

interface GoogleGeocodeResult {
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeResult[];
  error_message?: string;
}

export interface GeoLookupResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  street: string | null;
  state: string | null;
  district: string | null;
  sublocality: string | null;
  pincode: string | null;
  locationType: string;
  confidence: "high" | "medium" | "low";
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  return key;
}

function extractAddressComponent(result: GoogleGeocodeResult, type: string): string | null {
  const component = result.address_components.find((c) => c.types.includes(type));
  return component?.long_name ?? null;
}

function findComponentAcrossResults(
  primary: GoogleGeocodeResult,
  allResults: GoogleGeocodeResult[] | undefined,
  type: string
): string | null {
  const direct = extractAddressComponent(primary, type);
  if (direct) return direct;
  if (!allResults || allResults.length <= 1) return null;
  for (const res of allResults) {
    const val = extractAddressComponent(res, type);
    if (val) return val;
  }
  return null;
}

function isBareNumber(val: string | null | undefined): boolean {
  if (!val) return false;
  return /^\d+[a-z]?$/i.test(val.trim());
}

function extractReadablePrefixFromFormatted(
  formattedAddress: string,
  state: string | null,
  pincode: string | null
): string | null {
  const parts = formattedAddress
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      if (/^india$/i.test(p)) return false;
      if (pincode && p === pincode) return false;
      if (state && (p.toLowerCase() === state.toLowerCase() || p.toLowerCase().startsWith(`${state.toLowerCase()} `))) {
        return false;
      }
      return true;
    });

  if (parts.length === 0) return null;
  const first = parts[0]!;
  if (isBareNumber(first) && parts.length > 1) {
    return `${first}, ${parts[1]!}`;
  }
  return first;
}

function determineConfidence(locationType: string): "high" | "medium" | "low" {
  switch (locationType) {
    case "ROOFTOP":
      return "high";
    case "RANGE_INTERPOLATED":
    case "GEOMETRIC_CENTER":
      return "medium";
    case "APPROXIMATE":
    default:
      return "low";
  }
}

export function parseGeocodeResult(result: GoogleGeocodeResult, allResults?: GoogleGeocodeResult[]): GeoLookupResult {
  const streetNumber = findComponentAcrossResults(result, allResults, "street_number");
  const route = findComponentAcrossResults(result, allResults, "route");
  const premise =
    findComponentAcrossResults(result, allResults, "premise") ??
    findComponentAcrossResults(result, allResults, "subpremise");
  const neighborhood =
    findComponentAcrossResults(result, allResults, "neighborhood") ??
    findComponentAcrossResults(result, allResults, "sublocality_level_3") ??
    findComponentAcrossResults(result, allResults, "sublocality_level_2");
  const sublocality1 =
    findComponentAcrossResults(result, allResults, "sublocality_level_1") ??
    findComponentAcrossResults(result, allResults, "sublocality");
  const locality = findComponentAcrossResults(result, allResults, "locality");
  const admin3 = findComponentAcrossResults(result, allResults, "administrative_area_level_3");
  const admin2 = findComponentAcrossResults(result, allResults, "administrative_area_level_2");
  const state = findComponentAcrossResults(result, allResults, "administrative_area_level_1");
  const pincode = findComponentAcrossResults(result, allResults, "postal_code");

  // Prefer city/district over revenue divisions like "Konkan Division"
  const district =
    admin2 && !/\bdivision$/i.test(admin2.trim())
      ? admin2
      : admin3 || locality || admin2 || null;

  // Build readable area/locality string without repeating the district
  const sublocalityParts = [sublocality1, locality].filter((val, idx, arr): val is string => {
    if (!val) return false;
    if (district && val.trim().toLowerCase() === district.trim().toLowerCase()) return false;
    return arr.findIndex((other) => other?.trim().toLowerCase() === val.trim().toLowerCase()) === idx;
  });
  const sublocality =
    (sublocalityParts.length > 0 ? sublocalityParts.join(", ") : null) ??
    neighborhood ??
    locality ??
    null;

  // Build street/road without returning bare plot numbers like "1" alone
  let street: string | null = null;
  if (route) {
    street = streetNumber ? `${streetNumber}, ${route}` : route;
  } else if (premise || neighborhood) {
    const landmark = premise || neighborhood;
    street = streetNumber ? `${streetNumber}, ${landmark}` : landmark;
  } else {
    const fallbackPrefix = extractReadablePrefixFromFormatted(result.formatted_address, state, pincode);
    if (fallbackPrefix && !isBareNumber(fallbackPrefix)) {
      street = fallbackPrefix;
    } else if (sublocality1) {
      street = streetNumber ? `${streetNumber}, ${sublocality1}` : sublocality1;
    }
  }
  if (isBareNumber(street)) {
    street = sublocality || locality || null;
  }

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    street,
    state,
    district,
    sublocality,
    pincode,
    locationType: result.geometry.location_type,
    confidence: determineConfidence(result.geometry.location_type),
  };
}

export async function forwardGeocode(address: string): Promise<GeoLookupResult | null> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "in",
    components: "country:IN",
  });
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
  if (!res.ok) return null;

  const body = (await res.json()) as GoogleGeocodeResponse;
  const first = body.results[0];
  if (body.status !== "OK" || !first) return null;

  return parseGeocodeResult(first, body.results);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoLookupResult | null> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
    result_type: "street_address|route|premise|sublocality|locality|postal_code",
  });
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
  if (!res.ok) return null;

  const body = (await res.json()) as GoogleGeocodeResponse;
  const first = body.results[0];
  if (body.status !== "OK" || !first) return null;

  return parseGeocodeResult(first, body.results);
}

export function isGpsAccuracyPoor(accuracy: number | undefined | null): boolean {
  if (accuracy == null) return false;
  return accuracy > ACCURACY_THRESHOLD_METERS;
}

export function buildAddressQuery(parts: {
  shopNumber?: string | undefined;
  streetName?: string | undefined;
  address?: string | undefined;
  village?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
}): string {
  const streetOrAddr = parts.streetName || parts.address;
  return [parts.shopNumber, streetOrAddr, parts.village, parts.district, parts.state, parts.pincode]
    .filter(Boolean)
    .join(", ");
}

export const forwardGeocodeSchema = z.object({
  address: z.string().trim().min(3).max(500),
});

export const reverseGeocodeSchema = z.object({
  latitude: z.coerce.number().min(INDIA_BOUNDS.MIN_LAT).max(INDIA_BOUNDS.MAX_LAT),
  longitude: z.coerce.number().min(INDIA_BOUNDS.MIN_LNG).max(INDIA_BOUNDS.MAX_LNG),
});
