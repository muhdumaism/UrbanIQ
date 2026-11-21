// Load .env for standalone scripts (Next.js loads it automatically for the web app).
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file: rely on the real environment */
}
