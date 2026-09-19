FROM node:22-alpine

ENV SOURCE=/tmp/src

RUN mkdir $SOURCE


ADD . $SOURCE

WORKDIR $SOURCE/gui/next
RUN npm ci && npm run build

RUN npm install -g $SOURCE

RUN rm -rf node_modules && rm -rf gui/next/node_modules

RUN mkdir /app
WORKDIR /app
