import type { TriageResult } from "./schema";
import type { VisionEvidence } from "../vision";

export type TriageInput = {
  text: string | null;
  photo: { data: Buffer; mime: string; fingerprint: string | null } | null;
  locationText: string | null;
  /** Ward resolved from a confirmed pin, if any (context only). */
  wardName: string | null;
  /** Advisory detector output for the photo (null when not run). */
  vision?: VisionEvidence | null;
};

export type TriageOutput = { result: TriageResult; provider: string };

/** Error categories drive retry policy. Messages must be safe to show to officers. */
export class TriageError extends Error {
  constructor(
    message: string,
    public readonly transient: boolean,
    public readonly code: string,
  ) {
    super(message);
  }
}

export interface TriageProvider {
  readonly name: string;
  triage(input: TriageInput): Promise<TriageOutput>;
}
