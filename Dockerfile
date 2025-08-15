# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Vite application (creates dist folder)
RUN npm run build

# Production stage
FROM node:20-alpine

# Install serve for static file serving and tsx for TypeScript execution
RUN npm install -g serve concurrently tsx

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy socket server and its dependencies
COPY socket-server.ts ./
COPY tsconfig.json ./
COPY src/server ./src/server
COPY src/lib/socket.types.ts ./src/lib/socket.types.ts

# Create a startup script
RUN echo '#!/bin/sh' > start.sh && \
    echo 'concurrently \' >> start.sh && \
    echo '  "serve -s dist -l 3000" \' >> start.sh && \
    echo '  "tsx socket-server.ts"' >> start.sh && \
    chmod +x start.sh

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start both services
CMD ["./start.sh"]