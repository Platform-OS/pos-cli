FROM node:14-alpine

ENV SOURCE=/tmp/src

RUN mkdir $SOURCE

#RUN apk update -qq && apk add vim curl ruby

ADD . $SOURCE

WORKDIR $SOURCE/gui/admin
RUN npm ci && npm run build

RUN npm install -g $SOURCE

RUN rm -rf node_modules && rm -rf gui/admin/node_modules

RUN mkdir /app
WORKDIR /app
