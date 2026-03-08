FROM node:20-slim

WORKDIR /app

# Copy package files first (Docker cache layer optimization)
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy server code
COPY server.js ./

# Expose port
EXPOSE 3000

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
