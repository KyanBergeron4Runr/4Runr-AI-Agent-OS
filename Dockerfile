# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# install system deps (openssl for crypto)
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# generate prisma client + build
RUN npx prisma generate
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# minimal runtime deps
RUN apk add --no-cache openssl curl

# copy only what's needed
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# copy example env (for reference)
COPY config/env.example ./config/env.example

EXPOSE 3000

# healthcheck hits /ready (Fastify route)
HEALTHCHECK --interval=10s --timeout=2s --retries=12 CMD curl -fsS http://localhost:3000/ready || exit 1

CMD ["node","--max-old-space-size=1024","--max-http-header-size=16384","dist/server.js"]
