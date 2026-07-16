FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm install --workspaces --if-present --include-workspace-root
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/node_modules ./node_modules
COPY --from=builder /repo/node_modules /node_modules_root
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/main.js"]
