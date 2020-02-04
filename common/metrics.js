const Lynx = require("lynx");
const cfg = require("./config");

module.exports = new Lynx(cfg.get('STATSD_HOST'), cfg.get('STATSD_PORT'));