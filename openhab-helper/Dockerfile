FROM node:lts-alpine 
RUN deluser --remove-home node \
  && addgroup -S node -g 9001 \
  && adduser -S -g node -u 9001 node
RUN chown node:node /home/node

WORKDIR /home/node/
COPY --chown=node:node package*.json ./
RUN npm ci --no-optional && npm cache clean --force
COPY --chown=node:node *.js ./
EXPOSE 8080
CMD npm start