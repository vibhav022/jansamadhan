import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const bucket = env.BUCKET;
    if (!bucket) return Response.json({ error: "Evidence storage is unavailable." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Files must be smaller than 10 MB." }, { status: 413 });
    const allowed = ["image/", "video/", "application/pdf"];
    if (!allowed.some((type) => file.type.startsWith(type))) return Response.json({ error: "Upload an image, video or PDF." }, { status: 415 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = `evidence/${crypto.randomUUID()}-${safeName}`;
    await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    return Response.json({ ok: true, key, name: file.name });
  } catch (error) {
    console.error("Evidence upload failed", error);
    return Response.json({ error: "Evidence upload failed. Please try again." }, { status: 500 });
  }
}
