FROM node:22-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
COPY README.md LICENSE start-server.sh glama.json ./
COPY examples ./examples

RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js", "http"]
