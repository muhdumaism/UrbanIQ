import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Never leak internals: log server-side, return a generic message. */
export function serverError(err: unknown) {
  if (err instanceof ZodError) return jsonError(400, "Invalid request.", { fieldErrors: err.flatten().fieldErrors });
  console.error(err);
  return jsonError(500, "Something went wrong on our side. Please try again.");
}

/** Same-origin check for state-changing requests made with cookies. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin navigations
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
