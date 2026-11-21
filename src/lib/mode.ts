/** Mode info for rendering (server components pass it down to client components). */
import { isDemoMode, liveAiConfigured } from "./env";

export function modeInfo() {
  const demo = isDemoMode();
  return { demo, liveAi: !demo && liveAiConfigured() };
}
export type ModeInfo = ReturnType<typeof modeInfo>;
