# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install dependencies required for building and prisma execution
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

WORKDIR /usr/src/app

# Install openssl for prisma engine
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled source and prisma assets
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5000

ENV NODE_ENV=production

# Run database push/migrations on startup, then start server
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
