FROM oven/bun:1
WORKDIR /app

# Copy all files first
COPY . .

# Debug: List what files were copied
RUN echo "=== DEBUG: Contents of /app ===" && \
    ls -la && \
    echo "=== DEBUG: Contents of src/lib ===" && \
    ls -la src/lib/ 2>/dev/null || echo "src/lib does not exist!" && \
    echo "=== DEBUG: Contents of src/lib/hooks ===" && \
    ls -la src/lib/hooks/ 2>/dev/null || echo "src/lib/hooks does not exist!" && \
    echo "=== DEBUG: Full src tree ===" && \
    find src -type f -name "*.ts" -o -name "*.tsx" | head -50

# Install dependencies
RUN bun install --frozen-lockfile

# Set build-time environment variable
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application
RUN bun run build

# Production settings
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start the application - use the standalone output
CMD ["bun", "run", ".next/standalone/server.js"]
