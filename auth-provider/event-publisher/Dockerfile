FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/event-publisher build

WORKDIR /app/auth-provider/event-publisher

EXPOSE 5001

CMD ["node", "dist/index.js"]