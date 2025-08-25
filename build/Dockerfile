FROM node:alpine

WORKDIR /app

COPY ./src /app/src
COPY ./index.js /app/index.js
COPY ./config.json /app/config.json
COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json

COPY ./ES256.priv.key /app/ES256.priv.key
COPY ./ES256.pub.key /app/ES256.pub.key

RUN set -ex \
    && apk add --update curl \
    && cd /app \
    && npm i

EXPOSE 8088
CMD ["npm", "start"]
