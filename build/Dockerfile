FROM node:alpine

WORKDIR /app

COPY ./src /app/src
COPY ./test /app/test
COPY ./index.js /app/index.js
COPY ./config.json /app/config.json
COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json

COPY ./jwt.key /app/jwt.key
COPY ./RS256.key.pub /app/RS256.key.pub

RUN set -ex \
    && apk add --update curl \
    && cd /app \
    && npm i

EXPOSE 8088
CMD ["npm", "start"]
