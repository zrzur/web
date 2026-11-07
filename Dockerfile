# ============================================
# Stage 1: Build the web client
# ============================================
FROM node:24-alpine AS builder

RUN apk add --no-cache git python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

WORKDIR /build

# Copy workspace config files for dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY packages/ packages/

# version info of the build (read by vite.config.ts for the source-code links)
COPY RELEASE.json ./

COPY patches/ patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build sub-dependencies (@zrzur/sdk, livekit-components, lingui plugins, panda css etc)
RUN pnpm --filter @zrzur/sdk build && \
  pnpm --filter solid-livekit-components build && \
  pnpm --filter client exec lingui compile --typescript && \
  pnpm --filter client exec node scripts/copyAssets.mjs && \
  pnpm --filter client exec panda codegen

RUN pnpm --filter client exec lingui extract
RUN pnpm --filter client exec lingui compile --typescript

# Build the client with placeholder env vars for runtime injection 
# these are replaced by inject.js at container run startup
ENV VITE_HOST=__VITE_HOST__
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_DEV_WS_URL=__VITE_WS_URL__
ENV VITE_DEV_MEDIA_URL=__VITE_MEDIA_URL__
ENV VITE_DEV_PROXY_URL=__VITE_PROXY_URL__
ENV VITE_DEV_GIFBOX_URL=__VITE_GIFBOX_URL__
ENV VITE_RNNOISE_WORKLET_CDN_URL=__VITE_RNNOISE_WORKLET_CDN_URL__
ENV VITE_INVITE_ORIGIN=__VITE_INVITE_ORIGIN__
# the public Discover and Designs sites (discover.zrzur.com, designs.zrzur.com)
ENV VITE_DISCOVER_URL=__VITE_DISCOVER_URL__
ENV VITE_DESIGNS_HOST=__VITE_DESIGNS_HOST__

# Source of this build, shown as the "Source code" link (AGPL section 13).
# The image has no .git, so pass the commit (and the tag, if any) as build args:
#   ZRZUR_GIT_COMMIT=<git rev-parse HEAD>  ZRZUR_GIT_TAG=<v... tag, optional>
ARG ZRZUR_GIT_COMMIT=
ARG ZRZUR_GIT_TAG=
ENV ZRZUR_GIT_COMMIT=${ZRZUR_GIT_COMMIT}
ENV ZRZUR_GIT_TAG=${ZRZUR_GIT_TAG}

ARG BASE_PATH=/
ARG PWA_SCOPE
ENV BASE_PATH=${BASE_PATH}
ENV PWA_SCOPE=${PWA_SCOPE}

# plugin-legacy's polyfill detection needs more than Node's default heap
RUN NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096" pnpm --filter client exec vite build

# ============================================
# Stage 2: Minimal runtime image
# ============================================
FROM node:24-alpine

WORKDIR /app

# Copy the server package and install dependencies
COPY docker/package.json docker/inject.js docker/server.js ./
RUN npm install --omit=dev

# Copy built static assets stage 1
COPY --from=builder /build/packages/client/dist ./dist

# The server for discover.zrzur.com and designs.zrzur.com (head tags,
# sitemaps, preview images): its own small install, run with
# `npm run discover` or `npm run designs`
COPY packages/public-pages/package.json packages/public-pages/package-lock.json ./public-pages/
COPY packages/public-pages/src ./public-pages/src
RUN cd public-pages && npm ci --omit=dev

EXPOSE 5000

CMD ["npm", "start"]
