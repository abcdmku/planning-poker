# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production && npm install tsx

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server.ts ./
COPY tsconfig.json ./
COPY src/server ./src/server
COPY src/lib/socket.types.ts ./src/lib/socket.types.ts

# Set production environment
ENV NODE_ENV=production

# Expose port (single port for everything!)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the unified server
CMD ["npx", "tsx", "server.ts"]