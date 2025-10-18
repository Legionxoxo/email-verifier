# Email Verifier Application - Single Stage Dockerfile
# This Dockerfile builds both frontend and backend in a single stage
# Optimized for development and easier debugging

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies needed for native modules
# - python3, make, g++: Required for building native Node.js modules (better-sqlite3)
# - sqlite: SQLite database tools
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files for both frontend and backend
# This is done separately to leverage Docker layer caching
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy the entire application
WORKDIR /app
COPY . .

# Build the frontend (builds directly to ../backend/public via vite.config.ts)
WORKDIR /app/frontend
RUN npm run build

# Create necessary directories for runtime
WORKDIR /app/backend
RUN mkdir -p .sql csv .logs

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose the application port
EXPOSE 5000

# Health check to ensure container is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "index.js"]
