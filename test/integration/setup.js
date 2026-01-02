import { beforeAll } from "vitest";
import waitOn from "wait-on";

beforeAll(async () => {
  try {
    console.log("⏳ Waiting for PostgreSQL...");
    await waitOn({
      resources: ["tcp:localhost:25432"],
      timeout: 60000,
      interval: 1000,
    });

    console.log("⏳ Waiting for Redis...");
    await waitOn({
      resources: ["tcp:localhost:6379"],
      timeout: 30000,
      interval: 1000,
    });

    console.log("✅ Infrastructure is ready!");

  } catch (error) {
    console.error("❌ Application start error:", error);
    throw error;
  }
});



