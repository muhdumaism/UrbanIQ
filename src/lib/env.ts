import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CIVICFLOW_MODE: z.enum(["demo", "live"]).default("demo"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  AI_PROVIDER: z.enum(["anthropic"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  RUN_INLINE_WORKER: z.string().default("true"),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  MATCH_DISTANCE_METERS: z.coerce.number().positive().default(150),
  MATCH_STRONG_DISTANCE_METERS: z.coerce.number().positive().default(60),
  MATCH_WINDOW_DAYS: z.coerce.number().positive().default(21),
  RECURRENCE_WINDOW_DAYS: z.coerce.number().positive().default(60),
  VISION_URL: z.string().url().optional().or(z.literal("")),
  VISION_TOKEN: z.string().optional(),
  VISION_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  VISION_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  WARDS_GEOJSON_PATH: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage/uploads"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isDemoMode = () => env().CIVICFLOW_MODE === "demo";

/** True when live AI can actually be called. */
export const liveAiConfigured = () => Boolean(env().ANTHROPIC_API_KEY && env().ANTHROPIC_API_KEY!.trim().length > 0);
