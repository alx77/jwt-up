import cfg from "./config.js";
import winston from "winston";

const { combine, errors, timestamp, colorize } = winston.format;
const colorizer = colorize();
const loglevel = cfg.get("loglevel") ?? {};

const consoleFormatter = (
  msg: winston.Logform.TransformableInfo,
): winston.Logform.TransformableInfo => {
  const message = `${msg.level[0].toUpperCase()}: ${msg["timestamp"] as string} ${(msg.stack as string | undefined) ?? msg.message}`;
  msg[Symbol.for("message")] = colorizer.colorize(msg.level, message);
  return msg;
};

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: loglevel.console ?? "info",
    format: combine(
      errors({ stack: true }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      winston.format(consoleFormatter)(),
    ),
  }),
];

const logger = winston.createLogger({ transports });

export default logger;
