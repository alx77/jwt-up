import cfg from "./config.js";

export function corsMiddleware(req, res, next) {
    const cors = cfg.get("cors");
    
    if (!cors?.enabled) {
        return next();
    }

    let allowOrigin = "*";
    
    if (!cors.allowAny) {
        allowOrigin = req.headers.origin || "*";
    } else {
        if (!req.secure && req.headers.origin) {
            allowOrigin = req.headers.origin;
        } else if (cors.origin) {
            allowOrigin = cors.origin;
        }
    }
    
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE, FETCH"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, X-HTTP-Method-Override, Content-Type, Authorization, Content-Disposition, Accept"
    );
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Last-Modified", new Date().toUTCString());
    
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }
    
    next();
}

export function securityMiddleware(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
}