/** Mode info for rendering (server components pass it down to client components). */
import { isDemoMode, triageEngine } from "./env";

export function modeInfo() {
  const demo = isDemoMode();
  const engine = triageEngine();
  // liveAi=false only when Claude was explicitly required but no key is set (a real misconfiguration).
  return { demo, engine, liveAi: engine !== "ai_missing_key" };
}
export type ModeInfo = ReturnType<typeof modeInfo>;
