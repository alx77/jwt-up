const { pg } = require("../src/utils/KnexHelper");
const redis = require("../src/utils/RedisHelper");
const path = require("path");
const fs = require("fs");

class StorageInitializer {
  async runScript(fileName) {
    const sqlFile = path.join(__dirname, "..", "db", "sql", fileName);
    if (!fs.existsSync(sqlFile))
      throw new Error(`SQL file doesn't exist: ${fileName}`);

    const query = fs.readFileSync(sqlFile, "utf8");
    await pg.query(query);
  }

  async init() {
    await this.runScript("drop.schema.users.sql");
    await this.runScript("create.schema.users.sql");
    await this.runScript("data.demo.users.sql");
  }

  async cleanRedisKeysByPattern(keysPattern = "*") {
    const keys = await redis.keys(keysPattern);
    keys.length && (await redis.del(...keys));
    await redis.close();
  }

  destroy() {
    pg.destroy();
    redis.close();
  }
}

module.exports = new StorageInitializer();
