# Build context is the repository root so the workspace contracts package resolves.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts-ts/package.json ./packages/contracts-ts/
COPY packages/codegen/package.json ./packages/codegen/
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY . .
EXPOSE 5173
CMD ["pnpm", "--filter", "@neural-navigator/web", "dev", "--host"]

FROM deps AS build
COPY . .
RUN pnpm --filter @neural-navigator/web build

FROM nginx:1.27-alpine AS production
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
