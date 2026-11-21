#!/bin/sh
# Usage: web (default) | worker | migrate | seed | create-officer --email … --name … --role … [--department CODE]
set -e
cd /app

migrate() {
  echo "[urbaniq] applying database migrations"
  npx prisma migrate deploy
  # Departments + default routing rules (idempotent; never overwrites admin edits).
  npx tsx prisma/seed-base.ts
}

case "${1:-web}" in
  web)
    if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then migrate; fi
    if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
      echo "[urbaniq] SEED_DEMO_DATA=true: resetting and loading SAMPLE demo data"
      npx tsx prisma/seed.ts
    fi
    exec npx next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
    ;;
  worker)
    exec npx tsx scripts/worker.ts
    ;;
  migrate)
    migrate
    ;;
  seed)
    migrate
    exec npx tsx prisma/seed.ts
    ;;
  create-officer)
    shift
    exec npx tsx scripts/create-officer.ts "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
