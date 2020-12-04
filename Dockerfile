FROM node:14-alpine

ENV SOURCE=/tmp/src

RUN mkdir $SOURCE

ADD . $SOURCE

RUN apk update -qq && apk add vim curl && npm install -g $SOURCE

RUN mkdir /app
WORKDIR /app
