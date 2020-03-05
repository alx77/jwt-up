const path = require("path");
const fs = require("fs");
const nconf = require("nconf");
var os = require("os");
var hostname = os.hostname();

const configFile = path.join(__dirname, "../config.json");
try {
  fs.accessSync(configFile, fs.constants.R_OK);
  nconf.file(configFile);
} catch (e) {
  console.warn("Config file is absent or insufficient privileges!", e);
}

nconf.set("host", hostname);
nconf.argv().env();

module.exports = nconf;
