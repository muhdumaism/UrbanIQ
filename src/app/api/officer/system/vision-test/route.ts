import { NextResponse } from "next/server";
import { currentOfficer } from "@/lib/auth";
import { processPhoto, PhotoError } from "@/lib/photo";
import { analyzePhoto } from "@/lib/vision";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";

/** Officer-only: run a photo through the detector exactly as the triage pipeline does (nothing is saved). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  if (!(await currentOfficer())) return jsonError(401, "Sign in required.");
  try {
    const file = (await req.formData()).get("image");
    if (!(file instanceof File) || !file.size) return jsonError(400, "Choose a photo.");
    const photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(await analyzePhoto({ data: photo.data, mime: photo.mime }));
  } catch (e) {
    if (e instanceof PhotoError) return jsonError(400, e.message);
    return serverError(e);
  }
}
