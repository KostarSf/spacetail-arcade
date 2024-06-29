# -------------------------------------------
FROM node:20.15.0-alpine3.20 AS base

ENV NODE_ENV production

# -------------------------------------------
FROM base AS deps

WORKDIR /app

ADD package.json package-lock.json ./

RUN npm install --include=dev

# -------------------------------------------
FROM base AS production-deps

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
ADD package.json package-lock.json ./

RUN npm prune --omit=dev

# -------------------------------------------
FROM base AS build

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
ADD . .

RUN npm run build

# -------------------------------------------
FROM base

ENV PORT="3000"
ENV WS_PORT="8080"
ENV NODE_ENV="production"

EXPOSE 3000
EXPOSE 8080

WORKDIR /app

COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package.json

CMD ["npm", "run", "serve"]
