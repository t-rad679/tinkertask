# syntax=docker/dockerfile:1.6
# Build context: repo root (the monorepo root containing server/ and lib/)
# Build command: docker build -f server/Dockerfile -t tinkertask-backend:dev .

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/tsconfig*.json server/nest-cli.json ./
COPY server/src ./src
COPY lib ./lib
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/lib ./lib
EXPOSE 8080
CMD ["node", "dist/main.js"]
