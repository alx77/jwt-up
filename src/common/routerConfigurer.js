const path = require("path");
const fs = require("fs");
const j2s = require("joi-to-swagger");
const jwtHelper = require("../utils/JwtHelper");
const StatusError = require("../exceptions/StatusError");

function bindController(router, name, middleware) {
  if (!name) throw new Error("HTTP method not specified");

  name = name.toLowerCase();
  var fn = router[name];
  if (typeof fn !== "function") {
    throw new Error("Wrong method call: " + name);
  }
  fn.apply(router, middleware);
}

function auth(roles) {
  return (req, res, next) => {
    const authorization = req.preprocessed.headers.authorization;
    if (!authorization) {
      throw new StatusError(401, "UNAUTHORIZED");
    } else if (
      !(
        (roles === true && !authorization.roles) ||
        (roles !== true &&
          authorization.roles &&
          authorization.roles.some((it) => roles.includes(it)))
      )
    ) {
      throw new StatusError(403, "FORBIDDEN");
    }
    return next();
  };
}

function validate(schema) {
  return (req, res, next) => {
    let { error } = schema.validate({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
      ...(req.preprocessed || {}),
    });
    if (!!error) {
      throw error;
    }
    return next();
  };
}

const actions = {
  //TODO get rid of preprocessor, make it work from function.js->auth: "jwt-decode"
  "jwt-decode": (bearer, res) => {
    if (!bearer) throw new Error("Bearer is empty");
    const token = bearer.split(" ")[1];
    try {
      return jwtHelper.decodeTokenSync(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new StatusError(403, "TOKEN_EXPIRED");
      }
      throw err;
    }
  },
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
          const newValue = actions[rule[key]](oldValue, res);
          return Object.assign({}, acc, { [key]: newValue });
        }, {}),
      });
    }, {});
    return next();
  };
}

module.exports.configure = function (router, swaggerBuilder) {
  const controllersPath = path.join(__dirname, "../controllers");
  fs.readdirSync(controllersPath).forEach((controllerName) => {
    const cntrPath = path.join(controllersPath, controllerName);
    const configPath = path.join(cntrPath, "function.json");
    if (!fs.existsSync(configPath)) return;
    const config = require(configPath);
    swaggerBuilder &&
      swaggerBuilder.addTag({
        name: controllerName,
        description: config.description,
      });

    config.enabled &&
      config.bindings.forEach((b) => {
        if (!b.function || !b.route || !b.method)
          throw new Error(
            `'function.json' for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' misconfigured`
          );
        const middleware = prepareMiddleware(
          controllerName,
          cntrPath,
          b,
          swaggerBuilder
        );
        bindController(router, b.method, middleware);
      });
  });
};

function prepareMiddleware(controllerName, cntrPath, bindings, swaggerBuilder) {
  const params = [bindings.route];

  //validator setup
  if (bindings.validate) {
    const validationSchema = require(path.join(cntrPath, "validator.js"))[
      bindings.function
    ];
    if (!validationSchema)
      throw new Error(
        `Validator for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`
      );
    params.push(validate(validationSchema));

    swaggerBuilder &&
      setupSwaggerSections(
        swaggerBuilder,
        bindings,
        validationSchema,
        controllerName
      );
  }

  //preprocessor setup
  if (bindings.preprocess) {
    const preprocessors = require(path.join(cntrPath, "preprocessor.js"));
    if (!preprocessors || !preprocessors[bindings.function])
      throw new Error(
        `Preprocessor for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`
      );
    params.push(preprocess(preprocessors[bindings.function]));
  }

  //auth setup
  bindings.auth && params.push(auth(bindings.auth));

  let func = require(cntrPath)[bindings.function];
  if (!func) {
    throw new Error(
      `Function '${bindings.function}' for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`
    );
  }

  const stub = async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (e) {
      next(e);
    }
  };

  params.push(stub);
  return params;
}

//TODO make it work without validationSchema
function setupSwaggerSections(
  swaggerBuilder,
  binding,
  validationSchema,
  controllerName
) {
  const { function: fn, summary, description, method, route, auth } = binding;

  var keys = validationSchema.describe().keys;
  keys &&
    Object.keys(keys).forEach((key) => {
      schema = validationSchema.extract(key);
      if ("headers" == key) return;
      const { swagger } = j2s(schema);
      const schemaName = fn + "_" + key;
      swaggerBuilder.addSchemas({ [schemaName]: swagger });
      const rule = {
        tags: [controllerName],
        summary,
        description,
        operationId: fn,
        //TODO make map with codes and specify extra codes for specific endpoints
        responses: {
          200: {
            description: "OK",
          },
          201: {
            description: "Created",
          },
          401: {
            description: "Unauthorized",
          },
          403: {
            description: "Forbidden",
          },
          404: {
            description: "Not Found",
          },
          405: {
            description: "Invalid input",
          },
          409: {
            description: "Conflict",
          },
        },
      };
      if (["post", "put", "patch"].includes(method))
        Object.assign(rule, {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/" + schemaName,
                },
              },
            },
          },
        });
      const pathParams = [];
      const routeComponents = route.split("/").map((com) => {
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
          pathParams.map((param) => ({
            name: param,
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
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
              enum: value.enum,
            },
          }))
        );

      parameters.length > 0 && Object.assign(rule, { parameters });

      auth &&
        Object.assign(rule, {
          security: [
            {
              Bearer: ["global"],
            },
          ],
        });

      swaggerBuilder.addPath(swaggerRoute, method, rule);
    });
}
