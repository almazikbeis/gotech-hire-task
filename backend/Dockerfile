FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN NODE_ENV=development npm ci
COPY . .
RUN npx tsc --project tsconfig.json

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
