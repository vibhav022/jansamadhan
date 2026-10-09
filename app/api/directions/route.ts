import { env } from "cloudflare:workers";
import { getMapplsDirections, type LatLng } from "@/lib/mappls";

export const runtime = "edge";

function isLatLng(value: unknown): value is LatLng {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as LatLng).lat === "number" &&
    typeof (value as LatLng).lng === "number"
  );
}

export async function POST(request: Request) {
  let body: {
    origin?: LatLng;
    destination?: LatLng;
    viaPoints?: LatLng[];
    profile?: "driving" | "biking" | "walking" | "trucking";
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send origin and destination as JSON." }, { status: 400 });
  }

  if (!isLatLng(body.origin) || !isLatLng(body.destination)) {
    return Response.json(
      { error: "origin and destination are both required, each as { lat, lng }." },
      { status: 400 },
    );
  }

  try {
    const result = await getMapplsDirections(env.MAPPLS_ACCESS_TOKEN, {
      origin: body.origin,
      destination: body.destination,
      viaPoints: body.viaPoints,
      profile: body.profile,
    });
    return Response.json(result);
  } catch (error) {
    console.error("Mappls directions failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Directions request failed." },
      { status: 502 },
    );
  }
}
