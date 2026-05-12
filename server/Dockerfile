# syntax=docker/dockerfile:1.6
# Build context: repo root (kept for parity with other server/ tooling that
# references the repo root; the image itself only needs files under server/).
# Build command: docker build -f server/Dockerfile -t tinkertask-backend:dev .

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/tsconfig*.json server/nest-cli.json ./
COPY server/src ./src
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
