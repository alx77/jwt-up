import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import j2s from "joi-to-swagger";
import jwtHelper from "../utils/JwtHelper.js";
import StatusError from "../exceptions/StatusError.js";
import Joi from "joi";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    if (!req.headers.authorization) throw new StatusError(401, "UNAUTHORIZED");
    const bearer = req.headers.authorization;
    const token = bearer.split(" ")[1];
    const context = req.headers["x-issuer-context"] ?? "default";

    try {
      req.preprocessed = {
        headers: {
          authorization: jwtHelper.decodeTokenSync(token, context),
        },
      };
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new StatusError(403, "TOKEN_EXPIRED");
      }
      if (err.name === "JsonWebTokenError") {
        throw new StatusError(403, "TOKEN_MALFORMED");
      }
      throw err;
    }

    const authorization = req.preprocessed.headers.authorization;
    if (!authorization) {
      throw new StatusError(401, "UNAUTHORIZED");
    } else if (
      !(
        (roles === true && !!authorization.roles) ||
        (roles === true && authorization?.aud === "refresh") ||
        (roles !== true &&
          !!authorization.roles &&
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

export async function configure(router, swaggerBuilder) {
  const controllersPath = path.join(__dirname, "../controllers");
  const controllerDirs = fs.readdirSync(controllersPath);
  await Promise.all(controllerDirs.map(async (controllerName) => {
    const cntrPath = path.join(controllersPath, controllerName);
    const configPath = path.join(cntrPath, "function.json");
    if (!fs.existsSync(configPath)) return;
    const config = require(configPath);
    swaggerBuilder &&
      swaggerBuilder.addTag({
        name: controllerName,
        description: config.description,
      });

    if (config.enabled) {
      await Promise.all(config.bindings.map(async (b) => {
        if (!b.function || !b.route || !b.method)
          throw new Error(
            `'function.json' for controller: '${controllerName}', route: '${b.route}', method: '${b.method}' misconfigured`
          );
        const middleware = await prepareMiddleware(
          controllerName,
          cntrPath,
          b,
          swaggerBuilder
        );
        bindController(router, b.method, middleware);
      }));
    }
  }));
}

async function prepareMiddleware(controllerName, cntrPath, bindings, swaggerBuilder) {
  const params = [bindings.route];

  //validator setup
  let validationSchema;

  if (bindings.validate) {
    const validatorPath = path.join(cntrPath, "validator.js");
    if (fs.existsSync(validatorPath)) {
      const validatorModule = await import(`file://${validatorPath}`);
      if (typeof validatorModule.default === "object" && validatorModule.default[bindings.function]) {
        validationSchema = validatorModule.default[bindings.function];
      }
    }
    if (!validationSchema)
      throw new Error(
        `Validation schema for function '${bindings.function}' for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`
      );
    params.push(validate(validationSchema));
  }

  if (!bindings.hide)
    swaggerBuilder &&
      setupSwaggerSections(
        swaggerBuilder,
        bindings,
        validationSchema,
        controllerName
      );

  //auth setup
  bindings.auth && params.push(auth(bindings.auth));

  const module = await import(`file://${cntrPath}/index.js`);
  let func;
  if (typeof module.default === "object" && module.default[bindings.function]) {
    // export default { jwk, otherFunc }
    func = module.default[bindings.function];
  } else {
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

function setupSwaggerSections(
  swaggerBuilder,
  binding,
  validationSchema,
  controllerName
) {
  const {
    function: fn,
    summary,
    description,
    method,
    route,
    auth,
    responses,
  } = binding;

  validationSchema =
    validationSchema ||
    Joi.object().unknown().keys({
      params: Joi.object(),
    });

  var keys = validationSchema.describe().keys;
  keys &&
    Object.keys(keys).forEach((key) => {
      const schema = validationSchema.extract(key);
      if ("headers" == key) return;
      const { swagger } = j2s(schema);
      const schemaName = fn + "_" + key;
      swaggerBuilder.addSchemas({ [schemaName]: swagger });
      const rule = {
        tags: [controllerName],
        summary,
        description,
        operationId: fn,
        responses: applyResponses(responses),
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

function applyResponses(responses) {
  const codes = {
    200: {
      description: "OK",
    },
    201: {
      description: "Created",
    },
    400: {
      description: "Bad Request",
    },
    401: {
      description: "Unauthorized",
    },
    403: {
      description: "Forbidden",
    },
    409: {
      description: "Conflict",
    },
  };
  return structuredClone(responses || [])
    .concat(400)
    .reduce((acc, response) => {
      return Object.assign({}, acc, { [response]: codes[response] });
    }, {});
}
