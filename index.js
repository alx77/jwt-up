const { createServer } = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");
const statsd = require('express-statsd');
const gracefulShutdown = require("http-graceful-shutdown");
const { setHeaders } = require("./common/headers");
const { configure } = require("./common/routerConfigurer");
const SwaggerBuilder = require("./common/SwaggerBuilder");
const cfg = require("./common/config");
const log = require("./common/logger");

const app = express();
const router = express.Router();
const server = createServer(app);

//app.disable("etag");
app.use(express.static(__dirname + "/web"));
app.use(statsd({host: cfg.get('STATSD_HOST'), port: cfg.get('STATSD_PORT')}));
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // to support URL-encoded bodies

app.use("*", function (req, res, next) {
    log.debug("url:" + req.url);
    log.debug("params:" + JSON.stringify(req.params));
    log.debug("query:" + JSON.stringify(req.query));
    log.debug("body:" + JSON.stringify(req.body));
    log.debug("session:" + JSON.stringify(req.session));
    log.debug("headers:" + JSON.stringify(req.headers));
    setHeaders(req, res);
    next();
});

server.listen(cfg.get("port"));
log.info("HTTP Server running on port: " + cfg.get("port"));

const swaggerBuilder = new SwaggerBuilder();
configure(router, swaggerBuilder);
const basePath = "/api";
app.use(basePath, router);

swaggerBuilder.addInfo({
    "description": "This is a jwt server",
    "version": "1.0.0",
    "title": "JWT-up server",
    "contact": {
        "email": "a.furmanoff@gmail.com"
    },
    "license": {
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    }
});
swaggerBuilder.addSecuritySchemes({
    Bearer: {
        type: "apiKey",
        name: "Authorization",
        in: "header"
    }
});

const swaggerDocument = swaggerBuilder.build();
//console.log("SWAGGER:", JSON.stringify(swaggerDocument));
const options = {
    explorer: true
};
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

app.use((e, req, res, next) => {
    if ("object" == typeof e) {
        const { message, stack } = e;
        const error = { message, stack };
        log.error('' , e);
        res.status(400).json({ error }).end();
    }
    else {
        log.error(e);
        res.status(400).json({ error: e }).end();
    }
})
process.on("unhandledRejection", e => {
    if ("object" == typeof e) {
        log.error('', e);
    }
    else {
        log.error(e);
    }
});
gracefulShutdown(server);
module.exports = app;//for testing purposes
