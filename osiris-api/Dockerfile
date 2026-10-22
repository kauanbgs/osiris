FROM node:20-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure uploads directory exists and is owned by non-root node user
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
