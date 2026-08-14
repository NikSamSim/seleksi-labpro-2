FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @labpro/app-a build

WORKDIR /app/applications/app-a

EXPOSE 4000

CMD ["pnpm", "start"]