import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Officer, Ticket } from "@prisma/client";
import { prisma } from "./db";
import { newSessionToken, sha256 } from "./tokens";
import { isDemoMode } from "./env";

export const SESSION_COOKIE = "cf_officer";
const SESSION_HOURS = 12;

export type SessionOfficer = Pick<Officer, "id" | "email" | "name" | "role" | "departmentId" | "isDemo"> & {
  departmentName: string | null;
};

export async function verifyCredentials(email: string, password: string) {
  const officer = await prisma.officer.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Always run a bcrypt compare to keep timing similar for unknown emails.
  const ok = await bcrypt.compare(password, officer?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!officer || !ok) return { ok: false as const, error: "Email or password is incorrect." };
  if (officer.isDemo && !isDemoMode()) {
    return { ok: false as const, error: "Demo accounts are disabled outside demo mode." };
  }
  return { ok: true as const, officer };
}

export async function createSession(officerId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await prisma.officerSession.create({ data: { tokenHash: sha256(token), officerId, expiresAt } });
  return { token, expiresAt };
}

export async function officerFromToken(token: string | undefined | null): Promise<SessionOfficer | null> {
  if (!token || token.length > 128) return null;
  const session = await prisma.officerSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { officer: { include: { department: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const o = session.officer;
  if (o.isDemo && !isDemoMode()) return null;
  return {
    id: o.id,
    email: o.email,
    name: o.name,
    role: o.role,
    departmentId: o.departmentId,
    isDemo: o.isDemo,
    departmentName: o.department?.name ?? null,
  };
}

/** Server-side session check for route handlers and server components. */
export async function currentOfficer() {
  const jar = await cookies();
  return officerFromToken(jar.get(SESSION_COOKIE)?.value);
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.officerSession.deleteMany({ where: { tokenHash: sha256(token) } });
}

/**
 * Permission model:
 *  - SUPERVISOR: may act on any ticket, reroute anywhere, correct severity.
 *  - OFFICER: may act on tickets owned by their department or not yet owned by anyone.
 */
export function canActOnTicket(officer: Pick<SessionOfficer, "role" | "departmentId">, ticket: Pick<Ticket, "departmentId">) {
  if (officer.role === "SUPERVISOR") return true;
  return ticket.departmentId === null || ticket.departmentId === officer.departmentId;
}
