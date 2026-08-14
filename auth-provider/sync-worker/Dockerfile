FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/sync-worker build

WORKDIR /app/auth-provider/sync-worker

EXPOSE 5000

CMD ["node", "dist/index.js"]