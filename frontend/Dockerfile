FROM oven/bun:1
WORKDIR /app

# Copy all files
COPY . .

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

# Start Next.js
CMD ["bun", "run", "start"]
