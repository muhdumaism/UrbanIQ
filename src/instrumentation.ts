export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if ((process.env.RUN_INLINE_WORKER ?? "true") === "true" && process.env.NEXT_PHASE !== "phase-production-build") {
      const { startWorker } = await import("./lib/jobs");
      startWorker();
    }
  }
}
