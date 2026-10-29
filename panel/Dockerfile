# syntax=docker/dockerfile:1
# Panel image (API + built client)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci
COPY tsconfig.json ./
COPY client/tsconfig.json client/tsconfig.json client/tsconfig.app.json client/tsconfig.node.json client/index.html client/vite.config.ts client/
COPY client/src client/src
COPY src src
RUN npm run build && cd client && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/client/dist client/dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
