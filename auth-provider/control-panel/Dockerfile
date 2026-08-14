FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/control-panel build

WORKDIR /app/auth-provider/control-panel

EXPOSE 3001

CMD ["pnpm", "preview"]