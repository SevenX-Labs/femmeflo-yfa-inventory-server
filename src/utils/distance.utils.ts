interface Coordinate {
  lat: number;
  lng: number;
}

function haversineKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function haversineRouteKm(points: Coordinate[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1]!, points[i]!);
  }
  // 1.25 road winding multiplier
  return total * 1.25;
}

async function googleMapsRouteKm(points: Coordinate[], apiKey: string): Promise<number | null> {
  if (points.length < 2) return 0;

  const origin = `${points[0]!.lat},${points[0]!.lng}`;
  const destination = `${points[points.length - 1]!.lat},${points[points.length - 1]!.lng}`;
  const waypoints = points
    .slice(1, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join("|");

  const params = new URLSearchParams({
    origin,
    destination,
    key: apiKey,
  });
  if (waypoints) params.set("waypoints", waypoints);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      routes: { legs: { distance: { value: number } }[] }[];
    };
    if (data.status !== "OK" || !data.routes[0]) return null;

    let meters = 0;
    for (const leg of data.routes[0].legs) {
      meters += leg.distance.value;
    }
    return meters / 1000;
  } catch {
    return null;
  }
}

export async function calculateRouteDistanceKm(points: Coordinate[]): Promise<number> {
  if (points.length < 2) return 0;

  const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (apiKey) {
    const km = await googleMapsRouteKm(points, apiKey);
    if (km !== null) return Math.round(km * 100) / 100;
  }

  return Math.round(haversineRouteKm(points) * 100) / 100;
}
