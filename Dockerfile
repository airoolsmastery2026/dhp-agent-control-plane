FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json tsconfig.json ./
RUN pnpm install --no-frozen-lockfile
COPY src ./src
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S agent && adduser -S agent -G agent
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER agent
ENTRYPOINT ["node", "dist/cli.js"]
