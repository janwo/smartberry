FROM node:lts-alpine AS base
WORKDIR /home/node/
COPY --chown=node:node package*.json ./
RUN npm ci --no-optional && npm cache clean --force
COPY --chown=node:node *.js ./
EXPOSE 8080
CMD npm start