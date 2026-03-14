declare module "joi-to-swagger" {
  import type Joi from "joi";
  function j2s(schema: Joi.Schema): { swagger: Record<string, unknown> };
  export = j2s;
}
