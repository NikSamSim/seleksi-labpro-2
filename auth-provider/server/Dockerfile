FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/auth-server build

WORKDIR /app/auth-provider/server

EXPOSE 3000

CMD ["pnpm", "start"]