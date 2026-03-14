import knex, { type Knex } from "knex";
import cfg from "../common/config.js";
import log from "../common/logger.js";

const pg: Knex = knex({
  client: "pg",
  connection: cfg.get("POSTGRES_CONN"),
  pool: { min: 0, max: cfg.get("POSTGRES_POOL_MAX") ?? 10 },
});

pg.on("query-error", (err: Error) => log.error("Knex error:", err));

export { pg };
