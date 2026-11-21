import { NextResponse } from "next/server";
import { createReportFromForm, IntakeError } from "@/lib/intake";
import { runPendingJobs } from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { jsonError, sameOrigin, serverError } from "@/lib/http";
import { trackingUrl } from "@/lib/tokens";

export const runtime = "nodejs";
const MAX_BODY = 11 * 1024 * 1024;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site submissions are not allowed.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return jsonError(413, "That upload is too large. Photos must be 10 MB or smaller.", { fieldErrors: { photo: "Photos must be 10 MB or smaller." } });
  const rl = rateLimit(`report:${clientIp(req)}`, 20, 10 * 60_000);
  if (!rl.ok) return jsonError(429, `Too many reports from this connection. Try again in ${rl.retryAfter} seconds.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "We couldn't read the submission. Please try again.");
  }
  try {
    const result = await createReportFromForm(form);
    void runPendingJobs(); // kick the durable worker; it also polls on its own
    return NextResponse.json(
      { reference: result.reference, token: result.token, trackingUrl: trackingUrl(result.token), duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    if (e instanceof IntakeError) return jsonError(e.status, "Please fix the highlighted fields.", { fieldErrors: e.fieldErrors });
    return serverError(e);
  }
}
