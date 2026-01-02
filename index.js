const start = performance.now();

import { createServer } from "http";
import express from "express";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
//import prometheusExpress from "express-prom-bundle";
import { corsMiddleware, securityMiddleware } from "./src/common/headers.js";

import { configure } from "./src/common/routerConfigurer.js";
import SwaggerBuilder from "./src/common/SwaggerBuilder.js";
import cfg from "./src/common/config.js";
import log from "./src/common/logger.js";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

//import kafka from "./src/utils/KafkaHelper.js";
import { pg } from "./src/utils/KnexHelper.js";
import redis from "./src/utils/RedisHelper.js";
import { transporter } from "./src/utils/EmailHelper.js";

const app = express();
const router = express.Router();
const server = createServer(app);

//app.disable("etag");
//app.use(prometheusExpress({ includeMethod: true }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(__dirname + "/web")); //static files
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // to support URL-encoded bodies

app.use(corsMiddleware);
app.use(securityMiddleware);

app.use("/{*splat}", function (req, res, next) {
  log.debug("url:" + req.url);
  log.debug("params:" + JSON.stringify(req.params));
  log.debug("query:" + JSON.stringify(req.query));
  log.debug(
    "body:" +
      JSON.stringify(req.body, (k, v) =>
        ["password", "token"].includes(k) ? "***" : v
      )
  );
  log.debug("session:" + JSON.stringify(req.session));
  log.debug("headers:" + JSON.stringify(req.headers));
  next();
});

server.listen(cfg.get("port"));
log.info(
  `HTTP Server running on port: ${cfg.get("port")} in ${(
    performance.now() - start
  ).toFixed(2)}ms`
);

const swaggerBuilder = new SwaggerBuilder();
await configure(router, swaggerBuilder);
const basePath = "/api";
app.use(basePath, router);

swaggerBuilder.addInfo({
  description: "This is a jwt server",
  version: "1.0.0",
  title: "JWT-up server",
  contact: {
    email: "a.furmanoff(at)gmail.com",
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
//log.debug("SWAGGER:", JSON.stringify(swaggerDocument));
const swaggerOptions = {
  explorer: true,
};
app.use(
  "/swagger",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions)
);
log.info(
  `Swagger generated in ${(performance.now() - start).toFixed(2)}ms from start`
);

app.use((err, req, res, next) => {
  if (typeof err === "object") {
    const { message, stack, status } = err;
    const error = { message, stack };
    log.error("Request error:", err);
    res
      .status(status || 400)
      .json({ error })
      .end();
  } else {
    log.error("Request error:", err);
    res.status(400).json({ error: err }).end();
  }
});

process.on("unhandledRejection", (err) => {
  log.error("Unhandled:", err);
});

async function gracefulShutdown(signal) {
  log.info(`${signal} signal received. HTTP Server is shutting down...`);

  server.close(async () => {
    log.info("Closing DB connections...");
    await pg.destroy();

    log.info("Closing Redis connection...");
    await redis.quit();

    log.info("Closing SMTP connection...");
    await transporter.close();

    log.info("Server gracefully shut down.");
    log.end();

    setTimeout(() => process.exit(0), 1000);
  });

  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

//for testing purposes
export { app, server, gracefulShutdown };
