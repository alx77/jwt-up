const start = performance.now();

import { createServer } from "http";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
import { corsMiddleware, securityMiddleware } from "./src/common/headers.js";
import { configure } from "./src/common/routerConfigurer.js";
import SwaggerBuilder from "./src/common/SwaggerBuilder.js";
import cfg from "./src/common/config.js";
import log from "./src/common/logger.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pg } from "./src/utils/KnexHelper.js";
import redis from "./src/utils/RedisHelper.js";
import { transporter } from "./src/utils/EmailHelper.js";
//import prometheusExpress from "express-prom-bundle";
//import kafka from "./src/utils/KafkaHelper.js";

const app = express();
const router = express.Router();
const server = createServer(app);
//app.disable("etag");
//app.use(prometheusExpress({ includeMethod: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, "web")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(securityMiddleware);

app.use("/{*splat}", (req: Request, _res: Response, next: NextFunction) => {
  log.debug("url:" + req.url);
  log.debug("params:" + JSON.stringify(req.params));
  log.debug("query:" + JSON.stringify(req.query));
  log.debug(
    "body:" +
      JSON.stringify(req.body, (k, v) =>
        ["password", "token"].includes(k) ? "***" : v,
      ),
  );
  log.debug("headers:" + JSON.stringify(req.headers));
  next();
});

server.listen(cfg.get("port"));
log.info(
  `HTTP Server running on port: ${cfg.get("port")} in ${(performance.now() - start).toFixed(2)}ms`,
);

const swaggerBuilder = new SwaggerBuilder();
await configure(router, swaggerBuilder);
const basePath = "/api";
app.use(basePath, router);

swaggerBuilder.addInfo({
  description: "This is a jwt server",
  version: "1.0.0",
  title: "JWT-up server",
  contact: { email: "a.furmanoff(at)gmail.com" },
  license: { name: "MIT License", url: "https://opensource.org/licenses/MIT" },
});

swaggerBuilder.addSecuritySchemes({
  Bearer: { type: "apiKey", name: "Authorization", in: "header" },
});

const swaggerDocument = swaggerBuilder.build();
//log.debug("SWAGGER:", JSON.stringify(swaggerDocument));
const swaggerOptions = { explorer: true };
app.use(
  "/swagger",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions),
);
log.info(
  `Swagger generated in ${(performance.now() - start).toFixed(2)}ms from start`,
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status ?? 400;
    log.error("Request error:", err);
    res
      .status(status)
      .json({ error: { message: err.message } })
      .end();
  } else {
    log.error("Request error:", err);
    res.status(400).json({ error: err }).end();
  }
});

process.on("unhandledRejection", (err) => {
  log.error("Unhandled:", err);
});

async function gracefulShutdown(signal: string): Promise<void> {
  log.info(`${signal} signal received. HTTP Server is shutting down...`);

  server.close(async () => {
    log.info("Closing DB connections...");
    await pg.destroy();

    log.info("Closing Redis connection...");
    await redis.quit();

    log.info("Closing SMTP connection...");
    transporter.close();

    log.info("Server gracefully shut down.");

    setTimeout(() => process.exit(0), 1000);
  });

  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

//for testing purposes
export { app, server, gracefulShutdown };
