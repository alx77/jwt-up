const cfg = require("./config");

module.exports = class SwaggerBuilder {
    constructor() {
        this.info;
        this.tags = [];
        this.paths = {};
        this.securitySchemes;
        this.schemas;
    }

    build() {
        const host = cfg.get("host");
        const port = cfg.get("port");
        const url = `http://${host}:${port}/api`
        return Object.assign(
            { openapi: "3.0.1", servers: [{url}] },
            this.info && { info: this.info } || {},
            this.tags && { tags: this.tags } || {},
            this.paths && { paths: this.paths } || {},
            {
                components: Object.assign({},
                    this.securitySchemes && { securitySchemes: this.securitySchemes } || {},
                    this.schemas && { schemas: this.schemas } || {})
            }
        )
    }

    addInfo(info) {
        this.info = { ...this.info, ...info };
        return this;
    }

    addTag(tag) {
        this.tags.push(tag);
        return this;
    }

    addPath(route, method, rule) {
        const currentMethod = this.paths[route] && this.paths[route][method] || {};
        if (!this.paths[route]) this.paths[route] = {};
        this.paths[route][method] = Object.assign({}, currentMethod, rule);
        return this;
    }

    addSecuritySchemes(schemes) {
        this.securitySchemes = { ...this.securitySchemes, ...schemes };
        return this;
    }

    addSchemas(schemas) {
        this.schemas = { ...this.schemas, ...schemas };
        return this;
    }
}