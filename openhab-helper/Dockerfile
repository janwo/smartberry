FROM node:lts-alpine as base
RUN deluser --remove-home node \
  && addgroup -S node -g 9001 \
  && adduser -S -g node -u 9001 node
RUN chown node:node /home/node
RUN apk add --no-cache curl 
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -sS localhost:8081/healthcheck
EXPOSE 8081
EXPOSE 8082

WORKDIR /home/node/
COPY --chown=node:node package*.json angular.json ./
RUN npm ci --no-optional && npm cache clean --force
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/

FROM base AS build-production
ARG VERSION
RUN npm run frontend:build && npm run backend:build

FROM node:lts-alpine as production
WORKDIR /home/node/
COPY --from=build-production --chown=node:node /home/node/dist/ ./dist/
COPY --from=build-production --chown=node:node /home/node/package*.json ./
RUN npm ci --only=production --no-optional && npm cache clean --force 
ENV build=production
CMD npm run backend:start:build