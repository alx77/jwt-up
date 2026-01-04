import path from "path";
import fs from "fs";
import nconf from "nconf";
import os from "os";

const hostname = os.hostname();
nconf.set("host", hostname);

const configFile = path.join(process.cwd(), "config.json");

nconf.argv().env({
  separator: "__",
  parseValues: true,
});

try {
  fs.accessSync(configFile, fs.constants.R_OK);
  nconf.file(configFile);
} catch (e) {
  console.warn("Config file is absent or insufficient privileges!", e);
}


export default nconf;