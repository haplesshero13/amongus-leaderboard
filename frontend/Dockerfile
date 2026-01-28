FROM oven/bun:1
WORKDIR /app

# Copy all files first
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Set build-time environment variable
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application with bun
RUN bun --bun next build

# Copy static files to standalone output
RUN cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/

# Production settings
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start the application with bun
CMD ["bun", "--bun", "next", "start"]
