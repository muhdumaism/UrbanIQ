import { NextResponse } from "next/server";
import { getTrackingView } from "@/lib/citizen";
import { jsonError, serverError } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`track:${clientIp(req)}`, 240, 60_000);
  if (!rl.ok) return jsonError(429, "Too many requests.");
  const { token } = await params;
  try {
    const view = await getTrackingView(token);
    // Same response for malformed and unknown tokens.
    if (!view) return jsonError(404, "We couldn't find a report for that link.");
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
