import { beforeAll } from "vitest";
import waitOn from "wait-on";
import cfg from "@/common/config.js";

beforeAll(async () => {
  try {
    console.log("⏳ Waiting for PostgreSQL...");
    const url = new URL(cfg.get("POSTGRES_CONN"));

    await waitOn({
      resources: [`tcp:${url.hostname}:${url.port}`],
      timeout: 60000,
      interval: 1000,
    });

    console.log("⏳ Waiting for Redis...");
    await waitOn({
      resources: [`tcp:${cfg.get("REDIS_HOST")}:${cfg.get("REDIS_PORT")}`],
      timeout: 40000,
      interval: 1000,
    });

    console.log("✅ Infrastructure is ready!");

  } catch (error) {
    console.error("❌ Application start error:", error);
    throw error;
  }
});



