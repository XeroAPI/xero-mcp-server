FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm install -g supergateway@^2 \
    && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 8000
CMD ["supergateway", "--stdio", "node /app/dist/index.js", "--port", "8000", "--host", "0.0.0.0"]
