# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt công cụ build cần thiết
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt toàn bộ dependencies (kể cả devDependencies để build)
RUN npm install

# Copy source code và generate prisma client + build NestJS
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt chỉ production dependencies
RUN npm install --omit=dev

# Copy build artifacts từ builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3001

# Chạy migrate/push DB sau đó khởi động server NestJS
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
