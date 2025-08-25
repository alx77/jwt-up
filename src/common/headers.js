const cfg = require("./config");

//prettier-ignore
module.exports.setHeaders = function (req, res) {
    let cors = cfg.get("cors");
    if (cors.enabled) {
        // Website you wish to allow to connect
        res.setHeader("Access-Control-Allow-Origin", !cors.allowAny ? req.headers.origin : ((!req.secure && req.headers.origin) ? req.headers.origin : (cors.origin ? cors.origin : "*")));

        // Request methods you wish to allow
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE, FETCH");

        // Request headers you wish to allow
        res.setHeader("Access-Control-Allow-Headers",
            "Origin, X-Requested-With, X-HTTP-Method-Override, Content-Type, Authorization, Content-Disposition, Accept");

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        res.setHeader("Access-Control-Allow-Credentials", true);

        res.setHeader("Last-Modified", (new Date()).toUTCString());
    }
}
