const cfg = require("./config");
const winston = require("winston");
const WinstonGraylog2 = require("winston-graylog2");
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

cfg.get("GRAYLOG_HOST") &&
  transports.push(
    new WinstonGraylog2({
      name: "JWT-UP",
      level: loglevel.graylog || "info",
      graylog: {
        servers: [
          { host: cfg.get("GRAYLOG_HOST"), port: cfg.get("GRAYLOG_PORT") }
        ],
        facility: "jwt-up"
      },
      staticMeta: { env: cfg.get("NODE_ENV") }
    })
  );

const logger = winston.createLogger({ transports });

module.exports = logger;
