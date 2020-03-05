const path = require("path");
const fs = require("fs");
const joi = require("joi");
const cfg = require("./config");
const log = require("./logger");
const jwt = require("jsonwebtoken");
const j2s = require("joi-to-swagger");

const { encodeId, decodeId } = require("../utils/hashids");

function bindController(router, name, middleware) {
  if (!name) throw new Error("HTTP method not specified");

  name = name.toLowerCase();
  var fn = router[name];
  if (typeof fn !== "function") {
    throw new Error("Wrong method call: " + name);
  }
  fn.apply(router, middleware);
}

function auth(role) {
  return (req, res, next) => {
    const authorization = req.preprocessed.headers.authorization;
    if (!authorization) {
      return res.sendStatus(403);
    } else if (!authorization.roles || !authorization.roles.includes(role)) {
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
    return jwt.verify(token.split(" ")[1], cfg.get("SERVER_KEY"));
  }
};

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

module.exports.configure = function(router, swaggerBuilder) {
  const controllersPath = path.join(__dirname, "../controllers");
  fs.readdirSync(controllersPath).forEach(cntrName => {
    const cntrPath = path.join(controllersPath, cntrName);
    const configPath = path.join(cntrPath, "function.json");
    if (!fs.existsSync(configPath)) return;
    const config = require(configPath);
    swaggerBuilder &&
      swaggerBuilder.addTag({
        name: cntrName,
        description: config.description
      });

    config.enabled &&
      config.bindings.forEach(b => {
        if (!b.function || !b.route || !b.method)
          throw new Error(
            `'function.json' for controller: '${cntrName}', route: '${bindings.route}', method: '${bindings.method}' misconfigured`
          );
        const middleware = prepareMiddleware(
          cntrName,
          cntrPath,
          b,
          swaggerBuilder
        );
        bindController(router, b.method, middleware);
      });
  });
};

function prepareMiddleware(cntrName, cntrPath, bindings, swaggerBuilder) {
  const params = [bindings.route];

  if (bindings.preprocess) {
    const preprocessors = require(path.join(cntrPath, "preprocessor.js"));
    if (!preprocessors || !preprocessors[bindings.function])
      throw new Error(
        `Preprocessor for controller: '${cntrName}', route: '${bindings.route}', method: '${bindings.method}' is not exist`
      );
    params.push(preprocess(preprocessors[bindings.function]));
  }

  bindings.auth && params.push(auth("admin"));

  if (bindings.validate) {
    const validationSchema = require(path.join(cntrPath, "validator.js"))[
      bindings.function
    ];
    if (!validationSchema)
      throw new Error(
        `Validator for controller: '${cntrName}', route: '${bindings.route}', method: '${bindings.method}' is not exist`
      );
    params.push(validate(validationSchema));

    swaggerBuilder &&
      setupSwaggerSections(
        swaggerBuilder,
        bindings,
        validationSchema,
        cntrName
      );
  }

  let func = require(cntrPath)[bindings.function];
  if (!func) {
    throw new Error(
      `Function '${bindings.function}' for controller: '${cntrName}', route: '${bindings.route}', method: '${bindings.method}' is not exist`
    );
  }
  params.push(func);
  return params;
}

function setupSwaggerSections(
  swaggerBuilder,
  binding,
  validationSchema,
  cntrName
) {
  const { function: fn, summary, description, method, route, auth } = binding;

  validationSchema._inner.children &&
    validationSchema._inner.children.forEach(({ key, schema }) => {
      if ("headers" == key) return;
      const { swagger } = j2s(schema);
      const schemaName = fn + "_" + key;
      swaggerBuilder.addSchemas({ [schemaName]: swagger });
      const rule = {
        tags: [cntrName],
        summary,
        description,
        operationId: fn,
        responses: {
          "200": {
            description: "OK"
          },
          "201": {
            description: "Created"
          },
          "401": {
            description: "Unauthorized"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Not Found"
          },
          "405": {
            description: "Invalid input"
          }
        }
      };
      if (["post", "patch"].includes(method))
        Object.assign(rule, {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/" + schemaName
                }
              }
            }
          }
        });
      const pathParams = [];
      const routeComponents = route.split("/").map(com => {
        if (com.indexOf(":") === 0) {
          pathParams.push(com.substring(1));
          return `{${com.substring(1)}}`;
        }
        return com;
      });

      const swaggerRoute = routeComponents.join("/");

      let parameters = [];
      if ("params" == key)
        parameters = parameters.concat(
          pathParams.map(param => ({
            name: param,
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }))
        );

      if ("query" == key)
        parameters = parameters.concat(
          Object.entries(swagger.properties).map(([field, value]) => ({
            name: field,
            in: "query",
            description,
            required: (swagger.required || []).indexOf(field) > -1,
            schema: {
              type: value.type,
              maximum: value.maximum,
              default: value.default,
              enum: value.enum
            }
          }))
        );

      parameters.length > 0 && Object.assign(rule, { parameters });

      auth &&
        Object.assign(rule, {
          security: [
            {
              Bearer: ["global"]
            }
          ]
        });

      swaggerBuilder.addPath(swaggerRoute, method, rule);
    });
}
