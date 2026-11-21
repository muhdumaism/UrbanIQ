import { defineConfig } from "vitest/config";
import path from "path";

// OAuth and mail contract tests use mocked providers and do not require PostgreSQL.
export default defineConfig({
  resolve: { alias: { "@": path.resolve("src") } },
  test: { include: ["tests/google-flow.test.ts"] },
});
