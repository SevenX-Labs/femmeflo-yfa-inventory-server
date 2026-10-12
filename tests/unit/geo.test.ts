import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidIndianCoordinate,
  validateCoordinates,
  normalizeCoordinate,
  calculateHaversineDistanceKm,
  INDIA_BOUNDS,
} from "../../src/utils/geo.utils.js";

test("GPS / Geolocation Validation Unit Tests", async (t) => {
  await t.test("Valid Indian coordinates pass validation (Delhi, Mumbai, Jaipur, Bangalore)", () => {
    // Delhi
    const delhi = validateCoordinates(28.6139, 77.2090, { requireIndia: true });
    assert.equal(delhi.valid, true);
    assert.equal(delhi.latitude, 28.6139);
    assert.equal(delhi.longitude, 77.209);

    // Mumbai
    const mumbai = validateCoordinates(19.0760, 72.8777, { requireIndia: true });
    assert.equal(mumbai.valid, true);

    // Jaipur
    const jaipur = validateCoordinates(26.9124, 75.7873, { requireIndia: true });
    assert.equal(jaipur.valid, true);

    // Southern island / territory (Andaman)
    const andaman = validateCoordinates(11.6234, 92.7265, { requireIndia: true });
    assert.equal(andaman.valid, true);
  });

  await t.test("Valid stringified numeric coordinates are properly normalized", () => {
    const res = validateCoordinates(" 26.912400 ", " 75.787300 ", { requireIndia: true });
    assert.equal(res.valid, true);
    assert.equal(res.latitude, 26.9124);
    assert.equal(res.longitude, 75.7873);
  });

  await t.test("Rejects Null Island (0, 0)", () => {
    const res = validateCoordinates(0, 0, { requireIndia: true });
    assert.equal(res.valid, false);
    assert.match(res.error || "", /Null Island/i);
    assert.equal(isValidIndianCoordinate(0, 0), false);
  });

  await t.test("Rejects latitudes above 90 and below -90", () => {
    const above90 = validateCoordinates(90.1, 77.2, { requireIndia: false });
    assert.equal(above90.valid, false);
    assert.match(above90.error || "", /between -90 and 90/i);

    const belowNeg90 = validateCoordinates(-90.5, 77.2, { requireIndia: false });
    assert.equal(belowNeg90.valid, false);
    assert.match(belowNeg90.error || "", /between -90 and 90/i);
  });

  await t.test("Rejects longitudes above 180 and below -180", () => {
    const above180 = validateCoordinates(20.0, 180.5, { requireIndia: false });
    assert.equal(above180.valid, false);
    assert.match(above180.error || "", /between -180 and 180/i);

    const belowNeg180 = validateCoordinates(20.0, -180.5, { requireIndia: false });
    assert.equal(belowNeg180.valid, false);
    assert.match(belowNeg180.error || "", /between -180 and 180/i);
  });

  await t.test("Rejects NaN, non-numeric strings and invalid inputs", () => {
    assert.equal(normalizeCoordinate(NaN), null);
    assert.equal(normalizeCoordinate("not_a_number"), null);
    assert.equal(normalizeCoordinate(""), null);
    assert.equal(normalizeCoordinate(null), null);
    assert.equal(normalizeCoordinate(undefined), null);

    const nanCheck = validateCoordinates("abc", 75.5, { requireIndia: true });
    assert.equal(nanCheck.valid, false);
    assert.match(nanCheck.error || "", /valid numeric coordinate/i);
  });

  await t.test("Rejects coordinates clearly outside India", () => {
    // London: 51.5074 N, -0.1278 W
    const london = validateCoordinates(51.5074, -0.1278, { requireIndia: true });
    assert.equal(london.valid, false);
    assert.match(london.error || "", /outside valid India territory/i);

    // New York: 40.7128 N, -74.0060 W
    const ny = validateCoordinates(40.7128, -74.0060, { requireIndia: true });
    assert.equal(ny.valid, false);

    // Sydney: -33.8688 S, 151.2093 E
    const sydney = validateCoordinates(-33.8688, 151.2093, { requireIndia: true });
    assert.equal(sydney.valid, false);
  });

  await t.test("Rejects when one coordinate is missing", () => {
    const missingLng = validateCoordinates(28.6, undefined, { requireIndia: true });
    assert.equal(missingLng.valid, false);
    assert.match(missingLng.error || "", /Longitude is required/i);

    const missingLat = validateCoordinates(undefined, 77.2, { requireIndia: true });
    assert.equal(missingLat.valid, false);
    assert.match(missingLat.error || "", /Latitude is required/i);
  });

  await t.test("Rejects missing coordinates when marked required", () => {
    const requiredCheck = validateCoordinates(undefined, undefined, { required: true });
    assert.equal(requiredCheck.valid, false);
    assert.match(requiredCheck.error || "", /required/i);

    const optionalCheck = validateCoordinates(undefined, undefined, { required: false });
    assert.equal(optionalCheck.valid, true);
  });

  await t.test("Calculates Haversine distance correctly", () => {
    // Mumbai (19.0760, 72.8777) to Pune (18.5204, 73.8567) is approx 120-150 km
    const dist = calculateHaversineDistanceKm(
      { latitude: 19.0760, longitude: 72.8777 },
      { latitude: 18.5204, longitude: 73.8567 }
    );
    assert.ok(dist > 100 && dist < 160, `Distance ${dist}km should be between 100 and 160km`);
  });
});
