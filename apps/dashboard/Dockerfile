FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm install --workspaces --if-present --include-workspace-root
COPY apps/dashboard apps/dashboard
WORKDIR /repo/apps/dashboard
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# npm workspaces hoists shared dependencies to the repo-root node_modules,
# not apps/dashboard/node_modules — see apps/api/Dockerfile for the same fix.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/dashboard/.next ./.next
COPY --from=builder /repo/apps/dashboard/package.json ./package.json
COPY --from=builder /repo/apps/dashboard/next.config.js ./next.config.js
COPY --from=builder /repo/apps/dashboard/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
