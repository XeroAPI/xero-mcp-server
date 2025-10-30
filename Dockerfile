FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with the lockfile to ensure reproducible builds
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the source and build outputs
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript sources to JavaScript
RUN npm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy build output from the builder stage
COPY --from=builder /app/dist dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "const http = require('http'); const port = process.env.PORT || 3000; http.get({ host: '127.0.0.1', port, path: '/healthz' }, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "dist/server.js"]
