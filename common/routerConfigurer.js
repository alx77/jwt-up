const path = require("path");
const fs = require("fs");
const joi = require("joi");
const cfg = require("./config");
const ah = require("./AspectHelper");
const metrics = require("./metrics");
const log = require("./logger");
const jwt = require("jsonwebtoken");
const j2s = require("joi-to-swagger");

const { encodeId, decodeId } = require("./hashids");

const timers = {}
async function preHttp() {
    const mName = `${this.constructor.name}.${this.name}.time`;
    console.log(`preHttp:${mName}`);
    timers[mName] = metrics.createTimer(mName);
}

async function postHttp() {
    const mName = `${this.constructor.name}.${this.name}.time`;
    console.log(`postHttp:${mName}`);
    timers[mName].stop();
    delete timers[mName];
}

function runMethod(router, name, arguments) {
    if (!name) {
        throw new Error("HTTP method not specified");
    }
    name = name.toLowerCase();
    var fn = router[name];
    if (typeof fn !== "function") {
        throw new Error("Wrong method call: " + name);
    }
    fn.apply(router, arguments);
}

function auth(role) {
    return (req, res, next) => {
        const authorization = req.preprocessed.headers.authorization;
        if (!authorization) {
            return res.sendStatus(403);
        }
        else if (!authorization.roles || !authorization.roles.includes(role)) {
            return res.sendStatus(401);
        }
        return next();
    };
}

function validate(validator) {
    return (req, res, next) => {
        ({ error } = joi.validate(req, validator));
        if (!!error) {
            throw error;
        }
        return next();
    };
}

const actions = {
    "hash-decode": id => decodeId(id),
    "jwt-decode": token => {
        if (!token) throw new Error("Bad jwt");
        return jwt.verify(token.split(" ")[1], cfg.get('SERVER_KEY'));
    },
    "pg-sql-escape": sql => `'${sql.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}'`,
    "json-escape": json => (typeof json == "string") && json.replace(/[\\]/g, "\\\\").replace(/[\/]/g, "\\/")
        .replace(/[\b]/g, "\\b").replace(/[\f]/g, "\\f").replace(/[\n]/g, "\\n")
        .replace(/[\r]/g, "\\r").replace(/[\t]/g, "\\t").replace(/[\"]/g, '\\"')
        .replace(/\\'/g, "\\'") || json
}

function preprocess(rules) {
    return (req, res, next) => {
        //TODO: error handling
        req.preprocessed = undefined;
        if (!rules) {
            return next();
        }
        req.preprocessed = Object.entries(rules).reduce((acc, [section, rule]) => {
            return Object.assign({}, acc, {
                [section]: Object.keys(rule).reduce((acc, key) => {
                    const oldValue = req[section][key];
                    const newValue = actions[rule[key]](oldValue);
                    return Object.assign({}, acc, { [key]: newValue });
                }, {})
            });
        }, {});
        return next();
    };
}

module.exports.configure = function (router, swaggerBuilder) {
    const endpointsPath = path.join(__dirname, "../endpoints");
    fs.readdirSync(endpointsPath).forEach(ep => {
        const epPath = path.join(endpointsPath, ep);
        const configPath = path.join(epPath, "function.json");
        if (!fs.existsSync(configPath)) return;
        const config = require(configPath);
        swaggerBuilder.addTag({
            "name": ep,
            "description": ep.description
        });

        config.enabled && config.bindings.forEach(b => {переписать на аспекты
            //TODO: error handling
            let func = require(epPath)[b.function];
            func.name && ah(func, `^${func.name}$`, preHttp, postHttp);
            const params = [b.route];
            b.preprocess && params.push(preprocess(require(path.join(epPath, "preprocessor.js"))[b.function]));
            b.auth && params.push(auth("admin"));
            if (b.validate) {
                const validationSchema = require(path.join(epPath, "validator.js"))[b.function];
                params.push(validate(validationSchema));
                setupSwaggerSections(swaggerBuilder, b, validationSchema, ep);
            }
            params.push(func);
            runMethod(router, b.method, params);
        });
    });
}

function setupSwaggerSections(swaggerBuilder, binding, validationSchema, ep) {
    const {
        "function": fn,
        summary,
        description,
        method,
        route,
        auth
    } = binding;

    validationSchema._inner.children
        && validationSchema._inner.children.forEach(({ key, schema }) => {
            if ("headers" == key) return;
            const { swagger } = j2s(schema);
            const schemaName = fn + "_" + key;
            swaggerBuilder.addSchemas({ [schemaName]: swagger });
            const rule = {
                tags: [ep],
                summary,
                description,
                operationId: fn,
                responses: {
                    "200": {
                        "description": "OK"
                    },
                    "201": {
                        "description": "Created"
                    },
                    "401": {
                        "description": "Unauthorized"
                    },
                    "403": {
                        "description": "Forbidden"
                    },
                    "404": {
                        "description": "Not Found"
                    },
                    "405": {
                        description: "Invalid input"
                    }
                }
            }
            if (["post", "patch"].includes(method)) Object.assign(rule, {
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                "$ref": "#/components/schemas/" + schemaName
                            }
                        }
                    }
                },
            })
            const pathParams = [];
            const routeComponents = route.split('/').map(com => {
                if (com.indexOf(':') === 0) {
                    pathParams.push(com.substring(1));
                    return `{${com.substring(1)}}`;
                }
                return com;
            });

            const swaggerRoute = routeComponents.join('/');

            let parameters = [];
            if ("params" == key)
                parameters = parameters.concat(pathParams.map(param => (
                    {
                        name: param,
                        in: 'path',
                        required: true,
                        schema: {
                            type: 'string'
                        }
                    }
                )));

            if ("query" == key)
                parameters = parameters.concat(Object.entries(swagger.properties).map(([field, value]) => (
                    {
                        name: field,
                        in: 'query',
                        description,
                        required: (swagger.required || []).indexOf(field) > -1,
                        schema: {
                            type: value.type,
                            maximum: value.maximum,
                            default: value.default,
                            enum: value.enum
                        },
                    }
                )));

            (parameters.length > 0) && Object.assign(rule, { parameters });

            auth && Object.assign(rule, {
                "security": [
                    {
                        "Bearer": [
                            "global"
                        ]
                    }
                ]
            });

            swaggerBuilder.addPath(swaggerRoute, method, rule);
        });
}
