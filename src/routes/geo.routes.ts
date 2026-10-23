import { Router } from "express";
import { parseInput, HttpError } from "../middleware/validation.js";
import {
  forwardGeocode,
  reverseGeocode,
  forwardGeocodeSchema,
  reverseGeocodeSchema,
} from "../services/geocoding.service.js";
import { conditionalHttpCache } from "../middleware/http-cache.middleware.js";

export function createGeoRoutes() {
  const router = Router();
  // Geocoding addresses/coordinates are immutable: cache for 1 hour, stale-while-revalidate 1 day
  const geoCache = conditionalHttpCache({ maxAgeSeconds: 3600, staleWhileRevalidateSeconds: 86400, isPublic: true });

  router.get("/lookup", geoCache, async (request, response, next) => {
    try {
      const { address } = parseInput(forwardGeocodeSchema, request.query);
      const result = await forwardGeocode(address);
      if (!result) {
        throw new HttpError(404, "Could not resolve address to coordinates");
      }
      response.json({ success: true, message: "Address geocoded", data: result });
    } catch (err) {
      next(err);
    }
  });

  router.get("/reverse", geoCache, async (request, response, next) => {
    try {
      const { latitude, longitude } = parseInput(reverseGeocodeSchema, request.query);
      const result = await reverseGeocode(latitude, longitude);
      if (!result) {
        throw new HttpError(404, "Could not resolve coordinates to address");
      }
      response.json({ success: true, message: "Coordinates resolved", data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
