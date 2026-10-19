import { Router } from "express";
import { parseInput, HttpError } from "../middleware/validation.js";
import {
  forwardGeocode,
  reverseGeocode,
  forwardGeocodeSchema,
  reverseGeocodeSchema,
} from "../services/geocoding.service.js";

export function createGeoRoutes() {
  const router = Router();

  router.get("/lookup", async (request, response, next) => {
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

  router.get("/reverse", async (request, response, next) => {
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
