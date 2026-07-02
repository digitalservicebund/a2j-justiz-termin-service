# Hardened Alpine base image with security upgrades
# See: https://stackoverflow.com/a/76440791/1239760
FROM node:26.3.1-alpine3.23 AS alpine-upgraded
RUN apk upgrade --no-cache && npm install -g corepack && corepack enable

# Download and install dependencies required to build the app
FROM alpine-upgraded AS build-dependencies
WORKDIR /build-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY app ./app
COPY public ./public
COPY tsconfig.json vite.config.ts react-router.config.ts ./
RUN pnpm build

# Download and install production dependencies only
FROM alpine-upgraded AS app-dependencies
WORKDIR /app-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Production runtime image
FROM alpine-upgraded AS prod
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build-dependencies /build-deps/build ./build
COPY --from=app-dependencies /app-deps/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000
USER 1000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./node_modules/.bin/react-router-serve", "./build/server/index.js"]
