FROM node:lts-alpine as base
USER node
WORKDIR /home/node/

COPY --chown=node:node *.json *.md ./
RUN npm ci && npm cache clean --force

COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/
RUN npm run frontend:build && npm run backend:build

FROM node:lts-alpine as production
RUN apk add --no-cache curl
RUN deluser --remove-home node \
  && addgroup -S node -g 9001 \
  && adduser -S -g node -u 9001 node
EXPOSE 8081
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -sS localhost:8081/healthcheck
USER node
WORKDIR /home/node/

COPY --from=base --chown=node:node /home/node/dist/ ./dist/
COPY --from=base --chown=node:node /home/node/package*.json ./
RUN npm ci --production && npm cache clean --force 
ENV build=production
CMD npm run backend:start:build