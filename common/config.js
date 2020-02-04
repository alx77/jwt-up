const path = require("path");
const fs = require("fs");
const nconf = require("nconf");

const configFile = path.join(__dirname, "../config.json");

try {
    fs.accessSync(configFile, fs.constants.R_OK);
    nconf.file(configFile);
}
catch (e) {
    console.warn("Config file is absent or insufficient privileges!", e);
}

nconf.set("host", "localhost");
module.exports = nconf;
