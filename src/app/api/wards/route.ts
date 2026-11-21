import { NextResponse } from "next/server";
import { wardsForClient } from "@/lib/municipality";

export const runtime = "nodejs";

/** Public ward boundaries for map display. The server remains the authority for ward matching. */
export async function GET() {
  return NextResponse.json(wardsForClient(), { headers: { "Cache-Control": "public, max-age=300" } });
}
