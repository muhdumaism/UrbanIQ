/** Duplicate / recurrence matching. Pure functions so they can be unit tested; the pipeline runs them under a lock. */
import { distanceMeters } from "./geo";
import { categoryOf } from "./taxonomy";

export type MatchConfig = { distance: number; strongDistance: number; windowDays: number; recurrenceDays: number };

export type MatchSubject = {
  subtype: string;
  lat: number | null;
  lng: number | null;
  /** true only for a citizen-confirmed pin or device location */
  precise: boolean;
  wardCode: string | null;
  landmark: string | null;
  text: string;
  assets: string[];
};

export type MatchCandidate = MatchSubject & {
  id: string;
  reference: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

export type MatchOutcome = {
  autoLink: { ticketId: string; explanation: string; distance: number | null } | null;
  suggestions: { ticketId: string; kind: "POSSIBLE_DUPLICATE" | "POSSIBLE_RECURRENCE"; score: number; distance: number | null; explanation: string }[];
};

const STOP = new Set("the a an and or of to in on at near by is are was were it this that there with for from my our its be been has have very just outside next road street".split(" "));
export function keywords(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const normAsset = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(POLE|POST|BIN|LIGHT|LAMP|METER)(NO|NUMBER)?/, "");

export function findMatches(subject: MatchSubject, candidates: MatchCandidate[], cfg: MatchConfig, now = new Date()): MatchOutcome {
  const day = 86400_000;
  const words = keywords(subject.text);
  const assets = new Set(subject.assets.map(normAsset).filter(Boolean));
  const strong: { c: MatchCandidate; d: number | null; why: string; score: number }[] = [];
  const suggestions: MatchOutcome["suggestions"] = [];

  for (const c of candidates) {
    const sameSubtype = c.subtype === subject.subtype && subject.subtype !== "other";
    const sameCategory = categoryOf(c.subtype) === categoryOf(subject.subtype) && categoryOf(subject.subtype) !== "OTHER";
    if (!sameSubtype && !sameCategory) continue;
    const d =
      subject.lat != null && subject.lng != null && c.lat != null && c.lng != null
        ? distanceMeters({ lat: subject.lat, lng: subject.lng }, { lat: c.lat, lng: c.lng })
        : null;
    const sim = jaccard(words, keywords(c.text));
    const assetHit = c.assets.some((a) => assets.has(normAsset(a)));
    const sameLandmark = Boolean(subject.landmark && c.landmark && subject.landmark === c.landmark);
    const dTxt = d != null ? `${Math.round(d)} m apart` : "no exact distance";

    if (c.status === "RESOLVED") {
      const age = c.resolvedAt ? (now.getTime() - c.resolvedAt.getTime()) / day : Infinity;
      if (sameSubtype && age <= cfg.recurrenceDays && ((d != null && d <= cfg.distance) || assetHit || (d == null && sameLandmark))) {
        suggestions.push({
          ticketId: c.id,
          kind: "POSSIBLE_RECURRENCE",
          score: 0.5,
          distance: d,
          explanation: `Same issue type (${c.subtype.replace(/_/g, " ")}) resolved ${Math.max(0, Math.round(age))} days ago at ${c.reference}, ${dTxt}${assetHit ? ", same asset ID" : ""}.`,
        });
      }
      continue;
    }

    const ageDays = (now.getTime() - Math.max(c.createdAt.getTime(), c.updatedAt.getTime())) / day;
    if (ageDays > cfg.windowDays) continue;

    const bothPrecise = subject.precise && c.precise && d != null;
    let score = 0;
    if (sameSubtype) score += 0.4;
    else score += 0.15;
    if (d != null) score += Math.max(0, 0.35 * (1 - d / cfg.distance));
    if (assetHit) score += 0.3;
    if (sameLandmark) score += 0.1;
    score += 0.15 * sim;

    const reasons = [
      sameSubtype ? `same issue type (${c.subtype.replace(/_/g, " ")})` : `same category, different issue type`,
      dTxt,
      assetHit ? "same asset ID" : null,
      sameLandmark ? `both mention ${subject.landmark}` : null,
      sim >= 0.2 ? `similar description (${Math.round(sim * 100)}% word overlap)` : null,
      `ticket opened ${Math.round((now.getTime() - c.createdAt.getTime()) / 3600_000)} h ago`,
    ].filter(Boolean);

    // Strong match → auto-link. Only with precise locations on both sides (conservative when uncertain).
    if (sameSubtype && bothPrecise && (d! <= cfg.strongDistance || (assetHit && d! <= cfg.distance))) {
      strong.push({ c, d, score, why: reasons.join(", ") });
      continue;
    }
    // Possible match → officer decides.
    const nearby = d != null && d <= cfg.distance;
    const vagueButSimilar = d == null && (sameLandmark || assetHit || (subject.wardCode && subject.wardCode === c.wardCode && sim >= 0.25));
    if ((sameSubtype && (nearby || vagueButSimilar)) || (!sameSubtype && d != null && d <= cfg.strongDistance)) {
      suggestions.push({ ticketId: c.id, kind: "POSSIBLE_DUPLICATE", score: +score.toFixed(2), distance: d, explanation: `Possible duplicate of ${c.reference}: ${reasons.join(", ")}.` });
    }
  }

  strong.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  const best = strong[0];
  return {
    autoLink: best ? { ticketId: best.c.id, distance: best.d, explanation: `Linked automatically to ${best.c.reference}: ${best.why}.` } : null,
    suggestions: suggestions.sort((a, b) => b.score - a.score).slice(0, 3),
  };
}
