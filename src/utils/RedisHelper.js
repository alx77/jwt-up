const cfg = require("../common/config");
const Redis = require("ioredis");

const redis = new Redis({
  host: cfg.get("REDIS_HOST"),
  port: cfg.get("REDIS_PORT"),
});

module.exports = redis;
