FROM node:25-alpine

ADD . /app
WORKDIR /app
RUN npm install
EXPOSE 8088
CMD ["node", "index.js"]
