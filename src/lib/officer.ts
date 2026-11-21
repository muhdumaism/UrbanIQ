/** Officer queue, ticket detail and audited actions. All authorization is enforced here, server-side. */
import { Prisma, type Severity, type TicketStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { canActOnTicket, type SessionOfficer } from "./auth";
import { TriageResultSchema } from "./ai/schema";
import { parseStoredVision } from "./vision";
import { retryReport } from "./jobs";
import { isHigherSeverity } from "./severity";
import { CATEGORIES, SEVERITIES, SEVERITY_LABEL, SEVERITY_RANK, STATUS_LABEL, TICKET_STATUSES, type SeverityCode } from "./taxonomy";
import { WARD_LIST } from "./geo";
import { wardLabel } from "./municipality";

// ───────────────────────── Queue

export const QueueFilterSchema = z.object({
  view: z.enum(["open", "all", "resolved"]).default("open"),
  status: z.enum(TICKET_STATUSES).optional(),
  ward: z.string().max(10).optional(),
  category: z.enum(CATEGORIES).optional(),
  department: z.string().max(40).optional(),
  severity: z.enum(SEVERITIES).optional(),
  q: z.string().trim().max(80).optional(),
});
export type QueueFilter = z.infer<typeof QueueFilterSchema>;

/** Critical → High → Medium → Low, then oldest first within each severity. */
export function compareQueue(a: { severity: SeverityCode; createdAt: Date | string }, b: { severity: SeverityCode; createdAt: Date | string }) {
  const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (s !== 0) return s;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export type QueueRow = Awaited<ReturnType<typeof listQueue>>["rows"][number];

export async function listQueue(f: QueueFilter) {
  const where: Prisma.TicketWhereInput = { mergedIntoId: null };
  if (f.view === "open") where.status = { not: "RESOLVED" };
  if (f.view === "resolved") where.status = "RESOLVED";
  if (f.status) where.status = f.status;
  if (f.ward) where.wardCode = f.ward === "none" ? null : f.ward;
  if (f.category) where.category = f.category;
  if (f.department) where.departmentId = f.department === "none" ? null : f.department;
  if (f.severity) where.severity = f.severity;
  if (f.q) {
    where.OR = [
      { reference: { contains: f.q, mode: "insensitive" } },
      { title: { contains: f.q, mode: "insensitive" } },
      { locationText: { contains: f.q, mode: "insensitive" } },
      { landmark: { contains: f.q, mode: "insensitive" } },
      { reports: { some: { reference: { contains: f.q, mode: "insensitive" } } } },
      { reports: { some: { text: { contains: f.q, mode: "insensitive" } } } },
    ];
  }
  const [tickets, processing, failed] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        department: { select: { name: true } },
        _count: { select: { reports: true } },
        suggestions: { where: { status: "PENDING" }, select: { id: true } },
        ownSuggestions: { where: { status: "PENDING" }, select: { id: true } },
        infoRequests: { where: { status: "OPEN" }, select: { id: true } },
      },
      take: 500,
    }),
    prisma.report.count({ where: { status: { in: ["RECEIVED", "PROCESSING"] } } }),
    prisma.report.count({ where: { status: "FAILED", ticket: { status: { not: "RESOLVED" } } } }),
  ]);
  const rows = tickets
    .map((t) => ({
      id: t.id,
      reference: t.reference,
      title: t.title,
      category: t.category,
      subtype: t.subtype,
      severity: t.severity as SeverityCode,
      severityReason: t.severityReason,
      status: t.status,
      statusLabel: STATUS_LABEL[t.status],
      departmentId: t.departmentId,
      department: t.department?.name ?? null,
      urgentReview: t.urgentReview && t.status !== "RESOLVED",
      needsReevaluation: t.needsReevaluation,
      reportCount: t._count.reports,
      isSample: t.isSample,
      pendingSuggestions: t.suggestions.length + t.ownSuggestions.length,
      waitingOnCitizen: t.infoRequests.length > 0,
      lat: t.lat,
      lng: t.lng,
      locationPrecise: t.locationPrecise,
      wardCode: t.wardCode,
      ward: wardLabel(t.wardCode),
      locationText: t.locationText ?? t.landmark,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
    .sort(compareQueue);
  return { rows, processing, failed };
}

// ───────────────────────── Detail

export async function getTicketDetail(id: string) {
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      department: true,
      reports: { orderBy: { submittedAt: "asc" }, include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } } },
      events: { orderBy: { createdAt: "desc" }, include: { officer: { select: { name: true } }, report: { select: { reference: true } } } },
      infoRequests: { orderBy: { createdAt: "desc" }, include: { report: { select: { reference: true } } } },
      suggestions: { where: { status: "PENDING" }, include: { sourceTicket: true, report: { select: { reference: true } } } },
      ownSuggestions: { include: { candidateTicket: true, report: { select: { reference: true } } }, orderBy: { score: "desc" } },
    },
  });
  if (!t) return null;
  const merged = t.mergedIntoId ? await prisma.ticket.findUnique({ where: { id: t.mergedIntoId }, select: { id: true, reference: true } }) : null;
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return {
    id: t.id,
    reference: t.reference,
    title: t.title,
    summary: t.summary,
    category: t.category,
    subtype: t.subtype,
    severity: t.severity as SeverityCode,
    severityReason: t.severityReason,
    status: t.status,
    statusLabel: STATUS_LABEL[t.status],
    departmentId: t.departmentId,
    department: t.department?.name ?? null,
    urgentReview: t.urgentReview,
    needsReevaluation: t.needsReevaluation,
    reviewReasons: t.reviewReasons,
    lat: t.lat,
    lng: t.lng,
    locationPrecise: t.locationPrecise,
    landmark: t.landmark,
    wardCode: t.wardCode,
    ward: wardLabel(t.wardCode),
    locationText: t.locationText,
    publicNote: t.publicNote,
    resolutionNote: t.resolutionNote,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    mergedInto: merged,
    isSample: t.isSample,
    reports: t.reports.map((r) => {
      const tri = TriageResultSchema.safeParse(r.triage);
      return {
        id: r.id,
        reference: r.reference,
        submittedAt: r.submittedAt.toISOString(),
        text: r.text,
        hasPhoto: Boolean(r.photoKey),
        photoUrl: r.photoKey ? `/api/officer/photos/${r.id}` : null,
        status: r.status,
        triageProvider: r.triageProvider,
        triageError: r.triageError,
        severity: r.severity,
        severityReason: r.severityReason,
        linkType: r.linkType,
        location: { lat: r.lat, lng: r.lng, text: r.locationText, source: r.locationSource, confirmed: r.locationConfirmed, ward: wardLabel(r.wardCode), placeId: r.locationPlaceId },
        vision: parseStoredVision(r.vision),
        triage: tri.success ? tri.data : null,
        job: r.jobs[0] ? { status: r.jobs[0].status, attempts: r.jobs[0].attempts, lastError: r.jobs[0].lastError } : null,
      };
    }),
    events: t.events.map((e) => ({
      id: e.id,
      type: e.type,
      actorType: e.actorType,
      actor: e.actorType === "OFFICER" ? (e.officer?.name ?? "Officer") : e.actorType === "CITIZEN" ? "Citizen" : "UrbanIQ",
      visibility: e.visibility,
      publicMessage: e.publicMessage,
      note: e.note,
      before: e.before,
      after: e.after,
      report: e.report?.reference ?? null,
      at: e.createdAt.toISOString(),
    })),
    infoRequests: t.infoRequests.map((r) => ({ id: r.id, kind: r.kind, question: r.question, status: r.status, answer: r.answer, report: r.report.reference, createdAt: r.createdAt.toISOString(), answeredAt: r.answeredAt?.toISOString() ?? null })),
    suggestions: [
      ...t.ownSuggestions
        .filter((s) => s.status === "PENDING")
        .map((s) => ({ id: s.id, kind: s.kind, direction: "this_may_duplicate" as const, other: { id: s.candidateTicket.id, reference: s.candidateTicket.reference, title: s.candidateTicket.title, status: STATUS_LABEL[s.candidateTicket.status], severity: s.candidateTicket.severity }, explanation: s.explanation, score: s.score, distance: s.distanceMeters, report: s.report.reference })),
      ...t.suggestions.map((s) => ({ id: s.id, kind: s.kind, direction: "may_duplicate_this" as const, other: { id: s.sourceTicket.id, reference: s.sourceTicket.reference, title: s.sourceTicket.title, status: STATUS_LABEL[s.sourceTicket.status], severity: s.sourceTicket.severity }, explanation: s.explanation, score: s.score, distance: s.distanceMeters, report: s.report.reference })),
    ],
    departments,
  };
}
export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

// ───────────────────────── Actions

const msg = z.string().trim().max(500).optional();
export const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge"), message: msg }),
  z.object({ action: z.literal("start"), message: msg }),
  z.object({ action: z.literal("resolve"), note: z.string().trim().min(3, "Add a short resolution note.").max(500), internalNote: msg }),
  z.object({ action: z.literal("reopen"), reason: z.string().trim().min(3, "Give a reason.").max(500) }),
  z.object({ action: z.literal("assign_department"), departmentId: z.string().min(1).max(40), reason: msg }),
  z.object({ action: z.literal("correct_severity"), severity: z.enum(SEVERITIES), reason: z.string().trim().min(3, "A reason is required for priority corrections.").max(500) }),
  z.object({ action: z.literal("request_detail"), kind: z.enum(["LOCATION", "DETAIL"]), question: z.string().trim().min(5, "Write the question for the citizen.").max(200) }),
  z.object({ action: z.literal("confirm_suggestion"), suggestionId: z.string().min(1).max(40) }),
  z.object({ action: z.literal("dismiss_suggestion"), suggestionId: z.string().min(1).max(40), reason: msg }),
  z.object({ action: z.literal("add_note"), note: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("public_update"), message: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("mark_reviewed") }),
  z.object({ action: z.literal("retry_processing"), reportId: z.string().min(1).max(40) }),
]);
export type OfficerAction = z.infer<typeof ActionSchema>;

export class ActionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const OPEN_FOR_WORK: TicketStatus[] = ["NEW", "NEEDS_REVIEW", "WAITING_FOR_DETAILS", "ACKNOWLEDGED"];

export async function performAction(officer: SessionOfficer, ticketId: string, a: OfficerAction) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { department: true } });
  if (!ticket) throw new ActionError("Ticket not found.", 404);
  if (!canActOnTicket(officer, ticket)) throw new ActionError("This ticket belongs to another department. Ask a supervisor to reroute it.", 403);
  if (ticket.mergedIntoId && a.action !== "add_note") throw new ActionError("This ticket was merged into another ticket.", 409);

  const ev = (data: Omit<Prisma.TicketEventUncheckedCreateInput, "ticketId" | "actorType" | "officerId">, tid = ticket.id): Prisma.TicketEventUncheckedCreateInput => ({
    ticketId: tid,
    actorType: "OFFICER",
    officerId: officer.id,
    ...data,
  });
  const requireOpen = () => {
    if (ticket.status === "RESOLVED") throw new ActionError("This ticket is resolved. Reopen it first.", 409);
  };
  const requireDept = () => {
    if (!ticket.departmentId) throw new ActionError("Assign a department before moving this ticket forward.", 409);
  };

  switch (a.action) {
    case "acknowledge": {
      requireOpen();
      requireDept();
      if (!OPEN_FOR_WORK.includes(ticket.status)) throw new ActionError(`Can't acknowledge a ticket that is ${STATUS_LABEL[ticket.status].toLowerCase()}.`, 409);
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { status: "ACKNOWLEDGED", urgentReview: false, needsReevaluation: false } }),
        prisma.ticketEvent.create({
          data: ev({ type: "status_changed", before: { status: ticket.status }, after: { status: "ACKNOWLEDGED" }, visibility: "PUBLIC", publicMessage: a.message || `Acknowledged by ${ticket.department!.name}.` }),
        }),
      ]);
      break;
    }
    case "start": {
      requireOpen();
      requireDept();
      if (ticket.status === "IN_PROGRESS") throw new ActionError("Already in progress.", 409);
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { status: "IN_PROGRESS", urgentReview: false, needsReevaluation: false } }),
        prisma.ticketEvent.create({
          data: ev({ type: "status_changed", before: { status: ticket.status }, after: { status: "IN_PROGRESS" }, visibility: "PUBLIC", publicMessage: a.message || "A crew is working on this." }),
        }),
      ]);
      break;
    }
    case "resolve": {
      requireOpen();
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: a.note, urgentReview: false, needsReevaluation: false } }),
        prisma.infoRequest.updateMany({ where: { ticketId: ticket.id, status: "OPEN" }, data: { status: "CANCELLED" } }),
        prisma.ticketEvent.create({ data: ev({ type: "status_changed", before: { status: ticket.status }, after: { status: "RESOLVED" }, visibility: "PUBLIC", publicMessage: `Resolved: ${a.note}`, note: a.internalNote }) }),
      ]);
      break;
    }
    case "reopen": {
      if (ticket.status !== "RESOLVED") throw new ActionError("Only resolved tickets can be reopened.", 409);
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { status: ticket.departmentId ? "ACKNOWLEDGED" : "NEEDS_REVIEW", resolvedAt: null } }),
        prisma.ticketEvent.create({ data: ev({ type: "status_changed", before: { status: "RESOLVED" }, after: { status: "REOPENED" }, note: a.reason, visibility: "PUBLIC", publicMessage: "This ticket was reopened." }) }),
      ]);
      break;
    }
    case "assign_department": {
      requireOpen();
      const dept = await prisma.department.findUnique({ where: { id: a.departmentId } });
      if (!dept) throw new ActionError("Unknown department.");
      if (dept.id === ticket.departmentId) throw new ActionError("The ticket is already with that department.", 409);
      const isReroute = Boolean(ticket.departmentId);
      if (isReroute && !a.reason) throw new ActionError("A reason is required to reroute a ticket.");
      const reasons = ticket.reviewReasons.filter((r) => !r.startsWith("Ownership uncertain"));
      await prisma.$transaction([
        prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            departmentId: dept.id,
            reviewReasons: reasons,
            urgentReview: ticket.severity === "CRITICAL" ? !ticket.wardCode : false,
            status: ticket.status === "NEEDS_REVIEW" && ticket.wardCode ? "NEW" : ticket.status === "IN_PROGRESS" ? "ACKNOWLEDGED" : ticket.status,
          },
        }),
        prisma.ticketEvent.create({
          data: ev({
            type: isReroute ? "rerouted" : "assigned",
            before: { departmentId: ticket.departmentId, department: ticket.department?.name ?? null },
            after: { departmentId: dept.id, department: dept.name },
            note: a.reason,
            visibility: "PUBLIC",
            publicMessage: isReroute ? `Reassigned to ${dept.name}.` : `Assigned to ${dept.name}.`,
          }),
        }),
      ]);
      break;
    }
    case "correct_severity": {
      requireOpen();
      if (a.severity === ticket.severity) throw new ActionError("Severity is already set to that level.", 409);
      const reason = `${a.reason} (corrected by ${officer.name})`;
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { severity: a.severity as Severity, severityReason: a.reason, urgentReview: a.severity === "CRITICAL" ? !ticket.departmentId || !ticket.wardCode : false } }),
        prisma.ticketEvent.create({
          data: ev({ type: "severity_corrected", before: { severity: ticket.severity, reason: ticket.severityReason }, after: { severity: a.severity, reason: a.reason }, note: `${SEVERITY_LABEL[ticket.severity as SeverityCode]} → ${SEVERITY_LABEL[a.severity]}: ${reason}` }),
        }),
      ]);
      break;
    }
    case "request_detail": {
      requireOpen();
      const report = await prisma.report.findFirst({ where: { ticketId: ticket.id }, orderBy: { submittedAt: "asc" } });
      if (!report) throw new ActionError("No citizen report is linked to this ticket.", 409);
      const nextStatus: TicketStatus = ticket.status === "IN_PROGRESS" ? "IN_PROGRESS" : "WAITING_FOR_DETAILS";
      await prisma.$transaction([
        prisma.infoRequest.create({ data: { ticketId: ticket.id, reportId: report.id, kind: a.kind, question: a.question } }),
        prisma.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } }),
        prisma.ticketEvent.create({
          data: ev({ type: "info_requested", reportId: report.id, before: { status: ticket.status }, after: { status: nextStatus }, note: `Asked ${report.reference}: ${a.question}`, visibility: "PUBLIC", publicMessage: a.question }),
        }),
      ]);
      break;
    }
    case "confirm_suggestion":
    case "dismiss_suggestion": {
      const s = await prisma.duplicateSuggestion.findUnique({ where: { id: a.suggestionId }, include: { sourceTicket: true, candidateTicket: true } });
      if (!s || (s.sourceTicketId !== ticket.id && s.candidateTicketId !== ticket.id)) throw new ActionError("Suggestion not found.", 404);
      if (s.status !== "PENDING") throw new ActionError("This suggestion was already decided.", 409);
      const other = s.sourceTicketId === ticket.id ? s.candidateTicket : s.sourceTicket;
      if (!canActOnTicket(officer, other)) throw new ActionError("The other ticket belongs to another department.", 403);
      if (a.action === "dismiss_suggestion") {
        await prisma.$transaction([
          prisma.duplicateSuggestion.update({ where: { id: s.id }, data: { status: "DISMISSED", decidedById: officer.id, decidedAt: new Date() } }),
          prisma.ticketEvent.create({ data: ev({ type: "suggestion_dismissed", note: `Not a ${s.kind === "POSSIBLE_RECURRENCE" ? "recurrence" : "duplicate"} of ${s.candidateTicket.reference}${a.reason ? `: ${a.reason}` : ""}` }, s.sourceTicketId) }),
        ]);
        break;
      }
      if (s.kind === "POSSIBLE_RECURRENCE") {
        await prisma.$transaction([
          prisma.duplicateSuggestion.update({ where: { id: s.id }, data: { status: "CONFIRMED", decidedById: officer.id, decidedAt: new Date() } }),
          prisma.ticketEvent.create({ data: ev({ type: "recurrence_confirmed", note: `Confirmed as a recurrence of ${s.candidateTicket.reference}.` }, s.sourceTicketId) }),
          prisma.ticketEvent.create({ data: ev({ type: "recurrence_confirmed", note: `Issue recurred as ${s.sourceTicket.reference}.` }, s.candidateTicketId) }),
        ]);
        break;
      }
      await mergeTickets(officer, s.id, s.sourceTicketId, s.candidateTicketId);
      break;
    }
    case "add_note": {
      await prisma.ticketEvent.create({ data: ev({ type: "note", note: a.note }) });
      break;
    }
    case "public_update": {
      requireOpen();
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { publicNote: a.message } }),
        prisma.ticketEvent.create({ data: ev({ type: "public_update", visibility: "PUBLIC", publicMessage: a.message, before: { publicNote: ticket.publicNote }, after: { publicNote: a.message } }) }),
      ]);
      break;
    }
    case "mark_reviewed": {
      requireOpen();
      const nextStatus: TicketStatus = ticket.status === "NEEDS_REVIEW" && ticket.departmentId && ticket.wardCode ? "NEW" : ticket.status;
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticket.id }, data: { needsReevaluation: false, urgentReview: ticket.departmentId && ticket.wardCode ? false : ticket.urgentReview, status: nextStatus, reviewReasons: [] } }),
        prisma.ticketEvent.create({ data: ev({ type: "reviewed", before: { status: ticket.status, reviewReasons: ticket.reviewReasons }, after: { status: nextStatus } }) }),
      ]);
      break;
    }
    case "retry_processing": {
      const report = await prisma.report.findFirst({ where: { id: a.reportId, ticketId: ticket.id } });
      if (!report) throw new ActionError("Report not found on this ticket.", 404);
      if (report.status === "PROCESSING" || report.status === "RECEIVED") throw new ActionError("This report is already being processed.", 409);
      await prisma.ticketEvent.create({ data: ev({ type: "retry_requested", reportId: report.id, note: `AI processing re-queued for ${report.reference}.` }) });
      await retryReport(report.id);
      break;
    }
  }
}

/** Merge a duplicate ticket into an existing one. Every report keeps its own tracking link. */
async function mergeTickets(officer: SessionOfficer, suggestionId: string, sourceId: string, targetId: string) {
  await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([tx.ticket.findUniqueOrThrow({ where: { id: sourceId } }), tx.ticket.findUniqueOrThrow({ where: { id: targetId } })]);
    if (target.status === "RESOLVED" || target.mergedIntoId) throw new ActionError(`${target.reference} is closed; it can't absorb another ticket.`, 409);
    if (source.mergedIntoId) throw new ActionError(`${source.reference} was already merged.`, 409);
    const reports = await tx.report.findMany({ where: { ticketId: source.id } });
    await tx.report.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id, linkType: "OFFICER_LINKED" } });
    await tx.infoRequest.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id } });
    await tx.duplicateSuggestion.update({ where: { id: suggestionId }, data: { status: "CONFIRMED", decidedById: officer.id, decidedAt: new Date() } });
    await tx.duplicateSuggestion.updateMany({ where: { status: "PENDING", OR: [{ sourceTicketId: source.id }, { candidateTicketId: source.id }] }, data: { status: "DISMISSED", decidedAt: new Date() } });
    await tx.ticket.update({ where: { id: source.id }, data: { status: "RESOLVED", resolvedAt: new Date(), mergedIntoId: target.id, resolutionNote: `Merged into ${target.reference} (same issue).`, urgentReview: false } });
    const base = { actorType: "OFFICER" as const, officerId: officer.id };
    await tx.ticketEvent.create({ data: { ...base, ticketId: source.id, type: "merged", note: `Confirmed duplicate; merged into ${target.reference}.`, after: { mergedInto: target.reference } } });
    await tx.ticketEvent.create({
      data: { ...base, ticketId: target.id, type: "duplicate_confirmed", note: `Merged ${source.reference} (${reports.map((r) => r.reference).join(", ")}) into this ticket.`, after: { reports: reports.map((r) => r.reference) } },
    });
    for (const r of reports) {
      await tx.ticketEvent.create({
        data: { ...base, ticketId: target.id, reportId: r.id, type: "report_linked", visibility: "PUBLIC", publicMessage: `Your report ${r.reference} was matched to ticket ${target.reference} for the same issue. Updates appear here.` },
      });
    }
    // Severity can rise only on evidence: the merged ticket's own assessed severity.
    if (isHigherSeverity(source.severity as SeverityCode, target.severity as SeverityCode)) {
      await tx.ticket.update({ where: { id: target.id }, data: { severity: source.severity, severityReason: `${source.severityReason} (evidence from merged ${source.reference})`, needsReevaluation: true } });
      await tx.ticketEvent.create({ data: { ...base, ticketId: target.id, type: "severity_raised", before: { severity: target.severity }, after: { severity: source.severity }, note: `Merged report adds evidence of a greater hazard.` } });
    }
  });
}

export const FILTER_OPTIONS = { wards: WARD_LIST };
