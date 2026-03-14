import cfg from "../common/config.js";
import { Redis } from "ioredis";

const redis = new Redis({
  host: cfg.get("REDIS_HOST"),
  port: cfg.get("REDIS_PORT"),
});

export default redis;
