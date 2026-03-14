import path from "path";
import fs from "fs";
import nconf from "nconf";
import os from "os";
import type { AppConfig } from "../types/index.js";

const configFile = path.join(process.cwd(), "config.json");

nconf.argv().env({ separator: "__", parseValues: true });

try {
  fs.accessSync(configFile, fs.constants.R_OK);
  nconf.file(configFile);
} catch (e) {
  console.warn("Config file is absent or insufficient privileges!", e);
}

// Set host as fallback after all stores are configured
if (!nconf.get("host")) {
  nconf.set("host", os.hostname());
}

function get<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return nconf.get(key as string) as AppConfig[K];
}

export default { get };
