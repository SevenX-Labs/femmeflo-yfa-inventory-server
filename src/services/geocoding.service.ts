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
  state: string | null;
  district: string | null;
  sublocality: string | null;
  pincode: string | null;
  locationType: string;
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

function parseResult(result: GoogleGeocodeResult): GeoLookupResult {
  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    state: extractAddressComponent(result, "administrative_area_level_1"),
    district: extractAddressComponent(result, "administrative_area_level_2"),
    sublocality: extractAddressComponent(result, "sublocality_level_1") ?? extractAddressComponent(result, "sublocality"),
    pincode: extractAddressComponent(result, "postal_code"),
    locationType: result.geometry.location_type,
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

  return parseResult(first);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoLookupResult | null> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
    result_type: "street_address|sublocality|locality|postal_code",
  });
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
  if (!res.ok) return null;

  const body = (await res.json()) as GoogleGeocodeResponse;
  const first = body.results[0];
  if (body.status !== "OK" || !first) return null;

  return parseResult(first);
}

export function isGpsAccuracyPoor(accuracy: number | undefined | null): boolean {
  if (accuracy == null) return false;
  return accuracy > ACCURACY_THRESHOLD_METERS;
}

export function buildAddressQuery(parts: {
  shopNumber?: string | undefined;
  streetName?: string | undefined;
  village?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
}): string {
  return [parts.shopNumber, parts.streetName, parts.village, parts.district, parts.state, parts.pincode]
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
