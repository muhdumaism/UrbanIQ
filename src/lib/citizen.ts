/** Citizen tracking: opaque token → that citizen's own report + the linked ticket's PUBLIC status only. */
import { z } from "zod";
import { prisma } from "./db";
import { isPlausibleToken, sha256 } from "./tokens";
import { TriageResultSchema } from "./ai/schema";
import { resolveLocation, loadCandidates, matchConfig } from "./pipeline";
import { resolveRoute } from "./routing";
import { findMatches } from "./matching";
import { wardLabel } from "./municipality";
import { CATEGORY_LABEL, PUBLIC_STATUS_LABEL, subtypeLabel, type CategoryCode, type TicketStatusCode } from "./taxonomy";

export async function findReportByToken(token: string) {
  if (!isPlausibleToken(token)) return null;
  return prisma.report.findUnique({ where: { trackingTokenHash: sha256(token) } });
}

export type TrackingView = NonNullable<Awaited<ReturnType<typeof getTrackingView>>>;

export async function getTrackingView(token: string) {
  const report = await findReportByToken(token);
  if (!report) return null;
  const full = await prisma.report.findUniqueOrThrow({
    where: { id: report.id },
    include: {
      ticket: {
        include: {
          department: { select: { name: true } },
          events: { where: { visibility: "PUBLIC" }, orderBy: { createdAt: "asc" } },
        },
      },
      infoRequests: { orderBy: { createdAt: "asc" } },
    },
  });
  const triage = TriageResultSchema.safeParse(full.triage);
  const t = full.ticket;
  const processing = full.status === "RECEIVED" || full.status === "PROCESSING";
  return {
    reference: full.reference,
    submittedAt: full.submittedAt.toISOString(),
    processing,
    hasPhoto: Boolean(full.photoKey),
    text: full.text,
    summary: triage.success ? triage.data.title : null,
    category: triage.success ? CATEGORY_LABEL[triage.data.category as CategoryCode] : null,
    issueType: triage.success ? subtypeLabel(triage.data.subtype) : null,
    location: {
      text: full.locationText,
      lat: full.lat,
      lng: full.lng,
      confirmed: full.locationConfirmed,
      source: full.locationSource,
      ward: wardLabel(full.wardCode),
    },
    ticket: t
      ? {
          reference: t.reference,
          status: t.status as TicketStatusCode,
          statusLabel: PUBLIC_STATUS_LABEL[t.status as TicketStatusCode],
          department: t.department?.name ?? null,
          publicNote: t.publicNote,
          resolutionNote: t.status === "RESOLVED" ? t.resolutionNote : null,
          resolvedAt: t.resolvedAt?.toISOString() ?? null,
          // Only events about the ticket in general or about THIS citizen's report.
          timeline: t.events
            .filter((e) => !e.reportId || e.reportId === full.id)
            .map((e) => ({ id: e.id, type: e.type, message: e.publicMessage ?? "", at: e.createdAt.toISOString() })),
        }
      : null,
    infoRequests: full.infoRequests
      .filter((r) => r.status !== "CANCELLED")
      .map((r) => ({ id: r.id, kind: r.kind, question: r.question, status: r.status, answer: r.answer, answeredAt: r.answeredAt?.toISOString() ?? null })),
  };
}

export const CitizenUpdateSchema = z
  .object({
    infoRequestId: z.string().max(40).optional(),
    answer: z.string().trim().max(1000).optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        text: z.string().trim().max(200).optional(),
        source: z.enum(["PIN", "DEVICE", "LANDMARK"]).default("PIN"),
        placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.answer) || Boolean(v.location && (v.location.text || (v.location.lat != null && v.location.lng != null))), {
    message: "Add an answer or a location.",
  });

export class CitizenUpdateError extends Error {}

/** Records a citizen's answer / location correction and surfaces the ticket for re-evaluation. */
export async function applyCitizenUpdate(token: string, input: z.infer<typeof CitizenUpdateSchema>) {
  const report = await findReportByToken(token);
  if (!report) return { ok: false as const, status: 404 };
  const [rules, departments] = await Promise.all([prisma.routingRule.findMany(), prisma.department.findMany()]);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242001)`;
    const r = await tx.report.findUniqueOrThrow({ where: { id: report.id }, include: { ticket: true } });
    const ticket = r.ticket;
    let req = input.infoRequestId ? await tx.infoRequest.findFirst({ where: { id: input.infoRequestId, reportId: r.id } }) : null;
    if (input.infoRequestId && !req) throw new CitizenUpdateError("That question is no longer open.");
    if (req && req.status !== "OPEN") throw new CitizenUpdateError("That question has already been answered.");

    // A typed answer to a LOCATION question is treated as a landmark.
    let loc = input.location;
    if (!loc && req?.kind === "LOCATION" && input.answer) loc = { text: input.answer, source: "LANDMARK" };

    const before = { lat: r.lat, lng: r.lng, locationText: r.locationText, source: r.locationSource, confirmed: r.locationConfirmed };
    let updated = r;
    if (loc) {
      const hasPoint = loc.lat != null && loc.lng != null;
      updated = await tx.report.update({
        where: { id: r.id },
        data: hasPoint
          ? { lat: loc.lat, lng: loc.lng, locationConfirmed: true, locationSource: loc.source === "DEVICE" ? "DEVICE" : "PIN", locationText: loc.text || r.locationText, locationPlaceId: loc.placeId ?? null }
          : { locationText: loc.text, locationSource: r.locationConfirmed ? r.locationSource : "LANDMARK" },
        include: { ticket: true },
      });
    }
    if (req) {
      req = await tx.infoRequest.update({ where: { id: req.id }, data: { status: "ANSWERED", answer: input.answer || (loc?.text ?? "Location pin provided"), answeredAt: new Date() } });
    }
    if (!ticket) return; // still processing: the pipeline will use the corrected location

    if (loc) {
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          reportId: r.id,
          actorType: "CITIZEN",
          type: "location_corrected",
          visibility: "PUBLIC",
          publicMessage: "You updated the location of your report.",
          before,
          after: { lat: updated.lat, lng: updated.lng, locationText: updated.locationText, source: updated.locationSource },
        },
      });
    }
    if (input.answer && !(req?.kind === "LOCATION" && !input.location)) {
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          reportId: r.id,
          actorType: "CITIZEN",
          type: "detail_provided",
          visibility: "PUBLIC",
          publicMessage: `You replied: “${input.answer}”`,
          note: req ? `Answer to: ${req.question}` : "Additional detail from citizen",
        },
      });
    }

    // Re-evaluate location/routing for the ticket without overriding officer decisions.
    const triage = TriageResultSchema.safeParse(r.triage);
    const newLoc = resolveLocation(updated, triage.success ? triage.data : null);
    const data: Record<string, unknown> = { needsReevaluation: true };
    let reviewReasons = ticket.reviewReasons;
    const isPrimary = r.linkType === "ORIGINAL" || r.linkType === null;
    if (loc && isPrimary && newLoc.wardCode && (newLoc.precise || !ticket.locationPrecise)) {
      Object.assign(data, { lat: newLoc.lat, lng: newLoc.lng, locationPrecise: newLoc.precise, wardCode: newLoc.wardCode, landmark: newLoc.landmark, locationText: newLoc.text });
      await tx.report.update({ where: { id: r.id }, data: { wardCode: newLoc.wardCode } });
      reviewReasons = reviewReasons.filter((x) => x !== "Location too vague to route" && !x.startsWith("Approximate location") && !x.startsWith("Ownership uncertain"));
      if (!newLoc.precise) reviewReasons.push(`Approximate location from landmark (${newLoc.landmark}) — confirm`);
      let departmentId = ticket.departmentId;
      if (!departmentId) {
        const route = resolveRoute(rules, ticket.subtype, newLoc.wardCode);
        if (route.status === "routed") {
          departmentId = route.departmentId;
          data.departmentId = departmentId;
          const name = departments.find((d) => d.id === departmentId)?.name;
          await tx.ticketEvent.create({
            data: { ticketId: ticket.id, actorType: "SYSTEM", type: "routed", note: `Routed to ${name} after citizen location update.`, after: { departmentId, department: name }, visibility: "PUBLIC", publicMessage: `Assigned to ${name}.` },
          });
        } else reviewReasons.push(`Ownership uncertain: ${route.reason}`);
      }
      // Close any other open location questions for this report.
      await tx.infoRequest.updateMany({ where: { reportId: r.id, kind: "LOCATION", status: "OPEN" }, data: { status: "ANSWERED", answeredAt: new Date(), answer: "Location provided" } });
      if (ticket.status === "WAITING_FOR_DETAILS") {
        const blocking = reviewReasons;
        data.status = departmentId && !blocking.length ? "NEW" : "NEEDS_REVIEW";
      }
      data.urgentReview = ticket.severity === "CRITICAL" ? !departmentId : ticket.urgentReview && !departmentId;
      data.reviewReasons = reviewReasons;

      // Newly located report may now look like an existing ticket: suggest, never auto-merge after the fact.
      const pending = await tx.duplicateSuggestion.findMany({ where: { sourceTicketId: ticket.id }, select: { candidateTicketId: true } });
      const outcome = findMatches(
        { subtype: ticket.subtype, lat: newLoc.lat, lng: newLoc.lng, precise: newLoc.precise, wardCode: newLoc.wardCode, landmark: newLoc.landmark, text: `${ticket.title} ${r.text ?? ""}`, assets: triage.success ? triage.data.asset_identifiers : [] },
        await loadCandidates(tx, ticket.id),
        matchConfig(),
      );
      const all = [...(outcome.autoLink ? [{ ticketId: outcome.autoLink.ticketId, kind: "POSSIBLE_DUPLICATE" as const, score: 0.9, distance: outcome.autoLink.distance, explanation: outcome.autoLink.explanation.replace("Linked automatically to", "Strong match with") }] : []), ...outcome.suggestions];
      for (const s of all) {
        if (pending.some((p) => p.candidateTicketId === s.ticketId)) continue;
        await tx.duplicateSuggestion.create({ data: { kind: s.kind, reportId: r.id, sourceTicketId: ticket.id, candidateTicketId: s.ticketId, score: s.score, distanceMeters: s.distance, explanation: s.explanation } });
      }
    } else if (ticket.status === "WAITING_FOR_DETAILS" && (req || loc)) {
      // Citizen replied but we still could not place it automatically: an officer takes it from here.
      data.status = "NEEDS_REVIEW";
    }
    await tx.ticket.update({ where: { id: ticket.id }, data });
    await tx.ticketEvent.create({ data: { ticketId: ticket.id, reportId: r.id, actorType: "SYSTEM", type: "reevaluation_needed", note: `Citizen updated ${r.reference}; ticket flagged for re-evaluation.` } });
  });
  return { ok: true as const };
}
