const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const winston = require("winston");
const WinstonGraylog2 = require('winston-graylog2');
const { combine, errors, json, splat, timestamp, colorize } = winston.format;
const colorizer = colorize();
const loglevel = cfg.get("loglevel");
const jsonFormatter = (msg) => {
    const json = Object.assign({ timestamp: new Date() }, msg);
    msg[Symbol.for("message")] = JSON.stringify(json);
    return msg;
};
const consoleFormatter = (msg) => {
    const message = `${msg.level[0].toUpperCase()}: ${msg.timestamp} ${msg.stack || msg.message}`;
    msg[Symbol.for("message")] = colorizer.colorize(msg.level, message);
    return msg;
};
const transports = [new winston.transports.Console({
    level: loglevel.console || 'info',
    format: combine(errors({ stack: true }), timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
        winston.format(consoleFormatter)()
    )
})];

cfg.get("GRAYLOG_HOST") && transports.push(new WinstonGraylog2({
    name: 'JWT-UP',
    level: loglevel.graylog || 'info',
    graylog: {
        servers: [{ host: cfg.get("GRAYLOG_HOST"), port: cfg.get("GRAYLOG_PORT") }],
        facility: 'jwt-up'
    },
    staticMeta: { env: cfg.get("NODE_ENV") }
}))
// try {
//     const logDirectory = path.join(__dirname, "../log");
//     fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
//     fs.accessSync(logDirectory, fs.constants.W_OK);
//     transports.push(new winston.transports.File({
//         filename: "log/error.log", level: cfg.get("loglevel").file, format: winston.format(jsonFormatter)()
//     }));
// }
// catch (e) {
//     console.warn("Log directory is write protected!", e)
// }

const logger = winston.createLogger({ transports });

module.exports = logger;
