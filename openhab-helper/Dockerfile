FROM node:lts-alpine 
RUN deluser --remove-home node \
  && addgroup -S node -g 9001 \
  && adduser -S -g node -u 9001 node
RUN chown node:node /home/node
RUN apk add --no-cache curl dumb-init 
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -sS localhost:8080/healthcheck

WORKDIR /home/node/
COPY --chown=node:node package*.json ./
RUN npm ci --no-optional && npm cache clean --force
COPY --chown=node:node ./*.js ./
COPY --chown=node:node ./plugins/*.js ./plugins/
EXPOSE 8080
CMD ["dumb-init", "node", "index.js"]