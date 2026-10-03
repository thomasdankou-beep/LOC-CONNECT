# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les valeurs ci-dessous ne servent qu'à la compilation : aucune n'est conservée dans l'image finale.
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL="postgresql://build:build@localhost:5432/build" AUTH_SECRET="build-time-secret-build-time-secret-0000" PAYMENT_WEBHOOK_SECRET="build-time-webhook-secret-0000" CRON_SECRET="build-time-cron-secret"
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.mjs ./next.config.mjs
RUN mkdir -p /app/storage && chown -R node:node /app/storage /app/.next
USER node
EXPOSE 3000
VOLUME ["/app/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# Applique les migrations en attente, puis démarre le serveur.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
