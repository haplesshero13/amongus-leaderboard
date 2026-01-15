FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Development mode - hot reload
EXPOSE 3000

ENV NODE_ENV=development

CMD ["bun", "run", "dev"]
