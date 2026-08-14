FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/app-b build

WORKDIR /app/applications/app-b

EXPOSE 4001

CMD ["pnpm", "start"]