# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better compatibility
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose Wrangler dev server port
EXPOSE 8787

# Set environment variable to disable telemetry
ENV WRANGLER_SEND_METRICS=false

# Default command - run dev server with remote database
CMD ["npx", "wrangler", "dev", "--remote", "--ip", "0.0.0.0"]
