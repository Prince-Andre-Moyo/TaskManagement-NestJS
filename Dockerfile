# ---- build stage ----
FROM node:20-bullseye-slim AS builder

# install build deps for native modules (bcrypt etc)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# copy package manifests first (cache layer)
COPY package.json yarn.lock ./

# install all deps (dev + prod) to support builds (native modules)
RUN yarn install --frozen-lockfile

# copy source
COPY . .

# build the project (assumes "build" script compiles to dist/)
RUN yarn build

# ---- production stage ----
FROM node:20-bullseye-slim AS runner

# runtime deps for native modules if any (kept small)
RUN apt-get update \
  && apt-get install -y --no-install-recommends libc6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# copy built app and the already-built node_modules from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

# Create non-root user and chown app dir
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
  && chown -R appuser:appgroup /usr/src/app

USER appuser

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/main.js"]
