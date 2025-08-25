const cfg = require("../common/config");
const log = require("../common/logger");

const pg = require("knex")({
  client: "pg",
  connection: cfg.get("POSTGRES_CONN"),
  pool: { min: 0, max: cfg.get("POSTGRES_POOL_MAX") },
});

pg.on("query-error", (err) => log.error("Knex error:", err));

module.exports = { pg };
