# UrbanIQ web app — production image for Dokploy (or any Docker host).
# Build args NEXT_PUBLIC_* are inlined into the browser bundle at build time.

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── dependencies (cached unless the lockfile changes)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── build
FROM base AS build
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=""
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID \
    NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=$NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# ── runtime
# Keeps the full node_modules so the same image can run migrations, the demo seed and the standalone worker.
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
    LOCAL_STORAGE_DIR=/app/storage/uploads
RUN groupadd --system --gid 1001 urbaniq && useradd --system --uid 1001 --gid urbaniq urbaniq
COPY --from=build --chown=urbaniq:urbaniq /app ./
RUN mkdir -p /app/storage/uploads && chown -R urbaniq:urbaniq /app/storage \
  && chmod +x /app/docker/entrypoint.sh
USER urbaniq
EXPOSE 3000
VOLUME ["/app/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
CMD ["web"]
