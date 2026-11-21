/**
 * DEMO MODE triage adapter — deterministic keyword rules, no network calls.
 * It recognises the bundled sample photos by fingerprint and otherwise cannot "see" images.
 * Clearly labelled as `demo:keyword-rules` everywhere it appears.
 */
import samplePhotos from "../../../data/sample-photos.json";
import { categoryOf, subtypeLabel, type Subtype, type HazardFactor, type SeverityCode } from "../taxonomy";
import { LANDMARKS } from "../geo";
import basemap from "../../../data/basemap.json";
import { sanitizeTriage, type RiskFactor, type TriageResult } from "./schema";
import type { TriageInput, TriageOutput, TriageProvider } from "./provider";

type SamplePhoto = {
  file: string;
  sha256: string;
  subtype: Subtype;
  observations: string[];
  factors: { factor: HazardFactor; detail: string }[];
  locationClues: string[];
};
const SAMPLES = samplePhotos as SamplePhoto[];

const SUBTYPE_RULES: { subtype: Subtype; re: RegExp }[] = [
  { subtype: "sparking_wire", re: /\bspark(s|ing|ed)?\b|\blive wire\b|\belectrocut|\bbuzzing wire/ },
  { subtype: "downed_wire", re: /\b(wire|cable|power ?line)s?\b.*\b(down|fallen|hanging|snapped|loose|dangling)\b|\b(downed|fallen|hanging|snapped|dangling) (wire|cable|power ?line)/ },
  { subtype: "exposed_electrical", re: /\b(exposed|open) (junction|electrical|meter|transformer|box)/ },
  { subtype: "sewage_overflow", re: /\bsewage|\bsewer\b.*\b(overflow|spill)|\bmanhole\b.*\boverflow/ },
  { subtype: "blocked_sewer", re: /\b(blocked|clogged) sewer/ },
  { subtype: "pothole", re: /\bpot ?holes?\b/ },
  { subtype: "damaged_road", re: /\b(road|street|tarmac|asphalt)\b.*\b(crack|broken|damaged|caved|sinking)|\bcave[- ]?in\b/ },
  { subtype: "fallen_tree", re: /\b(fallen|uprooted|collapsed) (tree|branch)|\btree\b.*\b(fell|fallen|down|collapsed|blocking)/ },
  { subtype: "hazardous_tree", re: /\b(leaning|dead|cracked|hanging) (tree|branch)/ },
  { subtype: "water_leak", re: /\b(leak|leaking|burst|gushing)\b.*\b(pipe|water|main)|\bwater\b.*\b(leak|gushing|burst)|\bpipe burst/ },
  { subtype: "no_water_supply", re: /\bno water\b|\bwater (supply )?(cut|stopped|outage)/ },
  { subtype: "contaminated_water", re: /\b(dirty|brown|smelly|contaminated) (tap )?water/ },
  { subtype: "streetlight_out", re: /\bstreet ?lights?\b|\blamp ?post|\bstreet lamp/ },
  { subtype: "blocked_drain", re: /\b(blocked|clogged|choked) (storm ?)?drain|\bdrain\b.*\b(blocked|clogged|choked)/ },
  { subtype: "waterlogging", re: /\bwater ?logg|\bflooded (street|road)|\bstanding water\b|\bwater on the road/ },
  { subtype: "illegal_dumping", re: /\bdump(ed|ing)\b|\bfly[- ]?tip/ },
  { subtype: "overflowing_bin", re: /\b(bin|dumpster|garbage|trash|rubbish|waste)\b.*\b(overflow|full|spill)|\boverflowing (bin|garbage|trash)/ },
  { subtype: "missed_collection", re: /\b(garbage|trash|rubbish|waste) (not|wasn't|was not) (collected|picked)/ },
];

const has = (t: string, re: RegExp) => re.test(t);

const STREETS = (basemap as { features: { properties: { name?: string } }[] }).features
  .map((f) => f.properties.name)
  .filter((n): n is string => Boolean(n));

export class DemoTriageProvider implements TriageProvider {
  constructor(readonly name = "demo:keyword-rules") {}

  async triage(input: TriageInput): Promise<TriageOutput> {
    return { result: demoTriage(input), provider: this.name };
  }
}

export function demoTriage(input: TriageInput): TriageResult {
  const raw = (input.text ?? "").trim();
  const t = raw.toLowerCase();
  const sample = input.photo?.fingerprint ? SAMPLES.find((s) => s.sha256 === input.photo!.fingerprint) : undefined;

  const textSubtype = raw ? SUBTYPE_RULES.find((r) => r.re.test(t))?.subtype : undefined;
  // Advisory detector hint (only used when nothing better is known).
  const det = input.vision?.status === "detected" ? input.vision.top : null;
  const subtype: Subtype = textSubtype ?? sample?.subtype ?? det?.subtype ?? "other";
  const detCategoryConflict = Boolean(det?.subtype && textSubtype && categoryOf(det.subtype) !== categoryOf(textSubtype));
  const conflicts: string[] = [];
  if (textSubtype && sample && categoryOf(textSubtype) !== categoryOf(sample.subtype)) {
    conflicts.push(
      `Text describes ${subtypeLabel(textSubtype).toLowerCase()}, but the photo appears to show ${subtypeLabel(sample.subtype).toLowerCase()}.`,
    );
  }
  if (/\b(ignore (all|previous)|mark (this|it) (as )?(critical|urgent)|system prompt)\b/.test(t)) {
    conflicts.push("Report text contains instructions to the triage system; treated as content only.");
  }

  // ── facts & factors from citizen text
  const facts: string[] = raw
    ? raw
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const factors: RiskFactor[] = [];
  const add = (factor: HazardFactor, source: RiskFactor["source"], detail: string) => {
    const existing = factors.find((f) => f.factor === factor);
    if (existing) {
      if (existing.source !== source) existing.source = "both";
      return;
    }
    factors.push({ factor, source, detail });
  };

  const vulnerable = t.match(/\b(school|clinic|hospital|bus stop|bus shelter|playground|children|kids)\b/)?.[1];
  if (raw) {
    if (has(t, /\bspark(s|ing|ed)?\b|\blive wire\b|\belectrocut|\bon fire\b|\bfire\b|\bsmoke\b.*\b(wire|pole)/))
      add("immediate_danger_to_people", "citizen", `Citizen reports ${t.match(/spark\w*|live wire|electrocut\w*|fire/)?.[0] ?? "active danger"}${vulnerable ? ` near a ${vulnerable}` : ""}`);
    if (has(t, /\b(wire|cable|power ?line)s?\b/) && !factors.some((f) => f.factor === "immediate_danger_to_people"))
      add("electrical_contact_risk", "citizen", "Citizen reports a downed or exposed wire; live status not stated");
    if (has(t, /\bobstruct|\bblock(s|ing|ed)\b|\bcan'?t pass\b|\bclosed off\b|\btaking up (a|the|one) lane/))
      add("major_obstruction", "citizen", `Citizen reports it is ${t.match(/obstruct\w*( (a|the|one|both) lanes?| the (road|street|footpath|entrance))?|block\w*( (a|the|one|both) lanes?| the (road|street|footpath|entrance))?|taking up (a|the|one) lane/)?.[0] ?? "blocking the way"}`);
    if (has(t, /\b(flooded|water[- ]filled|full of water|deep|huge|massive|large)\b.*\bpot ?hole|\bpot ?hole\b.*\b(flooded|full of water|deep|huge)|\btree\b.*\b(road|car)|\bopen manhole/))
      add("significant_hazard", "citizen", t.includes("pothole") ? "Citizen describes a large or water-filled pothole" : "Citizen describes a significant physical hazard");
    if (has(t, /\bno water\b|\bsewage\b.*\b(street|road|flowing|everywhere)|\bwhole (street|area|block)\b/))
      add("service_disruption", "citizen", `Citizen reports ${t.match(/no water[^.,;]*|sewage[^.,;]*|[a-z]+ (across|along) the whole (street|area|block)/)?.[0]?.trim() ?? "a disruption affecting the wider area"}`);
    if (vulnerable) add("vulnerable_location", "citizen", `Citizen mentions a nearby ${vulnerable}`);
    if (has(t, /\b(footpath|pavement|sidewalk|walkway|(?<!car )park|square|market)\b/) && !factors.some((f) => f.factor === "major_obstruction"))
      add("public_space_affected", "citizen", `Citizen reports the ${t.match(/footpath|pavement|sidewalk|walkway|(?<!car )park|square|market/)?.[0]} is affected`);
    if (has(t, /\b(one|single|a single|only one)\b.*\b(light|lamp)|\botherwise (lit|fine|working)\b/))
      add("limited_impact", "citizen", "Citizen reports a single light out on an otherwise lit stretch");
  }

  // ── photo evidence (only for recognised sample photos)
  const photoObs: string[] = [];
  const missing: string[] = [];
  if (sample) {
    photoObs.push(...sample.observations);
    for (const f of sample.factors) add(f.factor, "photo", f.detail);
  } else if (input.photo && det) {
    photoObs.push(`Object detector (advisory): ${det.label.replace(/_/g, " ")}, ${Math.round(det.confidence * 100)}% confidence.`);
  } else if (input.photo) {
    photoObs.push("Photo attached. The demo adapter cannot inspect custom images — an officer should review the photo.");
    if (!raw) missing.push("What the issue is (photo could not be analysed in demo mode)");
  }
  if (detCategoryConflict) {
    conflicts.push(`Text describes ${subtypeLabel(textSubtype!).toLowerCase()}, but the photo detector suggests ${det!.label.replace(/_/g, " ")} (${Math.round(det!.confidence * 100)}%).`);
  }

  // ── location
  const locationHay = `${raw} ${input.locationText ?? ""}`.toLowerCase();
  const clues: string[] = [];
  const lm = LANDMARKS.find((l) => [l.name, ...l.aliases].some((a) => a.split(" ").length > 1 && locationHay.includes(a.toLowerCase())));
  if (lm) clues.push(lm.name);
  for (const s of STREETS) if (locationHay.includes(s.toLowerCase())) clues.push(s);
  if (sample) clues.push(...sample.locationClues);
  const assets = Array.from(raw.matchAll(/\b(?:pole|post|bin|light|lamp|meter)\s*(?:no\.?|number|#)?\s*([A-Z]{0,3}-?\d{2,6})\b/gi)).map((m) => m[0]);

  const hasPlace = Boolean(lm || clues.length || input.locationText?.trim() || input.wardName);
  let followUp: string | null = null;
  if (!hasPlace) {
    followUp = /\bschool\b/.test(t)
      ? "Which school or nearby landmark is this next to?"
      : `Where exactly is the ${subtype === "other" ? "issue" : subtypeLabel(subtype).toLowerCase()}? A street name or nearby landmark helps the crew find it.`;
    missing.push("A street name, landmark or map pin");
  }
  if (subtype === "other") missing.push("What kind of issue this is");

  const suggested = suggestSeverity(factors);
  // A detector label alone (no text, no recognised photo) is medium confidence at best.
  const confidence = subtype === "other" ? "low" : conflicts.length ? "medium" : textSubtype ? "high" : "medium";
  const where = lm?.name ?? clues[0] ?? null;

  const result: TriageResult = {
    title: buildTitle(subtype, where, vulnerable),
    summary: buildSummary(subtype, raw, sample, where, det),
    category: categoryOf(subtype),
    subtype,
    category_confidence: confidence,
    citizen_facts: facts,
    photo_observations: photoObs,
    location_clues: Array.from(new Set(clues)),
    landmark_mentioned: lm?.name ?? null,
    asset_identifiers: assets,
    risk_factors: factors,
    missing_information: missing,
    conflicts,
    suggested_severity: suggested,
    suggested_severity_reason: reasonFor(suggested, factors, subtype, where, t),
    follow_up_question: followUp,
  };
  return sanitizeTriage(result);
}

function suggestSeverity(factors: RiskFactor[]): SeverityCode {
  const f = new Set(factors.map((x) => x.factor));
  if (f.has("immediate_danger_to_people")) return "CRITICAL";
  if (f.has("major_obstruction") || f.has("significant_hazard") || f.has("service_disruption") || f.has("electrical_contact_risk")) return "HIGH";
  if (f.has("public_space_affected")) return "MEDIUM";
  return "LOW";
}

function buildTitle(subtype: Subtype, where: string | null, vulnerable?: string) {
  const base = subtype === "other" ? "Unclassified citizen report" : subtypeLabel(subtype);
  if (where) return `${base} near ${where}`;
  if (vulnerable) return `${base} near a ${vulnerable}`;
  return base;
}

function buildSummary(subtype: Subtype, raw: string, sample: SamplePhoto | undefined, where: string | null, det?: { label: string; confidence: number } | null) {
  const parts: string[] = [];
  if (raw) parts.push(`Citizen reports: "${raw.length > 220 ? raw.slice(0, 217) + "…" : raw}"`);
  if (sample) parts.push(`Photo shows: ${sample.observations[0].replace(/\.$/, "")}.`);
  if (!sample && det) parts.push(`Photo detector (advisory) suggests ${det.label.replace(/_/g, " ")} (${Math.round(det.confidence * 100)}%); no description given.`);
  else if (!raw && !sample) parts.push("Photo-only report; content not analysed by the demo adapter.");
  parts.push(where ? `Location clue: ${where}.` : "No usable location clue.");
  if (subtype === "other") parts.push("Category unclear.");
  return parts.join(" ");
}

function reasonFor(sev: SeverityCode, factors: RiskFactor[], subtype: Subtype, where: string | null, text = "") {
  const pick = (k: HazardFactor) => factors.find((f) => f.factor === k);
  const near = where ? ` near ${where}` : "";
  const vul = pick("vulnerable_location");
  if (sev === "CRITICAL") return `${pick("immediate_danger_to_people")!.detail}${where && !pick("immediate_danger_to_people")!.detail.includes("near") ? ` (${where})` : ""} — immediate danger to people.`;
  if (sev === "HIGH" && subtype === "pothole" && pick("major_obstruction")) {
    const adj = /flood|water|full of water/.test(text) ? "water-filled pothole" : "large pothole";
    const obs = pick("major_obstruction")!.detail.replace(/^Citizen reports it is /, "");
    const vulnTxt = vul && !where ? ` near a ${vul.detail.split(" ").pop()}` : near;
    return `Citizen reports a ${adj} ${obs.replace(/^obstructing/, "obstructing").replace(/^blocking/, "blocking")}${vulnTxt}.`;
  }
  if (sev === "HIGH") {
    const lead = pick("major_obstruction") ?? pick("significant_hazard") ?? pick("service_disruption") ?? pick("electrical_contact_risk")!;
    const extra = pick("significant_hazard") && lead.factor !== "significant_hazard" ? " and is water-filled or deep" : "";
    return `${subtypeLabel(subtype)}${near}: ${lowerFirst(lead.detail)}${extra}${vul && !where ? `; ${lowerFirst(vul.detail)}` : ""}.`;
  }
  if (sev === "MEDIUM") return `${subtypeLabel(subtype)}${near}: ${lowerFirst(pick("public_space_affected")!.detail)}.`;
  const lim = pick("limited_impact");
  return lim ? `${lim.detail}${near}.` : `${subtype === "other" ? "Unclear issue" : subtypeLabel(subtype)}${near} with limited reported impact.`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
