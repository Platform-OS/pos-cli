FROM ruby:2.5-alpine

RUN apk add --update \
      build-base \
      libxml2-dev \
      libxslt-dev && \
      rm -rf /var/cache/apk/*

RUN gem install marketplace-kit

ENTRYPOINT ["marketplace-kit"]
