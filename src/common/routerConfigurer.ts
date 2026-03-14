import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import j2s from "joi-to-swagger";
import jwtHelper from "../utils/JwtHelper.js";
import StatusError from "../exceptions/StatusError.js";
import Joi from "joi";
import type { Router, Request, Response, NextFunction } from "express";
import type { AuthConfig, Binding, FunctionConfig } from "../types/index.js";
import type SwaggerBuilder from "./SwaggerBuilder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSourceFile(dir: string, name: string): string | null {
  for (const ext of [".ts", ".js"]) {
    const p = path.join(dir, name + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function bindController(router: Router, method: string, middleware: unknown[]): void {
  if (!method) throw new Error("HTTP method not specified");
  const name = method.toLowerCase() as keyof Router;
  const fn = router[name];
  if (typeof fn !== "function") throw new Error("Wrong method call: " + method);
  (fn as Function).apply(router, middleware);
}

function auth(config: AuthConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.headers.authorization) throw new StatusError(401, "UNAUTHORIZED");
    const token = req.headers.authorization.split(" ")[1];
    const context = (req.headers["x-issuer-context"] as string | undefined) ?? "default";

    try {
      req.preprocessed = {
        headers: { authorization: jwtHelper.decodeTokenSync(token, context) },
      };
    } catch (err: unknown) {
      if ((err as Error).name === "TokenExpiredError") throw new StatusError(403, "TOKEN_EXPIRED");
      if ((err as Error).name === "JsonWebTokenError") throw new StatusError(403, "TOKEN_MALFORMED");
      throw err;
    }

    const authorization = req.preprocessed.headers.authorization;

    if (config.type === "refresh") {
      if (authorization.aud !== "refresh") throw new StatusError(403, "FORBIDDEN");
    } else {
      if (authorization.aud === "refresh") throw new StatusError(403, "FORBIDDEN");
      if (config.roles && !authorization.roles?.some((r) => config.roles!.includes(r))) {
        throw new StatusError(403, "FORBIDDEN");
      }
    }

    next();
  };
}

function validate(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
      ...(req.preprocessed ?? {}),
    });
    if (error) throw error;
    next();
  };
}

export async function configure(router: Router, swaggerBuilder: SwaggerBuilder): Promise<void> {
  const controllersPath = path.join(__dirname, "../controllers");
  const controllerDirs = fs.readdirSync(controllersPath);

  await Promise.all(
    controllerDirs.map(async (controllerName) => {
      const cntrPath = path.join(controllersPath, controllerName);
      const configPath = path.join(cntrPath, "function.json");
      if (!fs.existsSync(configPath)) return;

      const config: FunctionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

      swaggerBuilder.addTag({ name: controllerName, description: config.description });

      if (!config.enabled) return;

      await Promise.all(
        config.bindings.map(async (b) => {
          if (!b.function || !b.route || !b.method) {
            throw new Error(
              `'function.json' for controller: '${controllerName}', route: '${b.route}', method: '${b.method}' misconfigured`,
            );
          }
          const middleware = await prepareMiddleware(controllerName, cntrPath, b, swaggerBuilder);
          bindController(router, b.method, middleware);
        }),
      );
    }),
  );
}

async function prepareMiddleware(
  controllerName: string,
  cntrPath: string,
  bindings: Binding,
  swaggerBuilder: SwaggerBuilder,
): Promise<unknown[]> {
  const params: unknown[] = [bindings.route];

  let validationSchema: Joi.Schema | undefined;

  if (bindings.validate) {
    const validatorPath = resolveSourceFile(cntrPath, "validator");
    if (validatorPath) {
      const validatorModule = await import(`file://${validatorPath}`);
      if (typeof validatorModule.default === "object" && validatorModule.default[bindings.function]) {
        validationSchema = validatorModule.default[bindings.function] as Joi.Schema;
      }
    }
    if (!validationSchema) {
      throw new Error(
        `Validation schema for function '${bindings.function}' for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`,
      );
    }
    params.push(validate(validationSchema));
  }

  if (!bindings.hide) {
    setupSwaggerSections(swaggerBuilder, bindings, validationSchema, controllerName);
  }

  if (bindings.auth) params.push(auth(bindings.auth as AuthConfig));

  const indexPath = resolveSourceFile(cntrPath, "index");
  if (!indexPath) throw new Error(`No index file found for controller: ${controllerName}`);
  const module = await import(`file://${indexPath}`);
  if (typeof module.default !== "object" || !module.default[bindings.function]) {
    throw new Error(
      `Function '${bindings.function}' for controller: '${controllerName}', route: '${bindings.route}', method: '${bindings.method}' does not exist`,
    );
  }
  const func = module.default[bindings.function] as (req: Request, res: Response, next: NextFunction) => Promise<void>;

  const stub = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  swaggerBuilder: SwaggerBuilder,
  binding: Binding,
  validationSchema: Joi.Schema | undefined,
  controllerName: string,
): void {
  const { function: fn, summary, description, method, route, auth, responses } = binding;

  const schema =
    validationSchema ??
    Joi.object().unknown().keys({
      params: Joi.object(),
    });

  const keys = schema.describe().keys as Record<string, unknown> | undefined;
  if (!keys) return;

  Object.keys(keys).forEach((key) => {
    const subSchema = schema.extract(key);
    if (key === "headers") return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { swagger } = j2s(subSchema) as { swagger: Record<string, unknown> };
    const schemaName = fn + "_" + key;
    swaggerBuilder.addSchemas({ [schemaName]: swagger });

    const rule: Record<string, unknown> = {
      tags: [controllerName],
      summary,
      description,
      operationId: fn,
      responses: applyResponses(responses),
    };

    if (["post", "put", "patch"].includes(method)) {
      rule["requestBody"] = {
        content: { "application/json": { schema: { $ref: "#/components/schemas/" + schemaName } } },
      };
    }

    const pathParams: string[] = [];
    const routeComponents = route.split("/").map((com) => {
      if (com.startsWith(":")) {
        pathParams.push(com.substring(1));
        return `{${com.substring(1)}}`;
      }
      return com;
    });
    const swaggerRoute = routeComponents.join("/");

    let parameters: unknown[] = [];

    if (key === "params") {
      parameters = parameters.concat(
        pathParams.map((param) => ({ name: param, in: "path", required: true, schema: { type: "string" } })),
      );
    }

    if (key === "query") {
      const props =
        (
          swagger as {
            properties?: Record<string, { type?: string; maximum?: number; default?: unknown; enum?: unknown[] }>;
          }
        ).properties ?? {};
      parameters = parameters.concat(
        Object.entries(props).map(([field, value]) => ({
          name: field,
          in: "query",
          description,
          required: ((swagger as { required?: string[] }).required ?? []).includes(field),
          schema: { type: value.type, maximum: value.maximum, default: value.default, enum: value.enum },
        })),
      );
    }

    if (parameters.length > 0) rule["parameters"] = parameters;

    if (auth) {
      rule["security"] = [{ Bearer: ["global"] }];
    }

    swaggerBuilder.addPath(swaggerRoute, method, rule);
  });
}

function applyResponses(responses?: number[]): Record<string, { description: string }> {
  const codes: Record<number, { description: string }> = {
    200: { description: "OK" },
    201: { description: "Created" },
    400: { description: "Bad Request" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    409: { description: "Conflict" },
  };

  return [...(responses ?? []), 400].reduce<Record<string, { description: string }>>((acc, code) => {
    if (codes[code]) acc[code] = codes[code];
    return acc;
  }, {});
}
