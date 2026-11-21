import { NextResponse } from "next/server";
import { currentOfficer, canActOnTicket } from "@/lib/auth";
import { getTicketDetail } from "@/lib/officer";
import { jsonError, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const officer = await currentOfficer();
  if (!officer) return jsonError(401, "Sign in required.");
  const { id } = await params;
  try {
    const t = await getTicketDetail(id);
    if (!t) return jsonError(404, "Ticket not found.");
    return NextResponse.json({ ...t, canAct: canActOnTicket(officer, t) });
  } catch (e) {
    return serverError(e);
  }
}
