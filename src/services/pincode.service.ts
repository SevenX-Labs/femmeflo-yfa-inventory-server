import { HttpError } from "../middleware/validation.js";

export interface PincodeLookupResult {
  pincode: string;
  state: string;
  district: string;
  village: string;
  villages: string[];
}

// In-memory cache to avoid redundant external network roundtrips
const pincodeCache = new Map<string, PincodeLookupResult>();

/**
 * Looks up location details (State, District, Village/PostOffice names) for an Indian 6-digit PIN code.
 * Falls back gracefully if lookup fails so the user can enter manually.
 */
export async function lookupPincode(pincode: string): Promise<PincodeLookupResult> {
  const cleaned = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleaned)) {
    throw new HttpError(400, "Invalid PIN code. Please enter a valid 6-digit Indian PIN code");
  }

  if (pincodeCache.has(cleaned)) {
    return pincodeCache.get(cleaned)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4-second timeout

    const response = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error("Pincode service returned non-200 status");
    }

    const data = await response.json() as Array<{ Status: string; PostOffice?: Array<{ Name: string; District: string; State: string }> }>;
    const firstResult = data?.[0];

    if (firstResult && firstResult.Status === "Success" && firstResult.PostOffice && firstResult.PostOffice.length > 0) {
      const primary = firstResult.PostOffice[0]!;
      const state = primary.State;
      const district = primary.District;
      const villages = Array.from(new Set(firstResult.PostOffice.map((po) => po.Name).filter(Boolean)));
      const village = villages[0] || primary.Name;

      const result: PincodeLookupResult = {
        pincode: cleaned,
        state,
        district,
        village,
        villages,
      };

      pincodeCache.set(cleaned, result);
      return result;
    }

    throw new HttpError(404, `No details found for PIN code ${cleaned}. Please enter state, district and village manually.`);
  } catch (err: unknown) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, `Could not auto-fetch details for PIN code ${cleaned}. Please enter state, district and village manually.`);
  }
}
