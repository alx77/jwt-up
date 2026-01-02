import knex from 'knex';
import cfg from '../common/config.js';
import log from '../common/logger.js';

const pg = knex({
  client: "pg",
  connection: cfg.get("POSTGRES_CONN"),
  pool: { min: 0, max: cfg.get("POSTGRES_POOL_MAX") },
});

pg.on("query-error", (err) => log.error("Knex error:", err));

export { pg };