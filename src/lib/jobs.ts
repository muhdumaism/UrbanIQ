/** Durable job queue on Postgres. Jobs survive restarts; stale PROCESSING jobs are reclaimed. */
import type { Job, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { TriageError } from "./ai/provider";
import { fileFailedTriage, processReport } from "./pipeline";

export async function enqueueTriage(tx: Prisma.TransactionClient, reportId: string) {
  return tx.job.create({ data: { type: "triage", reportId, maxAttempts: env().JOB_MAX_ATTEMPTS } });
}

async function claimNext(): Promise<Job | null> {
  const rows = await prisma.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'PROCESSING', "lockedAt" = now(), attempts = attempts + 1, "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "Job"
      WHERE (status = 'PENDING' AND "runAfter" <= now())
         OR (status = 'PROCESSING' AND "lockedAt" < now() - interval '5 minutes')
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

const backoffMs = (attempt: number) => Math.min(60_000, 2000 * 4 ** (attempt - 1));

async function runJob(job: Job) {
  try {
    await processReport(job.reportId);
    await prisma.job.update({ where: { id: job.id }, data: { status: "COMPLETED", lockedAt: null, lastError: null } });
  } catch (err) {
    const te = err instanceof TriageError ? err : null;
    const message = te ? te.message : "Internal processing error.";
    if (!te) console.error("[jobs] unexpected error", err);
    const transient = te ? te.transient : true;
    if (transient && job.attempts < job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "PENDING", lockedAt: null, lastError: message, runAfter: new Date(Date.now() + backoffMs(job.attempts)) },
      });
      await prisma.report.update({ where: { id: job.reportId }, data: { status: "PROCESSING", triageError: `Attempt ${job.attempts} failed: ${message} Retrying.` } });
      return;
    }
    await prisma.job.update({ where: { id: job.id }, data: { status: "FAILED", lockedAt: null, lastError: message } });
    try {
      await fileFailedTriage(job.reportId, message);
    } catch (e) {
      console.error("[jobs] could not file failed triage", e);
      await prisma.report.update({ where: { id: job.reportId }, data: { status: "FAILED", triageError: message } });
    }
  }
}

const g = globalThis as unknown as { __cfDraining?: boolean; __cfWorker?: NodeJS.Timeout };

/** Drain runnable jobs. Safe to call concurrently (in-process guard + SKIP LOCKED across processes). */
export async function runPendingJobs(max = 25) {
  if (g.__cfDraining) return;
  g.__cfDraining = true;
  try {
    for (let i = 0; i < max; i++) {
      const job = await claimNext();
      if (!job) break;
      await runJob(job);
    }
  } catch (e) {
    console.error("[jobs] worker loop error", e);
  } finally {
    g.__cfDraining = false;
  }
}

export function startWorker(intervalMs = 1500) {
  if (g.__cfWorker) return;
  g.__cfWorker = setInterval(() => void runPendingJobs(), intervalMs);
  console.log("[jobs] background worker started");
}

export async function retryReport(reportId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.report.update({ where: { id: reportId }, data: { status: "RECEIVED", triageError: null } });
    await enqueueTriage(tx, reportId);
  });
  void runPendingJobs();
}
