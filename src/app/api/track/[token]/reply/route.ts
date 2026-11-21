import { NextResponse } from "next/server";
import { applyCitizenUpdate, CitizenUpdateError, CitizenUpdateSchema } from "@/lib/citizen";
import { jsonError, sameOrigin, serverError } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const rl = rateLimit(`reply:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return jsonError(429, "Too many updates. Please wait a few minutes.");
  const { token } = await params;
  const parsed = CitizenUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid update.");
  try {
    const res = await applyCitizenUpdate(token, parsed.data);
    if (!res.ok) return jsonError(404, "We couldn't find a report for that link.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CitizenUpdateError) return jsonError(400, e.message);
    return serverError(e);
  }
}
