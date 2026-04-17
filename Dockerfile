FROM node:18-alpine AS builder
WORKDIR /app
COPY fload-app/package*.json ./
RUN npm ci
COPY fload-app/ .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
