FROM node:20-alpine
WORKDIR /app
COPY fload-app/package*.json ./
RUN npm ci
COPY fload-app/ .
RUN npm run build
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
