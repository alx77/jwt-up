const { Pool } = require("pg");
const cfg = require("../common/config");

class PostgresHelper {
  constructor(connectionString, max = 30) {
    if (!connectionString) throw new Error("Provide connection string");
    this.connection = { connectionString, max, keepAlive: true };
  }

  buildInstance() {
    if (this.pool) return;
    this.pool = new Pool(this.connection);
    this.pool.on("error", e => {
      throw e;
    });
  }

  async query(q, params = [], resultProcessor) {
    let conn;
    try {
      this.buildInstance();
      conn = await this.pool.connect();
      const response = await this.pool.query(q, params);
      return resultProcessor ? resultProcessor(res) : response;
    } catch (e) {
      throw e;
    } finally {
      conn && conn.release(true);
    }
  }

  close() {
    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new PostgresHelper(cfg.get("POSTGRES_CONN"));
