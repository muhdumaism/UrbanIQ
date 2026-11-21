import { z } from "zod";
import { CATEGORIES, HAZARD_FACTORS, SEVERITIES, SUBTYPE_CODES } from "../taxonomy";

/**
 * The ONLY shape the AI may return. It describes evidence; it carries no authority:
 * no department, no status, no actions. The backend decides final severity and routing.
 */
export const RiskFactorSchema = z.object({
  factor: z.enum(HAZARD_FACTORS),
  source: z.enum(["citizen", "photo", "both"]).describe("Where the evidence for this factor comes from"),
  detail: z.string().describe("Short, specific evidence, e.g. 'citizen says the wire is sparking next to the bus stop'"),
});

export const TriageResultSchema = z.object({
  title: z.string().describe("Short ticket title, max ~70 characters, no trailing period"),
  summary: z.string().describe("Neutral 1-3 sentence summary for a municipal officer"),
  category: z.enum(CATEGORIES),
  subtype: z.enum(SUBTYPE_CODES as [string, ...string[]]),
  category_confidence: z.enum(["high", "medium", "low"]),
  citizen_facts: z.array(z.string()).describe("Facts stated by the citizen in their text. Empty if no text."),
  photo_observations: z.array(z.string()).describe("Only what is directly visible in the photo. Empty if no photo."),
  location_clues: z.array(z.string()).describe("Street names, landmarks, directions mentioned or visible"),
  landmark_mentioned: z.string().nullable().describe("Most specific named place mentioned, or null"),
  asset_identifiers: z.array(z.string()).describe("Pole numbers, bin IDs, meter numbers, etc. Empty if none"),
  risk_factors: z.array(RiskFactorSchema),
  missing_information: z.array(z.string()),
  conflicts: z.array(z.string()).describe("Contradictions between text and photo or within the report"),
  suggested_severity: z.enum(SEVERITIES),
  suggested_severity_reason: z.string().describe("One line, specific to this incident, naming the evidence source when it matters"),
  follow_up_question: z
    .string()
    .nullable()
    .describe("If the location is too vague to route, ONE specific question for the citizen, else null"),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
export type RiskFactor = z.infer<typeof RiskFactorSchema>;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const clipList = (l: string[], items: number, n: number) => l.filter((x) => x.trim()).slice(0, items).map((x) => clip(x.trim(), n));

/** Server-side normalisation after schema validation: enforce lengths and taxonomy consistency. */
export function sanitizeTriage(t: TriageResult): TriageResult {
  const subtypeCategory = (SUBTYPE_CODES as string[]).includes(t.subtype) ? t.subtype : "other";
  return {
    ...t,
    title: clip(t.title.replace(/\s+/g, " ").trim() || "Citizen report", 90),
    summary: clip(t.summary.trim(), 600),
    subtype: subtypeCategory,
    citizen_facts: clipList(t.citizen_facts, 8, 240),
    photo_observations: clipList(t.photo_observations, 8, 240),
    location_clues: clipList(t.location_clues, 6, 160),
    landmark_mentioned: t.landmark_mentioned ? clip(t.landmark_mentioned, 120) : null,
    asset_identifiers: clipList(t.asset_identifiers, 5, 40),
    risk_factors: t.risk_factors.slice(0, 8).map((r) => ({ ...r, detail: clip(r.detail.trim(), 200) })),
    missing_information: clipList(t.missing_information, 6, 200),
    conflicts: clipList(t.conflicts, 6, 240),
    suggested_severity_reason: clip(t.suggested_severity_reason.replace(/\s+/g, " ").trim(), 200),
    follow_up_question: t.follow_up_question ? clip(t.follow_up_question.trim(), 200) : null,
  };
}
