const { createServer } = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");
//const prometheusExpress = require("express-prom-bundle");

//const gracefulShutdown = require("http-graceful-shutdown");
const { setHeaders } = require("./src/common/headers");
const { configure } = require("./src/common/routerConfigurer");
const SwaggerBuilder = require("./src/common/SwaggerBuilder");
const cfg = require("./src/common/config");
const log = require("./src/common/logger");

const app = express();
const router = express.Router();
const server = createServer(app);

const kafka = require("./src/utils/KafkaHelper");
const pg = require("./src/utils/PostresHelper");
const redis = require("./src/utils/RedisHelper");

//app.disable("etag");
//app.use(prometheusExpress({ includeMethod: true }));
app.use(express.static(__dirname + "/web"));
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // to support URL-encoded bodies

app.use("*", function (req, res, next) {
  log.debug("url:" + req.url);
  log.debug("params:" + JSON.stringify(req.params));
  log.debug("query:" + JSON.stringify(req.query));
  log.debug("body:" + JSON.stringify(req.body));
  log.debug("session:" + JSON.stringify(req.session));
  log.debug("headers:" + JSON.stringify(req.headers));
  setHeaders(req, res);
  next();
});

server.listen(cfg.get("port"));
log.info("HTTP Server running on port: " + cfg.get("port"));

const swaggerBuilder = new SwaggerBuilder();
configure(router, swaggerBuilder);
const basePath = "/api";
app.use(basePath, router);

swaggerBuilder.addInfo({
  description: "This is a jwt server",
  version: "1.0.0",
  title: "JWT-up server",
  contact: {
    email: "a.furmanoff@gmail.com",
  },
  license: {
    name: "MIT License",
    url: "https://opensource.org/licenses/MIT",
  },
});
swaggerBuilder.addSecuritySchemes({
  Bearer: {
    type: "apiKey",
    name: "Authorization",
    in: "header",
  },
});

const swaggerDocument = swaggerBuilder.build();
//console.log("SWAGGER:", JSON.stringify(swaggerDocument));
const options = {
  explorer: true,
};
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

app.use((e, req, res, next) => {
  if ("object" == typeof e) {
    const { message, stack, status } = e;
    const error = { message, stack };
    log.error("", e);
    res
      .status(status || 400)
      .json({ error })
      .end();
  } else {
    log.error(e);
    res.status(400).json({ error: e }).end();
  }
});
process.on("unhandledRejection", (e) => {
  if ("object" == typeof e) {
    log.error("", e);
  } else {
    log.error(e);
  }
});

// gracefulShutdown(server, {
//   signals: "SIGINT SIGTERM",
//   timeout: 10000,
//   development: false,
//   onShutdown: async (signal) => {
//     log.info(`HTTP Server is shutting down...(${signal})`);
//     await kafka.close();
//     await pg.close();
//     await redis.close();
//     log.info(`db connections are closed`);
//   },
//   finally: () => {
//     log.info("Server gracefully shutted down.");
//     log.close();
//   }
// });
async function gracefulShutdown(signal) {
  log.info(`${signal} signal received. HTTP Server is shutting down...`);
  server.close(async () => {
    await pg.close();
    await redis.close();
    log.info("DB connections are closed. Server gracefully shut down.");
    log.close();
  });
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
module.exports = { app, server }; //for testing purposes
