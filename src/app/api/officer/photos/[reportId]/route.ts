import { currentOfficer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Citizen photos are private: served only to signed-in officers, never cached publicly. */
export async function GET(_req: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const officer = await currentOfficer();
  if (!officer) return jsonError(401, "Sign in required.");
  const { reportId } = await params;
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { photoKey: true, photoMime: true } });
  if (!report?.photoKey || !report.photoMime) return jsonError(404, "Photo not found.");
  const data = await storage().get(report.photoKey);
  if (!data) return jsonError(404, "Photo not found.");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": report.photoMime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
