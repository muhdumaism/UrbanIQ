/**
 * Backend-owned severity rules. The AI supplies evidence (risk factors with sources);
 * these rules — not the model — decide the final severity, applied in descending order.
 */
import type { RiskFactor, TriageResult } from "./ai/schema";
import { SEVERITY_RANK, type SeverityCode, categoryOf } from "./taxonomy";

export type SeverityDecision = {
  severity: SeverityCode;
  reason: string;
  /** Reasons an officer must look at this before trusting the result. */
  reviewFlags: string[];
  urgent: boolean;
};

const srcLabel = (s: RiskFactor["source"]) => (s === "photo" ? "Photo shows" : s === "both" ? "Citizen and photo indicate" : "Citizen reports");

function cleanDetail(f: RiskFactor) {
  // Ensure the reason names its evidence source.
  const d = f.detail.replace(/\.$/, "");
  return /^(citizen|photo)/i.test(d) ? d : `${srcLabel(f.source)} ${d.charAt(0).toLowerCase()}${d.slice(1)}`;
}

export function decideSeverity(t: TriageResult): SeverityDecision {
  const flags: string[] = [];
  const by = (k: RiskFactor["factor"]) => t.risk_factors.filter((f) => f.factor === k);
  const danger = by("immediate_danger_to_people");
  const high = [...by("major_obstruction"), ...by("significant_hazard"), ...by("service_disruption"), ...by("electrical_contact_risk")];
  const medium = by("public_space_affected");

  let severity: SeverityCode;
  let trigger: RiskFactor | undefined;
  let urgent = false;

  const credibleDanger = danger.find((f) => f.source !== "photo");
  if (credibleDanger) {
    // Rule 1 — Critical: the report indicates immediate danger to people.
    severity = "CRITICAL";
    trigger = credibleDanger;
  } else if (danger.length) {
    // Photo-only "danger" cannot be confirmed (e.g. a photo of a wire cannot show it is live).
    severity = "HIGH";
    trigger = danger[0];
    urgent = true;
    flags.push(
      categoryOf(t.subtype) === "ELECTRICAL_HAZARDS"
        ? "Possible live-wire danger seen in photo only — confirm whether it is live"
        : "Possible immediate danger seen in photo only — confirm",
    );
  } else if (high.length) {
    // Rule 2 — High: significant hazard, major obstruction or substantial service disruption.
    severity = "HIGH";
    trigger = high.find((f) => f.factor === "major_obstruction") ?? high[0];
  } else if (medium.length) {
    // Rule 3 — Medium: active issue affecting a public space or service.
    severity = "MEDIUM";
    trigger = medium[0];
  } else {
    // Rule 4 — Low: localized issue with limited reported impact.
    severity = "LOW";
    trigger = by("limited_impact")[0];
  }

  // Prefer the model's incident-specific wording only when it agrees with the rule outcome.
  let reason: string;
  if (t.suggested_severity === severity && t.suggested_severity_reason.trim().length > 10) {
    reason = t.suggested_severity_reason.trim();
  } else if (trigger) {
    const vul = by("vulnerable_location")[0];
    reason = cleanDetail(trigger) + (vul && severity !== "LOW" && !/school|clinic|hospital|bus|playground/i.test(trigger.detail) ? `; ${vul.detail.charAt(0).toLowerCase()}${vul.detail.slice(1).replace(/\.$/, "")}` : "") + ".";
  } else {
    reason = "No hazard, obstruction or disruption reported; treated as a localized issue.";
  }

  if (t.suggested_severity !== severity && SEVERITY_RANK[t.suggested_severity] < SEVERITY_RANK[severity]) {
    flags.push(`AI suggested ${t.suggested_severity.toLowerCase()} but the evidence supports ${severity.toLowerCase()} — check`);
  }
  if (t.conflicts.length) flags.push("Conflicting evidence");
  if (t.category_confidence === "low" || t.subtype === "other") flags.push("Category unclear");

  return { severity, reason: reason.length > 220 ? reason.slice(0, 219) + "…" : reason, reviewFlags: flags, urgent };
}

export const maxSeverity = (a: SeverityCode, b: SeverityCode): SeverityCode => (SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b);
export const isHigherSeverity = (a: SeverityCode, than: SeverityCode) => SEVERITY_RANK[a] < SEVERITY_RANK[than];
