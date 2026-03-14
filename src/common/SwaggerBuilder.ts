import cfg from "./config.js";
import type { SwaggerInfo, SwaggerTag, SwaggerRule } from "../types/index.js";

interface SecurityScheme {
  type: string;
  name?: string;
  in?: string;
  scheme?: string;
}

interface OpenApiDocument {
  openapi: string;
  servers: { url: string }[];
  info?: SwaggerInfo;
  tags?: SwaggerTag[];
  paths?: Record<string, Record<string, SwaggerRule>>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
    schemas?: Record<string, unknown>;
  };
}

export default class SwaggerBuilder {
  private info?: SwaggerInfo;
  private tags: SwaggerTag[] = [];
  private paths: Record<string, Record<string, SwaggerRule>> = {};
  private securitySchemes?: Record<string, SecurityScheme>;
  private schemas?: Record<string, unknown>;

  build(): OpenApiDocument {
    const host = cfg.get("host");
    const port = cfg.get("port");
    const url = `http://${host}:${port}/api`;

    return {
      openapi: "3.0.1",
      servers: [{ url }],
      ...(this.info && { info: this.info }),
      ...(this.tags.length > 0 && { tags: this.tags }),
      ...(this.paths && { paths: this.paths }),
      components: {
        ...(this.securitySchemes && { securitySchemes: this.securitySchemes }),
        ...(this.schemas && { schemas: this.schemas }),
      },
    };
  }

  addInfo(info: SwaggerInfo): this {
    this.info = { ...this.info, ...info };
    return this;
  }

  addTag(tag: SwaggerTag): this {
    this.tags.push(tag);
    return this;
  }

  addPath(route: string, method: string, rule: SwaggerRule): this {
    if (!this.paths[route]) this.paths[route] = {};
    this.paths[route][method] = { ...this.paths[route][method], ...rule };
    return this;
  }

  addSecuritySchemes(schemes: Record<string, SecurityScheme>): this {
    this.securitySchemes = { ...this.securitySchemes, ...schemes };
    return this;
  }

  addSchemas(schemas: Record<string, unknown>): this {
    this.schemas = { ...this.schemas, ...schemas };
    return this;
  }
}
