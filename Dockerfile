FROM node:20-bookworm-slim

# Install Chromium and required Linux libraries for Puppeteer in headless mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use installed Chromium binary and skip redundant download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm install

# Copy application source code
COPY . .

# Build application: compiles frontend to dist/ and backend to build/server.cjs
RUN npm run build

# Ensure session storage and data directories exist
RUN mkdir -p /app/.wwebjs_auth /app/data

# Expose default port
EXPOSE 8080

# Start server using the compiled bundle
CMD ["npm", "start"]
