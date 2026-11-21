import { env, isDemoMode, triageEngine } from "./env";
import { resendConfigured } from "./email-verification";
import { googleConfigured } from "./google-auth";
import { municipality, serviceRegion } from "./municipality";

type Check = { name: string; ok: boolean | null; value: string; help?: string };

async function probeVision(): Promise<Check> {
  const e = env();
  if (!e.VISION_URL) {
    return { name: "Photo detector (YOLO)", ok: false, value: "Not configured", help: "Deploy the vision service and set VISION_URL and VISION_TOKEN on the app, then redeploy." };
  }
  const base = e.VISION_URL.replace(/\/$/, "");
  try {
    const h = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    const hj = (await h.json().catch(() => ({}))) as { model?: string };
    if (hj.model !== "ready") {
      const why: Record<string, string> = {
        missing: "The service is running but the weights file is missing. Mount civic_guardian.pt at /models.",
        loading: "The model is still loading. Try again in a minute.",
        checksum_mismatch: "The weights file doesn't match EXPECTED_SHA256.",
        class_map_mismatch: "The weights file doesn't contain the expected classes.",
        error: "The model failed to load. Check the vision service logs.",
      };
      return { name: "Photo detector (YOLO)", ok: false, value: `Service reachable · model: ${hj.model ?? "unknown"}`, help: why[hj.model ?? ""] ?? "Check the vision service logs." };
    }
    const m = await fetch(`${base}/v1/model`, { headers: e.VISION_TOKEN ? { Authorization: `Bearer ${e.VISION_TOKEN}` } : {}, signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (m.status === 401) return { name: "Photo detector (YOLO)", ok: false, value: "Model ready, but the token was rejected", help: "VISION_TOKEN must be identical on the app and the vision service." };
    const mj = (await m.json().catch(() => ({}))) as { sha256?: string; names?: Record<string, string> };
    return { name: "Photo detector (YOLO)", ok: true, value: `Ready · ${Object.values(mj.names ?? {}).join(", ")}${mj.sha256 ? ` · ${mj.sha256.slice(0, 12)}…` : ""}` };
  } catch {
    return { name: "Photo detector (YOLO)", ok: false, value: `Can't reach ${base}`, help: "The vision service is down or VISION_URL is wrong. Use the vision app's internal name on the Docker network, e.g. http://urbaniq-vision:8000." };
  }
}

export async function systemStatus(): Promise<Check[]> {
  const e = env();
  const engine = triageEngine();
  const region = serviceRegion();
  return [
    { name: "Mode", ok: null, value: isDemoMode() ? "Demo (demo logins enabled)" : "Production" },
    {
      name: "Report triage",
      ok: engine === "ai" ? true : null,
      value: engine === "ai" ? `Claude AI (${e.AI_MODEL})` : "Built-in rules (English keywords)",
      help: engine === "ai" ? undefined : "Reports in other languages, or with unusual wording, may be filed as 'Other'. Add ANTHROPIC_API_KEY for AI triage, which handles Indian languages and reads photos.",
    },
    await probeVision(),
    {
      name: "Google sign-in",
      ok: googleConfigured(),
      value: googleConfigured() ? "Configured" : "Not configured",
      help: googleConfigured() ? undefined : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    },
    { name: "Account verification email", ok: resendConfigured(), value: resendConfigured() ? "Configured" : "Not configured", help: "Set RESEND_API_KEY and RESEND_FROM_EMAIL using a verified sender domain." },
    { name: "Service area", ok: null, value: region ? `${region.name} only` : "Anywhere" },
    { name: "Wards", ok: null, value: municipality().mode === "none" ? "No ward boundaries (city-wide routing)" : municipality().mode === "sample" ? "Sample wards (fictional)" : `${municipality().wards.length} configured wards` },
  ];
}
