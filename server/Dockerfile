# Zombie Hunt - Server Dockerfile
# Node.js API server with Socket.io

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled TypeScript output
COPY dist/ ./dist/

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3001/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
