// Server-only helper for the Mappls Route / Driving Directions REST API.
// Docs: https://developer.mappls.com/documentation/sdk/rest-apis/mappls-routing-api/readme/
//
// Why REST and not the native widget:
// The Mappls iOS/Android/Flutter SDKs ship a `MapplsDirectionViewController` UI widget
// (e.g. `MapplsDirectionViewController(for: [MapplsDirectionLocation])`). That widget only
// exists in the native mobile SDKs — it is Swift/Kotlin/Dart code that cannot run inside a
// browser. This project is a Next.js/React web app, so instead we call Mappls' underlying
// HTTP Directions API directly and hand the browser plain JSON (distance, duration, route
// geometry) that the map UI can render itself.

export type LatLng = { lat: number; lng: number };

export type MapplsDirectionsRequest = {
  origin: LatLng;
  destination: LatLng;
  viaPoints?: LatLng[];
  /** Vehicle profile. Mirrors `directionVC.profileIdentifier` in the native SDK. */
  profile?: "driving" | "biking" | "walking" | "trucking";
  /** route_adv = no live traffic, route_eta = duration adjusted for live traffic (India only). */
  resource?: "route_adv" | "route_eta" | "route_traffic";
  /** Required outside India: "lka" | "npl" | "bgd" | "btn" | "mmr" etc. */
  region?: string;
};

export type MapplsDirectionsResult = {
  distanceMeters: number;
  durationSeconds: number;
  /** Decoded route line, ready to plot point-by-point. */
  path: LatLng[];
};

function toCoord(point: LatLng) {
  return `${point.lng},${point.lat}`;
}

export async function getMapplsDirections(
  accessToken: string | undefined,
  req: MapplsDirectionsRequest,
): Promise<MapplsDirectionsResult> {
  if (!accessToken) {
    throw new Error(
      "Mappls directions are not configured. Generate a REST API key at https://apis.mappls.com/console and set MAPPLS_ACCESS_TOKEN.",
    );
  }

  const profile = req.profile ?? "driving";
  const resource = req.resource ?? "route_eta";
  const stops = [req.origin, ...(req.viaPoints ?? []), req.destination].map(toCoord).join(";");

  const url = new URL(`https://route.mappls.com/route/direction/${resource}/${profile}/${stops}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", accessToken);
  if (req.region) url.searchParams.set("region", req.region);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Mappls directions request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`No route found (${data.code ?? "unknown error"})`);
  }

  const route = data.routes[0];
  const coordinates: [number, number][] = route.geometry.coordinates; // geojson order: [lng, lat]

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    path: coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}
