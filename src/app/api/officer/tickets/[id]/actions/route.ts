import { NextResponse } from "next/server";
import { currentOfficer } from "@/lib/auth";
import { ActionError, ActionSchema, performAction } from "@/lib/officer";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const officer = await currentOfficer();
  if (!officer) return jsonError(401, "Sign in required.");
  const { id } = await params;
  const parsed = ActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(400, first?.message ?? "Invalid action.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    await performAction(officer, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ActionError) return jsonError(e.status, e.message);
    return serverError(e);
  }
}
