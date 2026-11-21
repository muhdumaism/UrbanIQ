import { NextResponse } from "next/server";
import { currentOfficer } from "@/lib/auth";
import { listQueue, QueueFilterSchema } from "@/lib/officer";
import { jsonError, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const officer = await currentOfficer();
  if (!officer) return jsonError(401, "Sign in required.");
  const params = Object.fromEntries(Array.from(new URL(req.url).searchParams.entries()).filter(([, v]) => v !== ""));
  const f = QueueFilterSchema.safeParse(params);
  if (!f.success) return jsonError(400, "Invalid filters.");
  try {
    return NextResponse.json(await listQueue(f.data));
  } catch (e) {
    return serverError(e);
  }
}
