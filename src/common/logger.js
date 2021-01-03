const cfg = require("./config");
const winston = require("winston");
const { combine, errors, timestamp, colorize } = winston.format;
const colorizer = colorize();
const loglevel = cfg.get("loglevel");

const consoleFormatter = msg => {
  const message = `${msg.level[0].toUpperCase()}: ${msg.timestamp} ${msg.stack || msg.message}`; //prettier-ignore
  msg[Symbol.for("message")] = colorizer.colorize(msg.level, message);
  return msg;
};

const transports = [
  new winston.transports.Console({
    level: loglevel.console || "info",
    format: combine(
      errors({ stack: true }),
      timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS"
      }),
      winston.format(consoleFormatter)()
    )
  })
];

const logger = winston.createLogger({ transports });

module.exports = logger;
