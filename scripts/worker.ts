import "./load-env";
/** Standalone worker: `npm run worker` (set RUN_INLINE_WORKER=false on the web server). */
import { runPendingJobs } from "../src/lib/jobs";

console.log("[worker] UrbanIQ triage worker running");
const tick = async () => {
  await runPendingJobs(50);
  setTimeout(tick, 1000);
};
tick();
