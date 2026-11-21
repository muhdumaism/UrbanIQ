/**
 * Report → ticket pipeline. Runs inside the durable job worker.
 * AI output is treated as evidence; the backend decides severity, location, routing and linking.
 */
import { Prisma, type Report } from "@prisma/client";
import { prisma } from "./db";
import { env, triageEngine } from "./env";
import { storage } from "./storage";
import { DemoTriageProvider, demoTriage } from "./ai/demo";
import { AnthropicTriageProvider } from "./ai/anthropic";
import { TriageError, type TriageInput, type TriageProvider } from "./ai/provider";
import { TriageResultSchema, type TriageResult } from "./ai/schema";
import { decideSeverity, isHigherSeverity } from "./severity";
import { resolveRoute } from "./routing";
import { findMatches, type MatchCandidate } from "./matching";
import { findLandmark, wardForPoint, wardLabel, wardsEnabled } from "./municipality";
import { SEVERITY_LABEL, categoryOf, subtypeLabel } from "./taxonomy";
import { analyzePhoto, parseStoredVision } from "./vision";

type Tx = Prisma.TransactionClient;
const MATCH_LOCK_KEY = 4242001;

export function getProvider(): TriageProvider {
  const engine = triageEngine();
  if (engine === "rules") return new DemoTriageProvider(env().CIVICFLOW_MODE === "demo" ? "demo:keyword-rules" : "rules:keyword");
  if (engine === "ai_missing_key") {
    throw new TriageError("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing. Report kept for manual review.", false, "not_configured");
  }
  const e = env();
  return new AnthropicTriageProvider(e.ANTHROPIC_API_KEY!, e.AI_MODEL, e.AI_EFFORT, e.AI_TIMEOUT_MS);
}

async function buildInput(report: Report): Promise<TriageInput> {
  let photo: TriageInput["photo"] = null;
  if (report.photoKey && report.photoMime) {
    const data = await storage().get(report.photoKey);
    if (!data) throw new TriageError("Stored photo could not be read.", true, "storage");
    photo = { data, mime: report.photoMime, fingerprint: report.photoFingerprint };
  }
  const ward = report.locationConfirmed && report.lat != null && report.lng != null ? wardForPoint(report.lat, report.lng) : null;
  return { text: report.text, photo, locationText: report.locationText, wardName: wardLabel(ward) };
}

/** Run AI triage for a report and file the result. Throws TriageError for the job runner to handle. */
export async function processReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return;
  await prisma.report.update({ where: { id: reportId }, data: { status: "PROCESSING" } });
  const provider = getProvider();
  const input = await buildInput(report);
  // Advisory photo analysis (private YOLO service). Never blocks triage: a missing, offline or
  // inconclusive detector is recorded and triage continues with text + location.
  const vision = await analyzePhoto(input.photo);
  await prisma.report.update({ where: { id: reportId }, data: { vision: vision as unknown as Prisma.InputJsonValue, visionStatus: vision.status } });
  input.vision = vision;
  const { result, provider: name } = await provider.triage(input);
  await fileTriage(reportId, result, name, null);
}

/** Called when retries are exhausted: keep the report visible using the keyword safety net, flagged for review. */
export async function fileFailedTriage(reportId: string, error: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return;
  let input: TriageInput;
  try {
    input = await buildInput(report);
  } catch {
    input = { text: report.text, photo: null, locationText: report.locationText, wardName: null };
  }
  input.vision = parseStoredVision(report.vision);
  const provisional = demoTriage(input);
  await fileTriage(reportId, provisional, "fallback:keyword-rules", error);
}

type Location = {
  lat: number | null;
  lng: number | null;
  precise: boolean;
  wardCode: string | null;
  landmark: string | null;
  text: string | null;
  outsideBoundary: boolean;
};

export function resolveLocation(
  report: Pick<Report, "lat" | "lng" | "locationConfirmed" | "locationSource" | "locationText" | "text">,
  t: TriageResult | null,
): Location {
  const hasPin = report.locationConfirmed && report.lat != null && report.lng != null && (report.locationSource === "PIN" || report.locationSource === "DEVICE");
  const lm = findLandmark(report.locationText, t?.landmark_mentioned, ...(t?.location_clues ?? []), report.text);
  if (hasPin) {
    const ward = wardForPoint(report.lat!, report.lng!);
    return { lat: report.lat, lng: report.lng, precise: true, wardCode: ward, landmark: lm?.name ?? null, text: report.locationText, outsideBoundary: wardsEnabled() && !ward };
  }
  if (lm) {
    return { lat: lm.lat, lng: lm.lng, precise: false, wardCode: lm.wardCode, landmark: lm.name, text: report.locationText || `Near ${lm.name}`, outsideBoundary: false };
  }
  return { lat: null, lng: null, precise: false, wardCode: null, landmark: null, text: report.locationText, outsideBoundary: false };
}

async function nextTicketReference(tx: Tx) {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter"(name, value) VALUES ('ticket', 1001)
    ON CONFLICT (name) DO UPDATE SET value = "Counter".value + 1
    RETURNING value`;
  return `T-${rows[0].value}`;
}

export function matchConfig() {
  const e = env();
  return { distance: e.MATCH_DISTANCE_METERS, strongDistance: e.MATCH_STRONG_DISTANCE_METERS, windowDays: e.MATCH_WINDOW_DAYS, recurrenceDays: e.RECURRENCE_WINDOW_DAYS };
}

export async function loadCandidates(tx: Tx, excludeTicketId?: string): Promise<MatchCandidate[]> {
  const cfg = matchConfig();
  const now = Date.now();
  const tickets = await tx.ticket.findMany({
    where: {
      mergedIntoId: null,
      id: excludeTicketId ? { not: excludeTicketId } : undefined,
      OR: [
        { status: { not: "RESOLVED" }, updatedAt: { gte: new Date(now - cfg.windowDays * 86400_000) } },
        { status: "RESOLVED", resolvedAt: { gte: new Date(now - cfg.recurrenceDays * 86400_000) } },
      ],
    },
    include: { reports: { select: { text: true, triage: true }, take: 5, orderBy: { submittedAt: "asc" } } },
  });
  return tickets.map((t) => ({
    id: t.id,
    reference: t.reference,
    status: t.status,
    subtype: t.subtype,
    lat: t.lat,
    lng: t.lng,
    precise: t.locationPrecise,
    wardCode: t.wardCode,
    landmark: t.landmark,
    text: [t.title, ...t.reports.map((r) => r.text ?? "")].join(" "),
    assets: t.reports.flatMap((r) => {
      const p = TriageResultSchema.safeParse(r.triage);
      return p.success ? p.data.asset_identifiers : [];
    }),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
  }));
}

/**
 * Files a triage result. Matching + ticket creation run in ONE transaction under a Postgres advisory
 * lock, so simultaneous submissions about the same issue cannot both create a new ticket.
 */
export async function fileTriage(reportId: string, t: TriageResult, provider: string, failure: string | null) {
  const rules = await prisma.routingRule.findMany();
  const departments = await prisma.department.findMany();
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? null;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCH_LOCK_KEY})`;
      const report = await tx.report.findUnique({ where: { id: reportId }, include: { ticket: { include: { reports: { select: { id: true } } } } } });
      if (!report) return;

      const loc = resolveLocation(report, t);
      const sev = decideSeverity(t);
      // Without ward boundaries, only city-wide rules apply.
      const route = resolveRoute(wardsEnabled() ? rules : rules.filter((r) => r.wardCode === "*"), t.subtype, loc.wardCode);
      const departmentId = route.status === "routed" ? route.departmentId : null;

      const reviewReasons = [...sev.reviewFlags];
      if (failure) reviewReasons.unshift(`AI processing failed: ${failure} Classification below is a keyword fallback.`);
      if (route.status === "uncertain") reviewReasons.push(`Ownership uncertain: ${route.reason}`);
      if (loc.outsideBoundary) reviewReasons.push("Confirmed pin is outside the municipal ward boundaries");
      else if (loc.lat == null) reviewReasons.push("Location too vague to route");
      else if (!loc.precise) reviewReasons.push(`Approximate location from landmark (${loc.landmark}) — confirm`);
      const photoOnly = !report.text && Boolean(report.photoKey);
      if (photoOnly && (t.subtype === "other" || t.category_confidence === "low")) {
        reviewReasons.push("Photo-only report with insufficient evidence to classify");
      }
      const vision = parseStoredVision(report.vision);
      if (vision?.status === "detected" && vision.top?.subtype && t.subtype !== "other" && categoryOf(vision.top.subtype) !== t.category) {
        reviewReasons.push(`Photo detector suggests ${vision.top.label.replace(/_/g, " ")} (${Math.round(vision.top.confidence * 100)}%), which disagrees with the classification — advisory`);
      }

      const reportUpdate = {
        status: failure ? ("FAILED" as const) : ("TRIAGED" as const),
        triage: t as unknown as Prisma.InputJsonValue,
        triageProvider: provider,
        triageError: failure,
        severity: sev.severity,
        severityReason: sev.reason,
        wardCode: loc.wardCode,
      };

      // ── Re-run for a report that already has a ticket (officer retry or citizen update)
      if (report.ticketId && report.ticket) {
        const ticket = report.ticket;
        await tx.report.update({ where: { id: report.id }, data: reportUpdate });
        const officerTouched = await tx.ticketEvent.count({
          where: { ticketId: ticket.id, actorType: "OFFICER", type: { in: ["severity_corrected", "rerouted", "assigned"] } },
        });
        const soleReport = ticket.reports.length === 1;
        if (soleReport && !officerTouched) {
          const before = { category: ticket.category, subtype: ticket.subtype, severity: ticket.severity, departmentId: ticket.departmentId };
          const stillVague = loc.lat == null;
          const status =
            ticket.status === "NEEDS_REVIEW" || ticket.status === "WAITING_FOR_DETAILS" || ticket.status === "NEW"
              ? failure || reviewReasons.some((r) => r !== "Location too vague to route") || !departmentId
                ? stillVague && sev.severity !== "CRITICAL"
                  ? "WAITING_FOR_DETAILS"
                  : "NEEDS_REVIEW"
                : "NEW"
              : ticket.status;
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              title: t.title,
              summary: t.summary,
              category: t.category,
              subtype: t.subtype,
              severity: sev.severity,
              severityReason: sev.reason,
              departmentId: ticket.departmentId ?? departmentId,
              reviewReasons,
              urgentReview: (sev.severity === "CRITICAL" && (loc.lat == null || loc.outsideBoundary || !departmentId)) || sev.urgent,
              status,
              needsReevaluation: true,
            },
          });
          await tx.ticketEvent.create({
            data: {
              ticketId: ticket.id,
              reportId: report.id,
              actorType: "SYSTEM",
              type: "triage_rerun",
              note: failure ? `Triage failed again: ${failure}` : `Triage re-run by ${provider}`,
              before,
              after: { category: t.category, subtype: t.subtype, severity: sev.severity, departmentId: ticket.departmentId ?? departmentId },
            },
          });
        } else {
          await tx.ticket.update({ where: { id: ticket.id }, data: { needsReevaluation: true } });
          await tx.ticketEvent.create({
            data: {
              ticketId: ticket.id,
              reportId: report.id,
              actorType: "SYSTEM",
              type: "triage_rerun",
              note: `Triage re-run for ${report.reference} (${provider}); officer decisions kept. AI now suggests ${SEVERITY_LABEL[sev.severity]} ${subtypeLabel(t.subtype)}.`,
            },
          });
        }
        return;
      }

      // ── Duplicate matching (never auto-link on a failed triage)
      const candidates = await loadCandidates(tx);
      const outcome = findMatches(
        {
          subtype: t.subtype,
          lat: loc.lat,
          lng: loc.lng,
          precise: loc.precise,
          wardCode: loc.wardCode,
          landmark: loc.landmark,
          text: `${t.title} ${report.text ?? ""}`,
          assets: t.asset_identifiers,
        },
        candidates,
        matchConfig(),
      );

      if (outcome.autoLink && !failure) {
        const target = await tx.ticket.findUniqueOrThrow({ where: { id: outcome.autoLink.ticketId } });
        await tx.report.update({ where: { id: report.id }, data: { ...reportUpdate, ticketId: target.id, linkType: "AUTO_LINKED" } });
        await tx.ticketEvent.create({
          data: {
            ticketId: target.id,
            reportId: report.id,
            actorType: "SYSTEM",
            type: "report_linked",
            note: outcome.autoLink.explanation,
            after: { report: report.reference },
          },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: target.id,
            reportId: report.id,
            actorType: "SYSTEM",
            type: "report_received",
            visibility: "PUBLIC",
            publicMessage: `Your report ${report.reference} was matched to an existing ticket for the same issue. Updates for that ticket appear here.`,
          },
        });
        // A new report may raise severity only when it adds evidence of a greater hazard (count alone never does).
        if (isHigherSeverity(sev.severity, target.severity)) {
          await tx.ticket.update({
            where: { id: target.id },
            data: { severity: sev.severity, severityReason: `${sev.reason} (new evidence from ${report.reference})`, needsReevaluation: true },
          });
          await tx.ticketEvent.create({
            data: {
              ticketId: target.id,
              reportId: report.id,
              actorType: "SYSTEM",
              type: "severity_raised",
              note: `New report ${report.reference} adds evidence of a greater hazard.`,
              before: { severity: target.severity, reason: target.severityReason },
              after: { severity: sev.severity, reason: sev.reason },
            },
          });
        } else {
          await tx.ticket.update({ where: { id: target.id }, data: { updatedAt: new Date() } });
        }
        if (target.lat == null && loc.lat != null) {
          await tx.ticket.update({
            where: { id: target.id },
            data: { lat: loc.lat, lng: loc.lng, locationPrecise: loc.precise, wardCode: loc.wardCode, landmark: loc.landmark, locationText: loc.text },
          });
        }
        return;
      }

      // ── New ticket
      const vague = loc.lat == null;
      const blocking = reviewReasons.filter((r) => r !== "Location too vague to route");
      let status: "NEW" | "NEEDS_REVIEW" | "WAITING_FOR_DETAILS" = "NEW";
      if (failure || blocking.length || !departmentId) status = "NEEDS_REVIEW";
      if (vague) status = sev.severity === "CRITICAL" || failure ? "NEEDS_REVIEW" : "WAITING_FOR_DETAILS";
      const urgent = (sev.severity === "CRITICAL" && (loc.lat == null || loc.outsideBoundary || !departmentId)) || sev.urgent;

      const reference = await nextTicketReference(tx);
      const ticket = await tx.ticket.create({
        data: {
          reference,
          title: t.title,
          summary: t.summary,
          category: t.category,
          subtype: t.subtype,
          severity: sev.severity,
          severityReason: sev.reason,
          status,
          departmentId,
          urgentReview: urgent,
          reviewReasons,
          lat: loc.lat,
          lng: loc.lng,
          locationPrecise: loc.precise,
          landmark: loc.landmark,
          wardCode: loc.wardCode,
          locationText: loc.text,
          isSample: report.isSample,
        },
      });
      await tx.report.update({ where: { id: report.id }, data: { ...reportUpdate, ticketId: ticket.id, linkType: "ORIGINAL" } });

      const events: Prisma.TicketEventCreateManyInput[] = [
        {
          ticketId: ticket.id,
          reportId: report.id,
          actorType: "SYSTEM",
          type: "report_received",
          visibility: "PUBLIC",
          publicMessage: `Report ${report.reference} received and logged as ticket ${reference}.`,
        },
        {
          ticketId: ticket.id,
          reportId: report.id,
          actorType: "SYSTEM",
          type: failure ? "triage_failed" : "triaged",
          note: failure
            ? `AI triage failed (${failure}). Keyword fallback suggests ${SEVERITY_LABEL[sev.severity]} ${subtypeLabel(t.subtype)}.`
            : `Triaged by ${provider}: ${subtypeLabel(t.subtype)}, ${SEVERITY_LABEL[sev.severity]} — ${sev.reason}`,
          after: { category: t.category, subtype: t.subtype, severity: sev.severity, provider },
        },
        departmentId
          ? {
              ticketId: ticket.id,
              actorType: "SYSTEM",
              type: "routed",
              note: `Routed to ${deptName(departmentId)} by ${route.status === "routed" && route.ruleScope === "ward" ? `ward rule (${loc.wardCode})` : "city-wide rule"} for ${t.subtype}.`,
              after: { departmentId, department: deptName(departmentId) },
              visibility: "PUBLIC",
              publicMessage: `Assigned to ${deptName(departmentId)}.`,
            }
          : {
              ticketId: ticket.id,
              actorType: "SYSTEM",
              type: "routing_uncertain",
              note: route.status === "uncertain" ? route.reason : "Department not determined",
            },
      ];
      if (urgent) {
        events.push({ ticketId: ticket.id, actorType: "SYSTEM", type: "urgent_review", note: "Possible critical hazard with unknown ward or owner — surfaced for urgent review." });
      }
      await tx.ticketEvent.createMany({ data: events });

      if (vague) {
        const question = t.follow_up_question || "Where exactly is this? A street name or nearby landmark helps the crew find it.";
        await tx.infoRequest.create({ data: { ticketId: ticket.id, reportId: report.id, kind: "LOCATION", question } });
        await tx.ticketEvent.create({
          data: { ticketId: ticket.id, reportId: report.id, actorType: "SYSTEM", type: "info_requested", visibility: "PUBLIC", publicMessage: question, note: "Location follow-up requested automatically." },
        });
      }
      for (const s of outcome.suggestions) {
        await tx.duplicateSuggestion.create({
          data: { kind: s.kind, reportId: report.id, sourceTicketId: ticket.id, candidateTicketId: s.ticketId, score: s.score, distanceMeters: s.distance, explanation: s.explanation },
        });
        await tx.ticketEvent.create({
          data: { ticketId: ticket.id, actorType: "SYSTEM", type: s.kind === "POSSIBLE_RECURRENCE" ? "recurrence_suggested" : "duplicate_suggested", note: s.explanation },
        });
      }
    },
    { timeout: 20000, maxWait: 20000 },
  );
}
