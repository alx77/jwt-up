import path from "path";
import fs from "fs";
import nconf from "nconf";
import os from "os";

const hostname = os.hostname();

const configFile = path.join(process.cwd(), "config.json");

try {
  fs.accessSync(configFile, fs.constants.R_OK);
  nconf.file(configFile);
} catch (e) {
  console.warn("Config file is absent or insufficient privileges!", e);
}

nconf.set("host", hostname);
nconf.argv().env({
  separator: "__",
  parseValues: true,
});

export default nconf;